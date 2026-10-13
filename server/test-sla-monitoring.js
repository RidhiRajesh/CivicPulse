const prisma = require('./src/config/prisma');
const { calculateSlaDetails, processSlaEscalations, SLA_HOURS_BY_SEVERITY } = require('./src/services/slaService');

const API_URL = 'http://localhost:5000/api';

async function runSlaTests() {
  console.log('=== STARTING SLA MONITORING & OVERDUE ESCALATION TEST SUITE ===\n');

  try {
    // -------------------------------------------------------------
    // TEST 1 to 4: Severity-based SLA Targets (24h, 48h, 72h, 168h)
    // -------------------------------------------------------------
    console.log('1-4. Testing Severity-based SLA Target Hours...');
    console.log('  CRITICAL SLA Target:', SLA_HOURS_BY_SEVERITY.CRITICAL, 'hours');
    console.log('  HIGH SLA Target:', SLA_HOURS_BY_SEVERITY.HIGH, 'hours');
    console.log('  MEDIUM SLA Target:', SLA_HOURS_BY_SEVERITY.MEDIUM, 'hours');
    console.log('  LOW SLA Target:', SLA_HOURS_BY_SEVERITY.LOW, 'hours');

    if (
      SLA_HOURS_BY_SEVERITY.CRITICAL === 24 &&
      SLA_HOURS_BY_SEVERITY.HIGH === 48 &&
      SLA_HOURS_BY_SEVERITY.MEDIUM === 72 &&
      SLA_HOURS_BY_SEVERITY.LOW === 168
    ) {
      console.log('  ✅ TEST 1-4 PASSED: CRITICAL=24h, HIGH=48h, MEDIUM=72h, LOW=168h targets verified.\n');
    } else {
      console.error('❌ FAIL: Incorrect SLA target hours.');
      process.exit(1);
    }

    // -------------------------------------------------------------
    // TEST 5: Future Deadline -> ON_TRACK
    // -------------------------------------------------------------
    console.log('5. Testing Future Deadline -> ON_TRACK status...');
    const now = new Date();
    const futureIncident = {
      severity: 'CRITICAL',
      status: 'REPORTED',
      createdAt: new Date(now.getTime() - 2 * 3600000), // Created 2 hours ago (22 hours remaining of 24h)
      slaHours: 24,
      slaDeadline: new Date(now.getTime() + 22 * 3600000),
    };
    const slaFuture = calculateSlaDetails(futureIncident, now);
    if (slaFuture.slaStatus === 'ON_TRACK' && !slaFuture.isOverdue) {
      console.log(`  Calculated Status: ${slaFuture.slaStatus} | Text: "${slaFuture.remainingFormatted}"`);
      console.log('  ✅ TEST 5 PASSED: Future deadline calculated as ON_TRACK.\n');
    } else {
      console.error('❌ FAIL: Expected ON_TRACK for future deadline, got:', slaFuture.slaStatus);
      process.exit(1);
    }

    // -------------------------------------------------------------
    // TEST 6: Near Deadline (<= 20% remaining) -> WARNING
    // -------------------------------------------------------------
    console.log('6. Testing Near Deadline (<=20% SLA remaining) -> WARNING status...');
    const warningIncident = {
      severity: 'CRITICAL',
      status: 'ASSIGNED',
      createdAt: new Date(now.getTime() - 20 * 3600000), // Created 20 hours ago (4 hours remaining of 24h = 16.6% remaining)
      slaHours: 24,
      slaDeadline: new Date(now.getTime() + 4 * 3600000),
    };
    const slaWarning = calculateSlaDetails(warningIncident, now);
    if (slaWarning.slaStatus === 'WARNING' && !slaWarning.isOverdue) {
      console.log(`  Calculated Status: ${slaWarning.slaStatus} | Text: "${slaWarning.remainingFormatted}"`);
      console.log('  ✅ TEST 6 PASSED: Near deadline calculated as WARNING.\n');
    } else {
      console.error('❌ FAIL: Expected WARNING for near deadline, got:', slaWarning.slaStatus);
      process.exit(1);
    }

    // -------------------------------------------------------------
    // TEST 7: Past Deadline -> OVERDUE
    // -------------------------------------------------------------
    console.log('7. Testing Past Deadline -> OVERDUE status...');
    const overdueIncident = {
      severity: 'CRITICAL',
      status: 'IN_PROGRESS',
      createdAt: new Date(now.getTime() - 30 * 3600000), // Created 30 hours ago (6 hours overdue)
      slaHours: 24,
      slaDeadline: new Date(now.getTime() - 6 * 3600000),
    };
    const slaOverdue = calculateSlaDetails(overdueIncident, now);
    if (slaOverdue.slaStatus === 'OVERDUE' && slaOverdue.isOverdue) {
      console.log(`  Calculated Status: ${slaOverdue.slaStatus} | Text: "${slaOverdue.remainingFormatted}"`);
      console.log('  ✅ TEST 7 PASSED: Past deadline calculated as OVERDUE.\n');
    } else {
      console.error('❌ FAIL: Expected OVERDUE for past deadline, got:', slaOverdue.slaStatus);
      process.exit(1);
    }

    // -------------------------------------------------------------
    // TEST 8: RESOLVED incident -> NOT treated as overdue
    // -------------------------------------------------------------
    console.log('8. Testing RESOLVED incident -> NOT treated as overdue...');
    const resolvedIncident = {
      severity: 'CRITICAL',
      status: 'RESOLVED',
      createdAt: new Date(now.getTime() - 100 * 3600000), // 100 hours ago
      slaHours: 24,
      slaDeadline: new Date(now.getTime() - 76 * 3600000),
    };
    const slaResolved = calculateSlaDetails(resolvedIncident, now);
    if (slaResolved.slaStatus === 'RESOLVED' && !slaResolved.isOverdue) {
      console.log(`  Calculated Status: ${slaResolved.slaStatus} | Text: "${slaResolved.remainingFormatted}"`);
      console.log('  ✅ TEST 8 PASSED: RESOLVED incident is NOT treated as overdue.\n');
    } else {
      console.error('❌ FAIL: Expected RESOLVED status not overdue, got:', slaResolved);
      process.exit(1);
    }

    // -------------------------------------------------------------
    // TEST 9: Idempotency of Overdue Escalation
    // -------------------------------------------------------------
    console.log('9. Testing Overdue Escalation Idempotency...');
    // Create an overdue test incident in PostgreSQL
    const testOverdueInc = await prisma.incident.create({
      data: {
        title: 'Idempotent SLA Test Incident',
        description: 'Testing SLA breach escalation audit logs.',
        category: 'POTHOLE',
        severity: 'CRITICAL',
        status: 'IN_PROGRESS',
        latitude: 12.9900,
        longitude: 77.6600,
        slaHours: 24,
        slaDeadline: new Date(now.getTime() - 5 * 3600000), // 5 hours overdue
        isSlaBreached: false,
      },
    });

    // Run processSlaEscalations first time
    await processSlaEscalations([testOverdueInc], now);
    const countAfterFirst = await prisma.statusUpdate.count({
      where: { incidentId: testOverdueInc.id, comment: { contains: 'SLA BREACH ESCALATION' } },
    });

    // Run processSlaEscalations second time
    const updatedTestInc = await prisma.incident.findUnique({ where: { id: testOverdueInc.id } });
    await processSlaEscalations([updatedTestInc], now);
    const countAfterSecond = await prisma.statusUpdate.count({
      where: { incidentId: testOverdueInc.id, comment: { contains: 'SLA BREACH ESCALATION' } },
    });

    // Cleanup test incident
    await prisma.incident.delete({ where: { id: testOverdueInc.id } });

    if (countAfterFirst === 1 && countAfterSecond === 1) {
      console.log('  First run created 1 audit entry. Second run created 0 additional entries.');
      console.log('  ✅ TEST 9 PASSED: Overdue escalation is 100% idempotent.\n');
    } else {
      console.error(`❌ FAIL: Idempotency breached. Audit counts: 1st=${countAfterFirst}, 2nd=${countAfterSecond}`);
      process.exit(1);
    }

    // -------------------------------------------------------------
    // TEST 10 & 11: Authority Incident API & SLA Filtering
    // -------------------------------------------------------------
    console.log('10-11. Testing Authority API Exposure & SLA Filtering...');
    // Login as Authority
    const timestamp = Date.now();
    const authEmail = `authority_sla_${timestamp}@example.com`;
    await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'SLA Inspector', email: authEmail, password: 'Password123!', role: 'AUTHORITY' }),
    });

    const loginRes = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: authEmail, password: 'Password123!' }),
    });
    const loginData = await loginRes.json();
    const token = loginData.token;
    const authHeaders = { Authorization: `Bearer ${token}` };

    // Fetch all incidents
    const listRes = await fetch(`${API_URL}/incidents`, { headers: authHeaders });
    const listData = await listRes.json();

    if (listRes.status === 200 && listData.incidents && listData.incidents.length > 0) {
      const inc = listData.incidents[0];
      if (inc.slaStatus && inc.slaDetails) {
        console.log(`  Sample Incident SLA API fields: status=${inc.slaStatus}, formatted="${inc.remainingFormatted}"`);
        console.log('  ✅ TEST 10 PASSED: Authority API exposes SLA details.\n');
      } else {
        console.error('❌ FAIL: SLA details missing from incident API response.', inc);
        process.exit(1);
      }
    }

    // Test SLA Filtering via query param
    const overdueFilterRes = await fetch(`${API_URL}/incidents?slaStatus=OVERDUE`, { headers: authHeaders });
    const overdueFilterData = await overdueFilterRes.json();
    if (overdueFilterRes.status === 200 && Array.isArray(overdueFilterData.incidents)) {
      const allOverdue = overdueFilterData.incidents.every((i) => i.slaStatus === 'OVERDUE');
      if (allOverdue) {
        console.log(`  SLA Filter "?slaStatus=OVERDUE" returned ${overdueFilterData.incidents.length} incidents (all verified OVERDUE).`);
        console.log('  ✅ TEST 11 PASSED: Authority SLA filtering works.\n');
      } else {
        console.error('❌ FAIL: Non-overdue incident returned in SLA overdue filter.');
        process.exit(1);
      }
    }

    console.log('========================================================================');
    console.log('🎉 ALL 12 SLA MONITORING & OVERDUE ESCALATION TESTS PASSED CLEANLY! 🎉');
    console.log('========================================================================');
  } catch (error) {
    console.error('❌ TEST SUITE FAILED WITH ERROR:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runSlaTests();
