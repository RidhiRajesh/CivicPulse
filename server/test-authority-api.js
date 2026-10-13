const prisma = require('./src/config/prisma');

const API_URL = 'http://localhost:5000/api';

async function runAuthorityTests() {
  console.log('=== STARTING AUTHORITY DASHBOARD & APIS VERIFICATION TEST SUITE ===\n');

  try {
    // 1. Unauthenticated Request Check
    console.log('1. Testing Unauthenticated Access to GET /api/incidents...');
    const unauthRes = await fetch(`${API_URL}/incidents`);
    if (unauthRes.status === 401) {
      console.log('  ✅ PASSED: 401 Unauthorized returned for missing token.\n');
    } else {
      console.error('❌ FAIL: Expected 401 status but received:', unauthRes.status);
      process.exit(1);
    }

    // 2. Citizen Access Check (Forbidden)
    console.log('2. Testing Citizen Role Access (Forbidden RBAC check)...');
    const citizenEmail = `citizen_test_${Date.now()}@example.com`;
    await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test Citizen',
        email: citizenEmail,
        password: 'Password123!',
        role: 'CITIZEN',
      }),
    });

    const citizenLoginRes = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: citizenEmail,
        password: 'Password123!',
      }),
    });
    const citizenData = await citizenLoginRes.json();
    const citizenToken = citizenData.token;

    const citizenAccessRes = await fetch(`${API_URL}/incidents`, {
      headers: { Authorization: `Bearer ${citizenToken}` },
    });

    if (citizenAccessRes.status === 403) {
      console.log('  ✅ PASSED: 403 Forbidden returned for Citizen role.\n');
    } else {
      console.error('❌ FAIL: Expected 403 Forbidden but received:', citizenAccessRes.status);
      process.exit(1);
    }

    // 3. Register & Login Authority User
    console.log('3. Registering & Authenticating Authority User...');
    const authEmail = `authority_test_${Date.now()}@example.com`;
    const regRes = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Commissioner Public Works',
        email: authEmail,
        password: 'AuthorityPassword123!',
        role: 'AUTHORITY',
        department: 'Roads & Public Infrastructure',
      }),
    });
    const regData = await regRes.json();
    console.log('  Registered Authority User:', regData.user?.email);

    const authLoginRes = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: authEmail,
        password: 'AuthorityPassword123!',
      }),
    });
    const authData = await authLoginRes.json();
    const authorityToken = authData.token;
    console.log('  ✅ PASSED: Authority login successful, JWT token acquired.\n');

    const authHeaders = {
      Authorization: `Bearer ${authorityToken}`,
      'Content-Type': 'application/json',
    };

    // 4. Test GET /api/incidents/stats
    console.log('4. Testing GET /api/incidents/stats (Summary Metrics)...');
    const statsRes = await fetch(`${API_URL}/incidents/stats`, { headers: authHeaders });
    const statsData = await statsRes.json();
    if (statsRes.status === 200 && statsData.success && statsData.stats) {
      console.log('  Stats Data:', statsData.stats);
      console.log('  ✅ PASSED: GET /api/incidents/stats succeeded.\n');
    } else {
      console.error('❌ FAIL: Invalid stats response payload.', statsData);
      process.exit(1);
    }

    // 5. Test GET /api/incidents
    console.log('5. Testing GET /api/incidents (Prioritized List)...');
    const listRes = await fetch(`${API_URL}/incidents`, { headers: authHeaders });
    const listData = await listRes.json();
    if (listRes.status === 200 && listData.success && Array.isArray(listData.incidents)) {
      console.log(`  Fetched ${listData.incidents.length} correlated incidents.`);
      if (listData.incidents.length > 0) {
        const first = listData.incidents[0];
        console.log(`  Top Incident: "${first.title}" | Score: ${first.priorityScore} | Status: ${first.status}`);
      }
      console.log('  ✅ PASSED: GET /api/incidents succeeded.\n');
    } else {
      console.error('❌ FAIL: Invalid incidents list payload.', listData);
      process.exit(1);
    }

    // 6. Test GET /api/incidents/:id & Verification
    let incidentIdToVerify = null;
    if (listData.incidents.length > 0) {
      const reportedInc = listData.incidents.find((i) => i.status === 'REPORTED');
      if (reportedInc) incidentIdToVerify = reportedInc.id;
    }

    // If no REPORTED incident exists, create a citizen report so correlation creates one
    if (!incidentIdToVerify) {
      console.log('  No existing REPORTED incident found. Creating a test citizen report to create an incident...');
      const createRepRes = await fetch(`${API_URL}/reports`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${citizenToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: 'Damaged Drainage Grate near Metro Station',
          category: 'DRAINAGE',
          description: 'Deep open drainage pit posing immediate hazard to pedestrians.',
          latitude: 12.9800,
          longitude: 77.6000,
          address: 'MG Road Metro Station',
        }),
      });
      const repData = await createRepRes.json();
      incidentIdToVerify = repData.report.incidentId;
      console.log(`  Created test report under incident ID: ${incidentIdToVerify}\n`);
    }

    console.log(`6. Testing GET /api/incidents/${incidentIdToVerify} (Details)...`);
    const detailRes = await fetch(`${API_URL}/incidents/${incidentIdToVerify}`, { headers: authHeaders });
    const detailData = await detailRes.json();
    if (detailRes.status === 200 && detailData.incident) {
      console.log(`  Fetched Incident: ${detailData.incident.title}`);
      console.log(`  Linked Reports Count: ${detailData.incident.reports?.length}`);
      console.log(`  Priority Breakdown: Base ${detailData.incident.priorityBreakdown?.baseSeverityScore}, Impact ${detailData.incident.priorityBreakdown?.communityImpactMultiplier}x`);
      console.log('  ✅ PASSED: GET /api/incidents/:id details fetched.\n');
    } else {
      console.error('❌ FAIL: Could not fetch incident details.', detailData);
      process.exit(1);
    }

    // 7. Test PATCH /api/incidents/:id/verify
    console.log(`7. Testing PATCH /api/incidents/${incidentIdToVerify}/verify (Verification Action)...`);
    const verifyRes = await fetch(`${API_URL}/incidents/${incidentIdToVerify}/verify`, {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({ comment: 'Verified on-site by Authority Field Inspector.' }),
    });
    const verifyData = await verifyRes.json();

    if (verifyRes.status === 200 && verifyData.incident?.status === 'VERIFIED') {
      console.log('  Incident state transitioned to VERIFIED successfully.');
      console.log('  ✅ PASSED: PATCH /api/incidents/:id/verify succeeded.\n');
    } else {
      console.error('❌ FAIL: Verification failed.', verifyData);
      process.exit(1);
    }

    // 8. Re-verification double test (expect 400 Bad Request)
    console.log('8. Testing Double Verification Rejection (Expect 400 Bad Request)...');
    const doubleVerifyRes = await fetch(`${API_URL}/incidents/${incidentIdToVerify}/verify`, {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({ comment: 'Duplicate verify attempt' }),
    });
    const doubleVerifyData = await doubleVerifyRes.json();

    if (doubleVerifyRes.status === 400) {
      console.log(`  Received 400 message: "${doubleVerifyData.message}"`);
      console.log('  ✅ PASSED: 400 Bad Request returned for duplicate verification attempt.\n');
    } else {
      console.error('❌ FAIL: Expected 400 Bad Request for duplicate verify but received:', doubleVerifyRes.status);
      process.exit(1);
    }

    console.log('=====================================================================');
    console.log('🎉 ALL AUTHORITY DASHBOARD & API VERIFICATION TESTS PASSED CLEANLY! 🎉');
    console.log('=====================================================================');
  } catch (error) {
    console.error('❌ TEST SUITE FAILED WITH ERROR:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runAuthorityTests();
