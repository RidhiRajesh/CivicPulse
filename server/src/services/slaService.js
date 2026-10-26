const prisma = require('../config/prisma');

// SLA Targets in hours by severity level
const SLA_HOURS_BY_SEVERITY = {
  CRITICAL: 24,
  HIGH: 48,
  MEDIUM: 72,
  LOW: 168, // 7 days (7 * 24)
};

/**
 * Calculate SLA deadline from creation time and severity
 */
function calculateSlaDeadline(createdAt = new Date(), severity = 'MEDIUM') {
  const normSeverity = (severity || 'MEDIUM').toUpperCase();
  const hours = SLA_HOURS_BY_SEVERITY[normSeverity] || 72;
  const createdTime = new Date(createdAt).getTime();
  return {
    slaHours: hours,
    slaDeadline: new Date(createdTime + hours * 60 * 60 * 1000),
  };
}

/**
 * Deterministic SLA Status Calculation
 * Statuses:
 *  - 'RESOLVED' / 'SATISFIED': Incident is already resolved
 *  - 'OVERDUE': Current time > slaDeadline
 *  - 'WARNING': <= 20% of SLA time remaining
 *  - 'ON_TRACK': > 20% of SLA time remaining
 */
function calculateSlaDetails(incident, now = new Date()) {
  const normSeverity = (incident.severity || 'MEDIUM').toUpperCase();
  const slaHours = incident.slaHours || SLA_HOURS_BY_SEVERITY[normSeverity] || 72;
  const createdAtMs = new Date(incident.createdAt).getTime();
  const deadlineMs = new Date(incident.slaDeadline || (createdAtMs + slaHours * 3600000)).getTime();
  const nowMs = new Date(now).getTime();

  const totalSlaMs = slaHours * 3600000;
  const remainingMs = deadlineMs - nowMs;
  const hoursRemaining = parseFloat((remainingMs / 3600000).toFixed(1));
  const remainingRatio = remainingMs / totalSlaMs;
  const percentRemaining = Math.max(0, Math.min(100, Math.round(remainingRatio * 100)));

  // Exclude resolved incidents from overdue SLA calculation
  if (['RESOLVED', 'RESOLVED_PENDING_VERIFICATION'].includes(incident.status)) {
    return {
      slaHours,
      slaDeadline: new Date(deadlineMs).toISOString(),
      slaStatus: 'RESOLVED',
      isOverdue: false,
      hoursRemaining: Math.max(0, hoursRemaining),
      percentRemaining,
      remainingFormatted: 'SLA Satisfied (Resolved)',
    };
  }

  // Active incidents SLA calculation
  if (nowMs > deadlineMs) {
    const overdueHours = parseFloat((Math.abs(remainingMs) / 3600000).toFixed(1));
    return {
      slaHours,
      slaDeadline: new Date(deadlineMs).toISOString(),
      slaStatus: 'OVERDUE',
      isOverdue: true,
      hoursRemaining,
      percentRemaining: 0,
      remainingFormatted: `OVERDUE by ${overdueHours}h`,
    };
  }

  if (remainingRatio <= 0.20) {
    return {
      slaHours,
      slaDeadline: new Date(deadlineMs).toISOString(),
      slaStatus: 'WARNING',
      isOverdue: false,
      hoursRemaining,
      percentRemaining,
      remainingFormatted: `WARNING: ${hoursRemaining}h remaining (${percentRemaining}%)`,
    };
  }

  return {
    slaHours,
    slaDeadline: new Date(deadlineMs).toISOString(),
    slaStatus: 'ON_TRACK',
    isOverdue: false,
    hoursRemaining,
    percentRemaining,
    remainingFormatted: `${hoursRemaining}h remaining`,
  };
}

/**
 * Idempotent SLA Overdue Escalation Processor
 * Scans incidents and creates a SINGLE audit log & sets isSlaBreached = true upon breach.
 */
async function processSlaEscalations(incidents = [], now = new Date()) {
  const escalations = [];

  for (const inc of incidents) {
    const sla = calculateSlaDetails(inc, now);

    // Only breach active overdue incidents that haven't been marked as breached yet
    if (sla.isOverdue && !inc.isSlaBreached && !['RESOLVED', 'RESOLVED_PENDING_VERIFICATION'].includes(inc.status)) {
      try {
        // Update database idempotently
        await prisma.incident.update({
          where: { id: inc.id },
          data: { isSlaBreached: true },
        });

        // Add escalation audit log entry
        await prisma.statusUpdate.create({
          data: {
            incidentId: inc.id,
            userId: null,
            oldStatus: inc.status,
            newStatus: inc.status,
            comment: `SLA BREACH ESCALATION: Incident SLA deadline (${sla.slaHours}h) breached. Automatically escalated for priority authority intervention.`,
          },
        });

        // Create SLA warning notification for creator if available
        if (inc.createdById) {
          await prisma.notification.create({
            data: {
              userId: inc.createdById,
              incidentId: inc.id,
              type: 'SLA_WARNING',
              title: 'SLA Deadline Breached',
              message: `Incident "${inc.title}" breached its ${sla.slaHours}h SLA deadline and has been escalated.`,
            },
          }).catch(() => {});
        }

        // Create SLA warning notification for municipal authorities
        try {
          const authorities = await prisma.user.findMany({
            where: { role: 'AUTHORITY', isActive: true },
            select: { id: true },
          });
          for (const auth of authorities) {
            await prisma.notification.create({
              data: {
                userId: auth.id,
                incidentId: inc.id,
                type: 'SLA_WARNING',
                title: 'SLA Deadline Breached - Authority Alert',
                message: `Incident "${inc.title}" (${inc.severity} severity) has breached its ${sla.slaHours}h SLA deadline and requires priority intervention.`,
              },
            }).catch(() => {});
          }
        } catch (authNotifErr) {
          console.error('Failed to notify authorities of SLA breach:', authNotifErr);
        }

        inc.isSlaBreached = true;
        escalations.push(inc.id);
      } catch (err) {
        console.error(`SLA Escalation Error for Incident ${inc.id}:`, err);
      }
    }
  }

  return escalations;
}

module.exports = {
  SLA_HOURS_BY_SEVERITY,
  calculateSlaDeadline,
  calculateSlaDetails,
  processSlaEscalations,
};
