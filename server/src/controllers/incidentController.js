const prisma = require('../config/prisma');
const { calculatePriorityScore, calculateCommunityImpact, getPriorityBreakdown } = require('../services/priorityService');
const { calculateSlaDetails, processSlaEscalations } = require('../services/slaService');
const { uploadImage, deleteCloudinaryAsset } = require('../services/cloudinaryService');

/**
 * GET /api/incidents
 * Fetch all Civic Incidents dynamically prioritized and ordered by priority score (AUTHORITY only)
 */
const getAllIncidents = async (req, res) => {
  try {
    const { category, status, severity, slaStatus } = req.query;

    const whereClause = {};
    if (category) whereClause.category = category.toUpperCase();
    if (status) whereClause.status = status.toUpperCase();
    if (severity) whereClause.severity = severity.toUpperCase();

    const rawIncidents = await prisma.incident.findMany({
      where: whereClause,
      include: {
        _count: {
          select: { reports: true, supporters: true },
        },
        createdBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    // Idempotently process SLA overdue escalations
    await processSlaEscalations(rawIncidents);

    // Dynamically recalculate priority scores, community impact, and SLA status for all incidents
    let incidents = rawIncidents.map((inc) => {
      const supporterCount = inc._count?.supporters || inc.supportCount || 1;
      const currentPriority = calculatePriorityScore({
        severity: inc.severity,
        uniqueSupportersCount: supporterCount,
        createdAt: inc.createdAt,
        category: inc.category,
        address: inc.address || '',
      });

      const currentImpact = calculateCommunityImpact(supporterCount);
      const breakdown = getPriorityBreakdown({
        severity: inc.severity,
        uniqueSupportersCount: supporterCount,
        createdAt: inc.createdAt,
        category: inc.category,
        address: inc.address || '',
      });

      const slaDetails = calculateSlaDetails(inc);

      return {
        ...inc,
        priorityScore: currentPriority,
        communityImpact: currentImpact,
        supportCount: supporterCount,
        ageHours: breakdown.hoursOld,
        priorityBreakdown: breakdown,
        slaStatus: slaDetails.slaStatus,
        isOverdue: slaDetails.isOverdue,
        remainingHours: slaDetails.hoursRemaining,
        remainingFormatted: slaDetails.remainingFormatted,
        slaDetails,
      };
    });

    // Filter by SLA status if requested
    if (slaStatus && slaStatus !== 'ALL') {
      const normSlaFilter = slaStatus.toUpperCase();
      incidents = incidents.filter((inc) => inc.slaStatus === normSlaFilter);
    }

    // Sort descending by calculated priority score
    incidents.sort((a, b) => b.priorityScore - a.priorityScore);

    return res.status(200).json({
      success: true,
      count: incidents.length,
      incidents,
    });
  } catch (error) {
    console.error('getAllIncidents Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve incidents.',
    });
  }
};

/**
 * GET /api/incidents/:id
 * Fetch single Civic Incident with detailed priority breakdown and supporting reports (AUTHORITY only)
 */
const getIncidentById = async (req, res) => {
  try {
    const { id } = req.params;

    const incident = await prisma.incident.findUnique({
      where: { id },
      include: {
        reports: {
          include: {
            citizen: {
              select: { id: true, name: true, email: true, phone: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        supporters: {
          include: {
            user: {
              select: { id: true, name: true, email: true },
            },
          },
        },
        statusUpdates: {
          include: {
            user: {
              select: { id: true, name: true, role: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        resolution: true,
        assignments: {
          include: {
            worker: { select: { id: true, name: true, email: true } },
            assignedBy: { select: { id: true, name: true } },
          },
          orderBy: { assignedAt: 'desc' },
        },
      },
    });

    if (!incident) {
      return res.status(404).json({
        success: false,
        message: 'Incident not found.',
      });
    }

    // Worker access isolation check
    if (req.user?.role === 'FIELD_WORKER') {
      const isAssigned = incident.assignments?.some((a) => a.workerId === req.user.id);
      if (!isAssigned) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You are not assigned to this incident.',
        });
      }
    }

    const supporterCount = incident.supporters?.length || incident.supportCount || 1;
    const priorityBreakdown = getPriorityBreakdown({
      severity: incident.severity,
      uniqueSupportersCount: supporterCount,
      createdAt: incident.createdAt,
      category: incident.category,
      address: incident.address || '',
    });

    const slaDetails = calculateSlaDetails(incident);

    return res.status(200).json({
      success: true,
      incident: {
        ...incident,
        priorityScore: priorityBreakdown.priorityScore,
        communityImpact: priorityBreakdown.communityImpact,
        supportCount: supporterCount,
        priorityBreakdown,
        slaStatus: slaDetails.slaStatus,
        isOverdue: slaDetails.isOverdue,
        remainingHours: slaDetails.hoursRemaining,
        remainingFormatted: slaDetails.remainingFormatted,
        slaDetails,
      },
    });
  } catch (error) {
    console.error('getIncidentById Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve incident details.',
    });
  }
};

/**
 * GET /api/incidents/stats
 * Summary metrics for Authority Dashboard (AUTHORITY only)
 */
const getIncidentStats = async (req, res) => {
  try {
    const rawIncidents = await prisma.incident.findMany({
      include: {
        _count: { select: { supporters: true } },
      },
    });

    // Process idempotent escalations
    await processSlaEscalations(rawIncidents);

    const now = new Date();
    let total = rawIncidents.length;
    let reported = 0;
    let verified = 0;
    let assigned = 0;
    let inProgress = 0;
    let resolved = 0;
    let highPriority = 0;
    let overdueSla = 0;
    let warningSla = 0;
    let onTrackSla = 0;

    rawIncidents.forEach((inc) => {
      if (inc.status === 'REPORTED') reported++;
      else if (inc.status === 'VERIFIED') verified++;
      else if (inc.status === 'ASSIGNED') assigned++;
      else if (inc.status === 'IN_PROGRESS') inProgress++;
      else if (inc.status === 'RESOLVED' || inc.status === 'RESOLVED_PENDING_VERIFICATION') resolved++;

      const supporterCount = inc._count?.supporters || inc.supportCount || 1;
      const score = calculatePriorityScore({
        severity: inc.severity,
        uniqueSupportersCount: supporterCount,
        createdAt: inc.createdAt,
        category: inc.category,
        address: inc.address || '',
      });

      if (score >= 60 || inc.severity === 'HIGH' || inc.severity === 'CRITICAL') {
        highPriority++;
      }

      const slaDetails = calculateSlaDetails(inc, now);
      if (slaDetails.slaStatus === 'OVERDUE') overdueSla++;
      else if (slaDetails.slaStatus === 'WARNING') warningSla++;
      else if (slaDetails.slaStatus === 'ON_TRACK') onTrackSla++;
    });

    return res.status(200).json({
      success: true,
      stats: {
        total,
        reported,
        verified,
        assigned,
        inProgress,
        resolved,
        highPriority,
        overdueSla,
        warningSla,
        onTrackSla,
      },
    });
  } catch (error) {
    console.error('getIncidentStats Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve incident statistics.',
    });
  }
};

/**
 * PATCH /api/incidents/:id/verify
 * Transition incident status from REPORTED to VERIFIED (AUTHORITY only)
 */
const verifyIncident = async (req, res) => {
  try {
    const { id } = req.params;
    const { comment } = req.body || {};

    const incident = await prisma.incident.findUnique({
      where: { id },
    });

    if (!incident) {
      return res.status(404).json({
        success: false,
        message: 'Incident not found.',
      });
    }

    if (incident.status !== 'REPORTED') {
      return res.status(400).json({
        success: false,
        message: `Incident cannot be verified because its current status is '${incident.status}'. Only 'REPORTED' incidents can be verified.`,
      });
    }

    const updatedIncident = await prisma.incident.update({
      where: { id },
      data: {
        status: 'VERIFIED',
      },
    });

    await prisma.statusUpdate.create({
      data: {
        incidentId: id,
        userId: req.user.id,
        oldStatus: incident.status,
        newStatus: 'VERIFIED',
        comment: comment || 'Incident verified by authority.',
      },
    });

    return res.status(200).json({
      success: true,
      message: 'Incident successfully verified.',
      incident: updatedIncident,
    });
  } catch (error) {
    console.error('verifyIncident Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to verify incident.',
    });
  }
};

/**
 * PATCH /api/incidents/:id/assign
 * Assign a VERIFIED incident to a FIELD_WORKER (AUTHORITY only)
 */
const assignIncident = async (req, res) => {
  try {
    const { id } = req.params;
    const { workerId, notes } = req.body || {};

    if (!workerId) {
      return res.status(400).json({
        success: false,
        message: 'Worker ID is required for assignment.',
      });
    }

    const incident = await prisma.incident.findUnique({
      where: { id },
    });

    if (!incident) {
      return res.status(404).json({
        success: false,
        message: 'Incident not found.',
      });
    }

    // Worker validation
    const worker = await prisma.user.findUnique({
      where: { id: workerId },
    });

    if (!worker || worker.role !== 'FIELD_WORKER') {
      return res.status(400).json({
        success: false,
        message: 'Selected user is not a valid Field Worker.',
      });
    }

    // Incident status check - must be VERIFIED or ASSIGNED
    if (incident.status === 'REPORTED') {
      return res.status(400).json({
        success: false,
        message: 'Incident must be verified by authority before assignment.',
      });
    }

    if (['IN_PROGRESS', 'RESOLVED_PENDING_VERIFICATION', 'RESOLVED'].includes(incident.status)) {
      return res.status(400).json({
        success: false,
        message: `Incident cannot be reassigned because it is currently in '${incident.status}' state.`,
      });
    }

    // Create Assignment record
    const assignment = await prisma.assignment.create({
      data: {
        incidentId: id,
        workerId: worker.id,
        assignedById: req.user.id,
        notes: notes || `Assigned to ${worker.name}`,
      },
      include: {
        worker: { select: { id: true, name: true, email: true, department: true } },
        assignedBy: { select: { id: true, name: true } },
      },
    });

    // Update Incident status to ASSIGNED and department if missing
    const updatedIncident = await prisma.incident.update({
      where: { id },
      data: {
        status: 'ASSIGNED',
        department: incident.department || worker.department || 'General Maintenance',
      },
    });

    // Audit log
    await prisma.statusUpdate.create({
      data: {
        incidentId: id,
        userId: req.user.id,
        oldStatus: incident.status,
        newStatus: 'ASSIGNED',
        comment: notes || `Incident assigned to field worker ${worker.name}.`,
      },
    });

    // Optional Notification record
    await prisma.notification.create({
      data: {
        userId: worker.id,
        incidentId: id,
        type: 'ASSIGNMENT',
        title: 'New Field Incident Assignment',
        message: `You have been assigned to incident: "${incident.title}".`,
      },
    });

    return res.status(200).json({
      success: true,
      message: `Incident successfully assigned to ${worker.name}.`,
      incident: updatedIncident,
      assignment,
    });
  } catch (error) {
    console.error('assignIncident Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to assign incident to field worker.',
    });
  }
};

/**
 * GET /api/incidents/worker/my
 * Fetch incidents assigned to the logged-in FIELD_WORKER
 */
const getWorkerAssignedIncidents = async (req, res) => {
  try {
    const workerId = req.user.id;

    const rawIncidents = await prisma.incident.findMany({
      where: {
        assignments: {
          some: {
            workerId: workerId,
          },
        },
      },
      include: {
        reports: {
          include: {
            citizen: { select: { id: true, name: true, email: true, phone: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
        _count: { select: { supporters: true, reports: true } },
        assignments: {
          include: {
            worker: { select: { id: true, name: true, email: true } },
            assignedBy: { select: { id: true, name: true } },
          },
          orderBy: { assignedAt: 'desc' },
        },
        statusUpdates: {
          include: {
            user: { select: { id: true, name: true, role: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
        resolution: true,
      },
      orderBy: { updatedAt: 'desc' },
    });

    const incidents = rawIncidents.map((inc) => {
      const supporterCount = inc._count?.supporters || inc.supportCount || 1;
      const breakdown = getPriorityBreakdown({
        severity: inc.severity,
        uniqueSupportersCount: supporterCount,
        createdAt: inc.createdAt,
        category: inc.category,
        address: inc.address || '',
      });

      return {
        ...inc,
        priorityScore: breakdown.priorityScore,
        communityImpact: breakdown.communityImpact,
        supportCount: supporterCount,
        priorityBreakdown: breakdown,
      };
    });

    return res.status(200).json({
      success: true,
      count: incidents.length,
      incidents,
    });
  } catch (error) {
    console.error('getWorkerAssignedIncidents Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve assigned incidents.',
    });
  }
};

/**
 * PATCH /api/incidents/:id/start
 * Transition status from ASSIGNED -> IN_PROGRESS (FIELD_WORKER only)
 */
const startWorkOnIncident = async (req, res) => {
  try {
    const { id } = req.params;
    const workerId = req.user.id;

    const incident = await prisma.incident.findUnique({
      where: { id },
      include: { assignments: true },
    });

    if (!incident) {
      return res.status(404).json({
        success: false,
        message: 'Incident not found.',
      });
    }

    // Verify worker assignment
    const isAssigned = incident.assignments?.some((a) => a.workerId === workerId);
    if (!isAssigned) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You are not assigned to this incident.',
      });
    }

    // Verify current status
    if (incident.status !== 'ASSIGNED') {
      return res.status(400).json({
        success: false,
        message: `Cannot start work. Incident status must be ASSIGNED (current status: '${incident.status}').`,
      });
    }

    // Update incident status
    const updatedIncident = await prisma.incident.update({
      where: { id },
      data: {
        status: 'IN_PROGRESS',
      },
    });

    // Audit log
    await prisma.statusUpdate.create({
      data: {
        incidentId: id,
        userId: workerId,
        oldStatus: 'ASSIGNED',
        newStatus: 'IN_PROGRESS',
        comment: req.body.comment || 'Field worker initiated repair work.',
      },
    });

    return res.status(200).json({
      success: true,
      message: 'Work initiated successfully. Incident status is now IN_PROGRESS.',
      incident: updatedIncident,
    });
  } catch (error) {
    console.error('startWorkOnIncident Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to start work on incident.',
    });
  }
};

/**
 * POST /api/incidents/:id/updates
 * Add a progress note to an assigned incident timeline (FIELD_WORKER only)
 */
const addProgressUpdate = async (req, res) => {
  try {
    const { id } = req.params;
    const workerId = req.user.id;
    const { note } = req.body || {};

    if (!note || !note.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Progress update note cannot be empty.',
      });
    }

    const incident = await prisma.incident.findUnique({
      where: { id },
      include: { assignments: true },
    });

    if (!incident) {
      return res.status(404).json({
        success: false,
        message: 'Incident not found.',
      });
    }

    // Verify worker assignment
    const isAssigned = incident.assignments?.some((a) => a.workerId === workerId);
    if (!isAssigned) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You are not assigned to this incident.',
      });
    }

    const statusUpdate = await prisma.statusUpdate.create({
      data: {
        incidentId: id,
        userId: workerId,
        oldStatus: incident.status,
        newStatus: incident.status,
        comment: note.trim(),
      },
      include: {
        user: { select: { id: true, name: true, role: true } },
      },
    });

    return res.status(201).json({
      success: true,
      message: 'Progress update added to timeline.',
      statusUpdate,
    });
  } catch (error) {
    console.error('addProgressUpdate Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to add progress update.',
    });
  }
};

