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
        resolution: {
          include: {
            worker: { select: { id: true, name: true, email: true, department: true } },
            verifications: {
              include: {
                citizen: { select: { id: true, name: true, email: true } },
              },
              orderBy: { createdAt: 'desc' },
            },
          },
        },
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

    const isReopened = incident.status === 'REOPENED';
    const isReassigned = incident.status === 'ASSIGNED';
    const auditComment = notes
      ? (isReopened ? `Dispute re-dispatch notes: ${notes}` : notes)
      : (isReopened
          ? `Disputed incident re-dispatched to field worker ${worker.name}.`
          : isReassigned
          ? `Incident reassigned to field worker ${worker.name}.`
          : `Incident assigned to field worker ${worker.name}.`);

    const notificationTitle = isReopened
      ? 'Disputed Incident Re-Dispatched'
      : isReassigned
      ? 'Incident Reassigned'
      : 'New Field Incident Assignment';

    const notificationMessage = isReopened
      ? `Incident "${incident.title}" has been re-dispatched to you for dispute resolution.${notes ? ` Notes: ${notes}` : ''}`
      : `You have been assigned to incident: "${incident.title}".${notes ? ` Notes: ${notes}` : ''}`;

    // Audit log
    await prisma.statusUpdate.create({
      data: {
        incidentId: id,
        userId: req.user.id,
        oldStatus: incident.status,
        newStatus: 'ASSIGNED',
        comment: auditComment,
      },
    });

    // Notification record
    await prisma.notification.create({
      data: {
        userId: worker.id,
        incidentId: id,
        type: 'ASSIGNMENT',
        title: notificationTitle,
        message: notificationMessage,
      },
    }).catch(() => {});

    return res.status(200).json({
      success: true,
      message: isReopened
        ? `Disputed incident successfully re-dispatched to ${worker.name}.`
        : isReassigned
        ? `Incident successfully reassigned to ${worker.name}.`
        : `Incident successfully assigned to ${worker.name}.`,
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
        resolution: {
          include: {
            worker: { select: { id: true, name: true, email: true, department: true } },
            verifications: {
              include: {
                citizen: { select: { id: true, name: true, email: true } },
              },
              orderBy: { createdAt: 'desc' },
            },
          },
        },
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

    // 8. Generate dispute notification for authorities and worker if reopened
    if (!confirmed) {
      try {
        const authorities = await prisma.user.findMany({
          where: { role: 'AUTHORITY', isActive: true },
          select: { id: true },
        });
        for (const auth of authorities) {
          await prisma.notification.create({
            data: {
              userId: auth.id,
              incidentId: id,
              type: 'RESOLUTION_VERIFICATION',
              title: 'Citizen Disputed Resolution - Incident Reopened',
              message: `Citizen rejected resolution for "${incident.title}". Reason: ${reason || 'Issue still exists.'}`,
            },
          }).catch(() => {});
        }

        if (incident.resolution?.workerId) {
          await prisma.notification.create({
            data: {
              userId: incident.resolution.workerId,
              incidentId: id,
              type: 'RESOLUTION_VERIFICATION',
              title: 'Work Resolution Disputed',
              message: `The citizen disputed repair work on "${incident.title}". Reason: ${reason || 'Issue still exists.'}`,
            },
          }).catch(() => {});
        }
      } catch (notifErr) {
        console.error('Error generating dispute notifications:', notifErr);
      }
    }

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

/**
 * PATCH /api/incidents/:id/admin-resolve
 * Manually resolve an incident via administrative override (AUTHORITY only)
 * Settle citizen disputes on REOPENED or pending verification incidents with mandatory reason.
 */
const adminResolveIncident = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body || {};

    if (!reason || typeof reason !== 'string' || !reason.trim()) {
      return res.status(400).json({
        success: false,
        message: 'A mandatory justification reason is required for administrative resolution.',
      });
    }

    const incident = await prisma.incident.findUnique({
      where: { id },
      include: { resolution: true },
    });

    if (!incident) {
      return res.status(404).json({
        success: false,
        message: 'Incident not found.',
      });
    }

    if (incident.status === 'RESOLVED') {
      return res.status(400).json({
        success: false,
        message: 'Incident is already marked as resolved.',
      });
    }

    const trimmedReason = reason.trim();
    const oldStatus = incident.status;

    // 1. Update incident status to RESOLVED
    const updatedIncident = await prisma.incident.update({
      where: { id },
      data: {
        status: 'RESOLVED',
      },
    });

    // 2. If a resolution record exists, update verification status
    if (incident.resolution) {
      await prisma.resolution.update({
        where: { id: incident.resolution.id },
        data: {
          isVerifiedByCitizen: true,
          citizenFeedback: incident.resolution.citizenFeedback
            ? `${incident.resolution.citizenFeedback} | [Admin Override: ${trimmedReason}]`
            : `[Admin Override: ${trimmedReason}]`,
          verifiedAt: new Date(),
        },
      });
    }

    // 3. Record StatusUpdate audit trail entry
    await prisma.statusUpdate.create({
      data: {
        incidentId: id,
        userId: req.user.id,
        oldStatus,
        newStatus: 'RESOLVED',
        comment: `ADMINISTRATIVE OVERRIDE CLOSURE: ${trimmedReason}`,
      },
    });

    // 4. Notify creator citizen if available
    if (incident.createdById) {
      await prisma.notification.create({
        data: {
          userId: incident.createdById,
          incidentId: id,
          type: 'RESOLUTION_VERIFICATION',
          title: 'Incident Resolved by Administrative Override',
          message: `Municipal authority has closed incident "${incident.title}". Reason: ${trimmedReason}`,
        },
      }).catch(() => {});
    }

    return res.status(200).json({
      success: true,
      message: 'Incident resolved successfully via administrative override.',
      incident: updatedIncident,
    });
  } catch (error) {
    console.error('adminResolveIncident Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to administratively resolve incident.',
    });
  }
};

