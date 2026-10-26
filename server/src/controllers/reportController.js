const prisma = require('../config/prisma');
const { findBestIncidentMatch } = require('../services/correlationService');
const { calculatePriorityScore, calculateCommunityImpact } = require('../services/priorityService');
const { uploadImage, deleteCloudinaryAsset } = require('../services/cloudinaryService');

const VALID_CATEGORIES = [
  'POTHOLE',
  'GARBAGE',
  'STREETLIGHT',
  'DRAINAGE',
  'WATER_LEAKAGE',
  'DAMAGED_ROAD',
  'OTHER',
];

const VALID_SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

// Severity rank mapping for elevation
const SEVERITY_RANK = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  CRITICAL: 4,
};

/**
 * Calculate SLA hours based on severity level
 */
const getSlaHours = (severity) => {
  switch (severity) {
    case 'CRITICAL':
      return 24;
    case 'HIGH':
      return 48;
    case 'MEDIUM':
      return 72;
    case 'LOW':
    default:
      return 168; // 7 days
  }
};

/**
 * POST /api/reports
 * Create a new Citizen Issue Report & correlate with existing Civic Incidents via Spatial-Semantic Algorithm
 */
const createReport = async (req, res) => {
  try {
    const citizenId = req.user.id;
    const { category, description, severity = 'MEDIUM', latitude, longitude, address, title } = req.body;

    // 1. Input Validations
    if (!category || !VALID_CATEGORIES.includes(category.toUpperCase())) {
      return res.status(400).json({
        success: false,
        message: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}.`,
      });
    }

    const normalizedSeverity = severity.toUpperCase();
    if (!VALID_SEVERITIES.includes(normalizedSeverity)) {
      return res.status(400).json({
        success: false,
        message: `Invalid severity. Must be one of: ${VALID_SEVERITIES.join(', ')}.`,
      });
    }

    if (!description || typeof description !== 'string' || !description.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Description is required.',
      });
    }

    const parsedLat = parseFloat(latitude);
    const parsedLng = parseFloat(longitude);

    if (isNaN(parsedLat) || parsedLat < -90 || parsedLat > 90) {
      return res.status(400).json({
        success: false,
        message: 'Latitude must be a valid number between -90 and 90.',
      });
    }

    if (isNaN(parsedLng) || parsedLng < -180 || parsedLng > 180) {
      return res.status(400).json({
        success: false,
        message: 'Longitude must be a valid number between -180 and 180.',
      });
    }

    let imageUrl = null;
    let uploadedAsset = null;
    if (req.file) {
      uploadedAsset = await uploadImage(req.file, 'civicpulse/reports');
      imageUrl = uploadedAsset ? uploadedAsset.secureUrl : null;
    }

    const normalizedCategory = category.toUpperCase();
    const formattedTitle = title && title.trim() ? title.trim() : `${normalizedCategory.replace('_', ' ')} Issue`;

    // 2. Query Candidate Incidents for Correlation
    // Bounding box filter (~0.002 degrees is approx 220m) for fast DB performance
    const candidateIncidents = await prisma.incident.findMany({
      where: {
        category: normalizedCategory,
        status: { notIn: ['RESOLVED'] },
        latitude: {
          gte: parsedLat - 0.0025,
          lte: parsedLat + 0.0025,
        },
        longitude: {
          gte: parsedLng - 0.0025,
          lte: parsedLng + 0.0025,
        },
      },
      include: {
        supporters: true,
      },
    });

    // 3. Evaluate Correlation Engine
    const newReportPayload = {
      category: normalizedCategory,
      severity: normalizedSeverity,
      description: description.trim(),
      latitude: parsedLat,
      longitude: parsedLng,
    };

    const bestMatch = findBestIncidentMatch(newReportPayload, candidateIncidents);

    // 4. CORRELATION MATCH FOUND: Attach Report to Existing Incident
    if (bestMatch) {
      const targetIncident = bestMatch.incident;
      const evaluation = bestMatch.evaluation;

      const result = await prisma.$transaction(async (tx) => {
        // Create Report linked to existing Incident
        const report = await tx.report.create({
          data: {
            citizenId,
            incidentId: targetIncident.id,
            category: normalizedCategory,
            title: formattedTitle,
            description: description.trim(),
            latitude: parsedLat,
            longitude: parsedLng,
            address: address ? address.trim() : null,
            imageUrl,
          },
          include: {
            citizen: {
              select: { id: true, name: true, email: true },
            },
          },
        });

        // Add Citizen Supporter if not already registered
        const existingSupporter = await tx.incidentSupporter.findUnique({
          where: {
            incidentId_userId: {
              incidentId: targetIncident.id,
              userId: citizenId,
            },
          },
        });

        if (!existingSupporter) {
          await tx.incidentSupporter.create({
            data: {
              incidentId: targetIncident.id,
              userId: citizenId,
            },
          });
        }

        // Count total unique supporters
        const supporterCount = await tx.incidentSupporter.count({
          where: { incidentId: targetIncident.id },
        });

        // Determine effective severity (Elevate if new report indicates higher severity)
        let effectiveSeverity = targetIncident.severity;
        if (SEVERITY_RANK[normalizedSeverity] > SEVERITY_RANK[targetIncident.severity]) {
          effectiveSeverity = normalizedSeverity;
        }

        const newCommunityImpact = calculateCommunityImpact(supporterCount);
        const newPriorityScore = calculatePriorityScore({
          severity: effectiveSeverity,
          uniqueSupportersCount: supporterCount,
          createdAt: targetIncident.createdAt,
          category: targetIncident.category,
          address: targetIncident.address || '',
        });

        const newSlaHours = getSlaHours(effectiveSeverity);
        const newSlaDeadline = new Date(new Date(targetIncident.createdAt).getTime() + newSlaHours * 60 * 60 * 1000);

        // Update Incident metrics
        const updatedIncident = await tx.incident.update({
          where: { id: targetIncident.id },
          data: {
            supportCount: supporterCount,
            communityImpact: newCommunityImpact,
            priorityScore: newPriorityScore,
            severity: effectiveSeverity,
            slaHours: newSlaHours,
            slaDeadline: newSlaDeadline,
          },
        });

        // Record Status Update Audit Entry
        await tx.statusUpdate.create({
          data: {
            incidentId: targetIncident.id,
            userId: citizenId,
            newStatus: targetIncident.status,
            comment: `Additional citizen report linked (Distance: ${evaluation.distanceMeters}m). Total supporters: ${supporterCount}.`,
          },
        });

        return { report, incident: updatedIncident, evaluation, supporterCount };
      });

      return res.status(201).json({
        success: true,
        message: 'Your report was added to an existing civic incident.',
        report: result.report,
        incident: result.incident,
        correlation: {
          matchedExistingIncident: true,
          distanceMeters: result.evaluation.distanceMeters,
          textSimilarityScore: result.evaluation.textScore,
          spatialScore: result.evaluation.spatialScore,
          correlationScore: result.evaluation.correlationScore,
          uniqueSupportersCount: result.supporterCount,
        },
      });
    }

    // 5. NO CORRELATION MATCH: Create New Civic Incident
    const slaHours = getSlaHours(normalizedSeverity);
    const slaDeadline = new Date(Date.now() + slaHours * 60 * 60 * 1000);
    const initialPriorityScore = calculatePriorityScore({
      severity: normalizedSeverity,
      uniqueSupportersCount: 1,
      createdAt: new Date(),
      category: normalizedCategory,
      address: address ? address.trim() : '',
    });
    const initialCommunityImpact = calculateCommunityImpact(1);

    const result = await prisma.$transaction(async (tx) => {
      // Create new Civic Incident
      const incident = await tx.incident.create({
        data: {
          title: formattedTitle,
          description: description.trim(),
          category: normalizedCategory,
          severity: normalizedSeverity,
          status: 'REPORTED',
          latitude: parsedLat,
          longitude: parsedLng,
          address: address ? address.trim() : null,
          createdById: citizenId,
          slaHours,
          slaDeadline,
          supportCount: 1,
          communityImpact: initialCommunityImpact,
          priorityScore: initialPriorityScore,
        },
      });

      // Create Report
      const report = await tx.report.create({
        data: {
          citizenId,
          incidentId: incident.id,
          category: normalizedCategory,
          title: formattedTitle,
          description: description.trim(),
          latitude: parsedLat,
          longitude: parsedLng,
          address: address ? address.trim() : null,
          imageUrl,
        },
        include: {
          citizen: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      // Add Initial Supporter
      await tx.incidentSupporter.create({
        data: {
          incidentId: incident.id,
          userId: citizenId,
        },
      });

      // Add Initial Status Update
      await tx.statusUpdate.create({
        data: {
          incidentId: incident.id,
          userId: citizenId,
          newStatus: 'REPORTED',
          comment: 'New Civic Incident created.',
        },
      });

      return { report, incident };
    });

    return res.status(201).json({
      success: true,
      message: 'New civic incident created.',
      report: result.report,
      incident: result.incident,
      correlation: {
        matchedExistingIncident: false,
        uniqueSupportersCount: 1,
      },
    });
  } catch (error) {
    if (uploadedAsset && uploadedAsset.publicId) {
      await deleteCloudinaryAsset(uploadedAsset.publicId).catch((cleanupErr) => {
        console.error('Failed to clean up Cloudinary asset after report creation error:', cleanupErr.message);
      });
    }
    console.error('Create Report Error:', error);
    return res.status(500).json({
      success: false,
      message: error.message && error.message.includes('Cloudinary')
        ? error.message
        : 'Failed to submit issue report due to a server error.',
    });
  }
};

/**
 * GET /api/reports/my
 * Fetch all reports created by the currently authenticated citizen
 */
const getMyReports = async (req, res) => {
  try {
    const citizenId = req.user.id;

    const reports = await prisma.report.findMany({
      where: { citizenId },
      include: {
        incident: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return res.status(200).json({
      success: true,
      count: reports.length,
      reports,
    });
  } catch (error) {
    console.error('getMyReports Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve your submitted reports.',
    });
  }
};

/**
 * GET /api/reports/:id
 * Fetch single report by ID
 */
const getReportById = async (req, res) => {
  try {
    const { id } = req.params;

    const report = await prisma.report.findUnique({
      where: { id },
      include: {
        incident: {
          include: {
            statusUpdates: {
              orderBy: { createdAt: 'desc' },
            },
            resolution: true,
            supporters: true,
          },
        },
        citizen: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Report not found.',
      });
    }

    if (req.user.role === 'CITIZEN' && report.citizenId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You do not have permission to view this report.',
      });
    }

    return res.status(200).json({
      success: true,
      report,
    });
  } catch (error) {
    console.error('getReportById Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve report details.',
    });
  }
};

module.exports = {
  createReport,
  getMyReports,
  getReportById,
};