/**
 * POST /api/incidents/:id/complete
 * Submit work resolution evidence & transition status IN_PROGRESS -> RESOLVED_PENDING_VERIFICATION (FIELD_WORKER only)
 */
const completeWork = async (req, res) => {
  let uploadedAsset = null;
  try {
    const { id } = req.params;
    const workerId = req.user.id;
    const workNotes = req.body.workNotes || req.body.note || 'Work completed by field worker.';

    const incident = await prisma.incident.findUnique({
      where: { id },
      include: { assignments: true },
    });

    if (!incident) {
      return res.status(404).json({
        success: false,
        message: 'Incident not found.',
      });
    }

    // Verify worker assignment
    const isAssigned = incident.assignments?.some((a) => a.workerId === workerId);
    if (!isAssigned) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You are not assigned to this incident.',
      });
    }

    // Verify status is IN_PROGRESS
    if (incident.status !== 'IN_PROGRESS') {
      return res.status(400).json({
        success: false,
        message: `Cannot submit completion. Incident status must be IN_PROGRESS (current status: '${incident.status}').`,
      });
    }

    // Evidence image path handling
    let imageUrl = '/uploads/resolution-evidence.jpg';
    if (req.file) {
      uploadedAsset = await uploadImage(req.file, 'civicpulse/resolutions');
      imageUrl = uploadedAsset ? uploadedAsset.secureUrl : imageUrl;
    } else if (req.body.afterImageUrl) {
      imageUrl = req.body.afterImageUrl;
    }

    // Upsert Resolution record
    const resolution = await prisma.resolution.upsert({
      where: { incidentId: id },
      update: {
        workerId,
        workNotes: workNotes.trim(),
        afterImageUrl: imageUrl,
        resolvedAt: new Date(),
      },
      create: {
        incidentId: id,
        workerId,
        workNotes: workNotes.trim(),
        afterImageUrl: imageUrl,
        resolvedAt: new Date(),
      },
    });

    // Update assignment completion timestamp
    const latestAssignment = incident.assignments.find((a) => a.workerId === workerId);
    if (latestAssignment) {
      await prisma.assignment.update({
        where: { id: latestAssignment.id },
        data: { completedAt: new Date() },
      });
    }

    // Update incident status
    const updatedIncident = await prisma.incident.update({
      where: { id },
      data: {
        status: 'RESOLVED_PENDING_VERIFICATION',
      },
    });

    // Audit log
    await prisma.statusUpdate.create({
      data: {
        incidentId: id,
        userId: workerId,
        oldStatus: 'IN_PROGRESS',
        newStatus: 'RESOLVED_PENDING_VERIFICATION',
        comment: workNotes.trim(),
      },
    });

    return res.status(200).json({
      success: true,
      message: 'Work completed and submitted for citizen resolution verification.',
      incident: updatedIncident,
      resolution,
    });
  } catch (error) {
    if (uploadedAsset && uploadedAsset.publicId) {
      await deleteCloudinaryAsset(uploadedAsset.publicId).catch((cleanupErr) => {
        console.error('Failed to clean up Cloudinary asset after work completion error:', cleanupErr.message);
      });
    }
    console.error('completeWork Error:', error);
    return res.status(500).json({
      success: false,
      message: error.message && error.message.includes('Cloudinary')
        ? error.message
        : 'Failed to submit work resolution.',
    });
  }
};