/**
 * Helper to escape CSV values and protect against formula injection
 */
const sanitizeCsvValue = (val) => {
  if (val === null || val === undefined) return '""';
  let str = String(val).trim();

  // Formula injection defense: prepend single quote if value begins with dangerous characters
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }

  // Escape double quotes and enclose in quotes if contains comma, quote, or newline
  if (/[",\n\r]/.test(str)) {
    str = `"${str.replace(/"/g, '""')}"`;
  } else {
    str = `"${str}"`;
  }

  return str;
};

/**
 * GET /api/incidents/export
 * Export incidents in CSV or GeoJSON format (AUTHORITY only)
 */
const exportIncidents = async (req, res) => {
  try {
    const { format = 'csv', category, status, severity, slaStatus, search } = req.query;

    const whereClause = {};
    if (category && category !== 'ALL') whereClause.category = category.toUpperCase();
    if (status && status !== 'ALL') whereClause.status = status.toUpperCase();
    if (severity && severity !== 'ALL') whereClause.severity = severity.toUpperCase();

    // Query incidents
    const rawIncidents = await prisma.incident.findMany({
      where: whereClause,
      include: {
        _count: {
          select: { reports: true, supporters: true },
        },
        assignments: {
          include: {
            worker: { select: { id: true, name: true, email: true, department: true } },
          },
          orderBy: { assignedAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Idempotently process SLA escalations
    await processSlaEscalations(rawIncidents);

    // Calculate priority scores and SLA details
    let incidents = rawIncidents.map((inc) => {
      const supporterCount = inc._count?.supporters || inc.supportCount || 1;
      const reportCount = inc._count?.reports || 1;
      const currentPriority = calculatePriorityScore({
        severity: inc.severity,
        uniqueSupportersCount: supporterCount,
        createdAt: inc.createdAt,
        category: inc.category,
        address: inc.address || '',
      });
      const currentImpact = calculateCommunityImpact(supporterCount);
      const slaDetails = calculateSlaDetails(inc);
      const latestAssignment = inc.assignments && inc.assignments.length > 0 ? inc.assignments[0] : null;

      return {
        ...inc,
        priorityScore: currentPriority,
        communityImpact: currentImpact,
        supportCount: supporterCount,
        reportCount,
        slaStatus: slaDetails.slaStatus,
        remainingHours: slaDetails.hoursRemaining,
        slaDeadline: slaDetails.slaDeadline,
        assignedWorker: latestAssignment?.worker ? latestAssignment.worker.name : 'Unassigned',
      };
    });

    // Filter by calculated SLA status if passed
    if (slaStatus && slaStatus !== 'ALL') {
      const normSla = slaStatus.toUpperCase();
      incidents = incidents.filter((inc) => inc.slaStatus === normSla);
    }

    // Filter by search query if passed
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      incidents = incidents.filter((inc) => {
        return (
          inc.title?.toLowerCase().includes(q) ||
          inc.description?.toLowerCase().includes(q) ||
          inc.address?.toLowerCase().includes(q)
        );
      });
    }

    // Sort descending by priority score
    incidents.sort((a, b) => b.priorityScore - a.priorityScore);

    const dateStr = new Date().toISOString().split('T')[0];

    // CSV Format
    if (format.toLowerCase() === 'csv') {
      const headers = [
        'Incident ID',
        'Title',
        'Category',
        'Severity',
        'Status',
        'Priority Score',
        'Community Impact',
        'Reports Count',
        'Supporters Count',
        'SLA Deadline',
        'SLA Status',
        'Remaining Hours',
        'Department',
        'Assigned Worker',
        'Address',
        'Latitude',
        'Longitude',
        'Created At',
      ];

      const csvRows = [headers.map(sanitizeCsvValue).join(',')];

      for (const inc of incidents) {
        const row = [
          inc.id,
          inc.title,
          inc.category,
          inc.severity,
          inc.status,
          inc.priorityScore,
          inc.communityImpact,
          inc.reportCount,
          inc.supportCount,
          inc.slaDeadline ? new Date(inc.slaDeadline).toISOString() : '',
          inc.slaStatus,
          inc.remainingHours ?? '',
          inc.department || 'General Maintenance',
          inc.assignedWorker,
          inc.address || '',
          inc.latitude,
          inc.longitude,
          new Date(inc.createdAt).toISOString(),
        ];
        csvRows.push(row.map(sanitizeCsvValue).join(','));
      }

      const csvContent = '\uFEFF' + csvRows.join('\r\n');

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="civicpulse-incidents-export-${dateStr}.csv"`);
      return res.status(200).send(csvContent);
    }

    // GeoJSON Format (RFC 7946 FeatureCollection)
    if (format.toLowerCase() === 'geojson') {
      const features = [];
      let omittedCount = 0;

      for (const inc of incidents) {
        const lat = parseFloat(inc.latitude);
        const lon = parseFloat(inc.longitude);

        if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
          omittedCount++;
          continue;
        }

        features.push({
          type: 'Feature',
          geometry: {
            type: 'Point',
            // GeoJSON coordinates MUST be [longitude, latitude]
            coordinates: [lon, lat],
          },
          properties: {
            id: inc.id,
            title: inc.title,
            category: inc.category,
            severity: inc.severity,
            status: inc.status,
            priorityScore: inc.priorityScore,
            communityImpact: inc.communityImpact,
            reportsCount: inc.reportCount,
            supportersCount: inc.supportCount,
            slaStatus: inc.slaStatus,
            slaDeadline: inc.slaDeadline ? new Date(inc.slaDeadline).toISOString() : null,
            remainingHours: inc.remainingHours ?? null,
            department: inc.department || 'General Maintenance',
            assignedWorker: inc.assignedWorker,
            address: inc.address || '',
            createdAt: new Date(inc.createdAt).toISOString(),
          },
        });
      }

      const geoJson = {
        type: 'FeatureCollection',
        properties: {
          generatedAt: new Date().toISOString(),
          totalIncidents: incidents.length,
          locatedFeaturesCount: features.length,
          omittedInvalidCoordinatesCount: omittedCount,
        },
        features,
      };

      res.setHeader('Content-Type', 'application/geo+json; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="civicpulse-incidents-${dateStr}.geojson"`);
      return res.status(200).json(geoJson);
    }

    return res.status(400).json({
      success: false,
      message: `Unsupported export format '${format}'. Supported formats are 'csv' and 'geojson'.`,
    });
  } catch (error) {
    console.error('exportIncidents Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to export incidents.',
    });
  }
};

module.exports = {
  getAllIncidents,
  getIncidentById,
  getIncidentStats,
  verifyIncident,
  assignIncident,
  adminResolveIncident,
  exportIncidents,
  getWorkerAssignedIncidents,
  startWorkOnIncident,
  addProgressUpdate,
  completeWork,
  verifyResolutionByCitizen,
  sanitizeCsvValue,
};