/**
 * PATCH /api/incidents/:id/verify-resolution
 * Citizen verification of submitted work resolution (CITIZEN role only)
 * Transitions status:
 *   RESOLVED_PENDING_VERIFICATION -> RESOLVED (if confirmed === true)
 *   RESOLVED_PENDING_VERIFICATION -> REOPENED (if confirmed === false)
 */
const verifyResolutionByCitizen = async (req, res) => {
  try {
    const { id } = req.params;
    const citizenId = req.user.id;
    const { confirmed, reason } = req.body || {};

    if (typeof confirmed !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: "'confirmed' field must be a boolean (true or false).",
      });
    }

    const incident = await prisma.incident.findUnique({
      where: { id },
      include: {
        reports: true,
        supporters: true,
        resolution: {
          include: {
            verifications: true,
          },
        },
      },
    });

    if (!incident) {
      return res.status(404).json({
        success: false,
        message: 'Incident not found.',
      });
    }

    // 1. Citizen Eligibility Check
    const hasReport = incident.reports?.some((r) => r.citizenId === citizenId);
    const isSupporter = incident.supporters?.some((s) => s.userId === citizenId);
    const isCreator = incident.createdById === citizenId;

    if (!hasReport && !isSupporter && !isCreator) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You must be an associated citizen (who submitted a report or supported this issue) to verify its resolution.',
      });
    }

    // 2. Incident Status Check
    if (incident.status !== 'RESOLVED_PENDING_VERIFICATION') {
      return res.status(400).json({
        success: false,
        message: `Cannot verify resolution. Incident status must be RESOLVED_PENDING_VERIFICATION (current status: '${incident.status}').`,
      });
    }

    if (!incident.resolution) {
      return res.status(400).json({
        success: false,
        message: 'No work resolution record found for this incident.',
      });
    }

    // 3. Duplicate Verification Prevention Check
    const existingVerification = await prisma.resolutionVerification.findUnique({
      where: {
        resolutionId_citizenId: {
          resolutionId: incident.resolution.id,
          citizenId: citizenId,
        },
      },
    });

    if (existingVerification) {
      return res.status(400).json({
        success: false,
        message: 'You have already submitted a verification decision for this resolution cycle.',
      });
    }

    const newStatus = confirmed ? 'RESOLVED' : 'REOPENED';
    const feedbackText = confirmed
      ? (reason || 'Resolution verified and accepted by citizen.')
      : (reason || 'Issue still exists. Reopened by citizen.');

    // 4. Create ResolutionVerification record
    await prisma.resolutionVerification.create({
      data: {
        resolutionId: incident.resolution.id,
        citizenId: citizenId,
        confirmed: confirmed,
        reason: reason || null,
      },
    });

    // 5. Update Resolution model
    await prisma.resolution.update({
      where: { id: incident.resolution.id },
      data: {
        isVerifiedByCitizen: confirmed,
        citizenFeedback: feedbackText,
        verifiedAt: new Date(),
      },
    });

    // 6. Update Incident model status
    const updatedIncident = await prisma.incident.update({
      where: { id },
      data: {
        status: newStatus,
      },
    });

    // 7. Audit log
    await prisma.statusUpdate.create({
      data: {
        incidentId: id,
        userId: citizenId,
        oldStatus: 'RESOLVED_PENDING_VERIFICATION',
        newStatus: newStatus,
        comment: feedbackText,
      },
    });

    const responseMsg = confirmed
      ? 'Thank you. This civic issue has been marked as resolved.'
      : 'This issue has been reopened for further action.';

    return res.status(200).json({
      success: true,
      message: responseMsg,
      incident: updatedIncident,
    });
  } catch (error) {
    console.error('verifyResolutionByCitizen Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to submit citizen resolution verification.',
    });
  }
};

module.exports = {
  getAllIncidents,
  getIncidentById,
  getIncidentStats,
  verifyIncident,
  assignIncident,
  getWorkerAssignedIncidents,
  startWorkOnIncident,
  addProgressUpdate,
  completeWork,
  verifyResolutionByCitizen,
};

