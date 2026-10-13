const prisma = require('./src/config/prisma');

const API_URL = 'http://localhost:5000/api';

async function runCitizenVerificationTests() {
  console.log('=== STARTING CITIZEN RESOLUTION VERIFICATION & REOPEN TEST SUITE ===\n');

  try {
    // 1. Setup Test Users: Associated Citizen, Unrelated Citizen, Authority, Field Worker
    console.log('1. Setting up test actors (Associated Citizen, Unrelated Citizen, Authority, Worker)...');
    const timestamp = Date.now();

    const citizenAEmail = `citizen_a_${timestamp}@example.com`;
    const citizenBEmail = `citizen_b_${timestamp}@example.com`;
    const authorityEmail = `authority_verif_${timestamp}@example.com`;
    const workerEmail = `worker_verif_${timestamp}@example.com`;

    // Register users
    await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Citizen A (Creator)', email: citizenAEmail, password: 'Password123!', role: 'CITIZEN' }),
    });

    await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Citizen B (Unrelated)', email: citizenBEmail, password: 'Password123!', role: 'CITIZEN' }),
    });

    await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Authority User', email: authorityEmail, password: 'Password123!', role: 'AUTHORITY', department: 'Roads' }),
    });

    await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Field Worker', email: workerEmail, password: 'Password123!', role: 'FIELD_WORKER', department: 'Roads' }),
    });

    // Login users to get tokens
    const loginUser = async (email) => {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: 'Password123!' }),
      });
      const data = await res.json();
      return data.token;
    };

    const tokenA = await loginUser(citizenAEmail);
    const tokenB = await loginUser(citizenBEmail);
    const tokenAuth = await loginUser(authorityEmail);
    const tokenWorker = await loginUser(workerEmail);

    console.log('  ✅ Tokens acquired for Citizen A, Citizen B, Authority, and Field Worker.\n');

    // 2. Citizen A creates a report (incident created)
    console.log('2. Citizen A creates a report (creating Incident #1)...');
    const report1Res = await fetch(`${API_URL}/reports`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Massive Pothole on Indiranagar 100ft Road',
        category: 'POTHOLE',
        description: 'Large deep hole in asphalt dangerous for bikes.',
        latitude: 12.9780,
        longitude: 77.6400,
        address: '100ft Road Indiranagar',
      }),
    });
    const report1Data = await report1Res.json();
    const incident1Id = report1Data.report.incidentId;
    console.log(`  Created Incident #1 ID: ${incident1Id}\n`);

    // 3. Complete Lifecycle for Incident #1 to reach RESOLVED_PENDING_VERIFICATION
    console.log('3. Advancing Incident #1 lifecycle: REPORTED -> VERIFIED -> ASSIGNED -> IN_PROGRESS -> RESOLVED_PENDING_VERIFICATION...');

    // Authority Verifies
    await fetch(`${API_URL}/incidents/${incident1Id}/verify`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${tokenAuth}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ comment: 'Verified by authority' }),
    });

    // Authority Assigns Worker
    const meWorkerRes = await fetch(`${API_URL}/auth/me`, { headers: { Authorization: `Bearer ${tokenWorker}` } });
    const meWorkerData = await meWorkerRes.json();
    const workerId = meWorkerData.user.id;

    await fetch(`${API_URL}/incidents/${incident1Id}/assign`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${tokenAuth}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ workerId, notes: 'Fix road pothole' }),
    });

    // Worker Starts Work
    await fetch(`${API_URL}/incidents/${incident1Id}/start`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${tokenWorker}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ comment: 'Started repair' }),
    });

    // Worker Completes Work
    const complete1Res = await fetch(`${API_URL}/incidents/${incident1Id}/complete`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenWorker}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ workNotes: 'Pothole filled with cold asphalt mix.', afterImageUrl: '/uploads/proof1.jpg' }),
    });
    const complete1Data = await complete1Res.json();
    console.log(`  Incident #1 status: ${complete1Data.incident.status}`);
    console.log('  ✅ Incident #1 is now RESOLVED_PENDING_VERIFICATION.\n');

    // 4. TEST 7 & TEST 8: Role Restrictions (Authority & Worker hit citizen endpoint)
    console.log('4. Testing Role Restrictions (Authority and Worker hitting citizen verification endpoint)...');
    const authAttemptRes = await fetch(`${API_URL}/incidents/${incident1Id}/verify-resolution`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${tokenAuth}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirmed: true }),
    });
    if (authAttemptRes.status === 403) {
      console.log('  ✅ TEST 7 PASSED: Authority denied (403 Forbidden).');
    } else {
      console.error('❌ FAIL: Expected 403 for Authority attempt but got:', authAttemptRes.status);
      process.exit(1);
    }

    const workerAttemptRes = await fetch(`${API_URL}/incidents/${incident1Id}/verify-resolution`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${tokenWorker}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirmed: true }),
    });
    if (workerAttemptRes.status === 403) {
      console.log('  ✅ TEST 8 PASSED: Field Worker denied (403 Forbidden).\n');
    } else {
      console.error('❌ FAIL: Expected 403 for Worker attempt but got:', workerAttemptRes.status);
      process.exit(1);
    }

    // 5. TEST 2: Unrelated Citizen Verification Attempt
    console.log('5. Testing Unrelated Citizen B attempting verification on Incident #1...');
    const citizenBRes = await fetch(`${API_URL}/incidents/${incident1Id}/verify-resolution`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${tokenB}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirmed: true }),
    });
    if (citizenBRes.status === 403) {
      console.log('  ✅ TEST 2 PASSED: Unrelated Citizen B denied (403 Forbidden).\n');
    } else {
      console.error('❌ FAIL: Expected 403 for Unrelated Citizen but got:', citizenBRes.status);
      process.exit(1);
    }

    // 6. TEST 3: Associated Citizen A Confirms Resolution (YES -> RESOLVED)
    console.log('6. Testing Associated Citizen A confirming resolution (confirmed: true)...');
    const citizenARes = await fetch(`${API_URL}/incidents/${incident1Id}/verify-resolution`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirmed: true, reason: 'Pothole is completely filled.' }),
    });
    const citizenAData = await citizenARes.json();
    if (citizenARes.status === 200 && citizenAData.incident.status === 'RESOLVED') {
      console.log(`  Response message: "${citizenAData.message}"`);
      console.log('  ✅ TEST 3 PASSED: Status transitioned RESOLVED_PENDING_VERIFICATION -> RESOLVED.\n');
    } else {
      console.error('❌ FAIL: Confirmation failed:', citizenAData);
      process.exit(1);
    }

    // 7. TEST 5: Duplicate Verification Attempt by Citizen A
    console.log('7. Testing Duplicate Verification Attempt by Citizen A...');
    const dupRes = await fetch(`${API_URL}/incidents/${incident1Id}/verify-resolution`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirmed: true }),
    });
    const dupData = await dupRes.json();
    if (dupRes.status === 400) {
      console.log(`  Received 400 Bad Request message: "${dupData.message}"`);
      console.log('  ✅ TEST 5 PASSED: Duplicate verification rejected.\n');
    } else {
      console.error('❌ FAIL: Expected 400 Bad Request for duplicate verification but got:', dupRes.status);
      process.exit(1);
    }

    // 8. TEST 4: Reopen Workflow (Citizen rejects resolution -> REOPENED)
    console.log('8. Testing Reopen Workflow on Incident #2 (confirmed: false)...');
    // Create Incident #2 with Citizen A
    const report2Res = await fetch(`${API_URL}/reports`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Overflowing Garbage Bin at Market',
        category: 'GARBAGE',
        description: 'Trash spilling onto street.',
        latitude: 12.9820,
        longitude: 77.6450,
        address: 'Russell Market',
      }),
    });
    const report2Data = await report2Res.json();
    const incident2Id = report2Data.report.incidentId;

    // Advance Incident #2 to RESOLVED_PENDING_VERIFICATION
    await fetch(`${API_URL}/incidents/${incident2Id}/verify`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${tokenAuth}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ comment: 'Verified' }),
    });

    await fetch(`${API_URL}/incidents/${incident2Id}/assign`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${tokenAuth}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ workerId, notes: 'Clear garbage' }),
    });

    await fetch(`${API_URL}/incidents/${incident2Id}/start`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${tokenWorker}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ comment: 'Work started' }),
    });

    await fetch(`${API_URL}/incidents/${incident2Id}/complete`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenWorker}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ workNotes: 'Garbage cleared.', afterImageUrl: '/uploads/proof2.jpg' }),
    });

    // Citizen A Rejects (confirmed: false)
    const rejectRes = await fetch(`${API_URL}/incidents/${incident2Id}/verify-resolution`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirmed: false, reason: 'Garbage is still spilling onto side pavement.' }),
    });
    const rejectData = await rejectRes.json();
    if (rejectRes.status === 200 && rejectData.incident.status === 'REOPENED') {
      console.log(`  Response message: "${rejectData.message}"`);
      console.log('  ✅ TEST 4 PASSED: Status transitioned RESOLVED_PENDING_VERIFICATION -> REOPENED.\n');
    } else {
      console.error('❌ FAIL: Reopen failed:', rejectData);
      process.exit(1);
    }

    // 9. TEST 6: Verification attempted while incident is IN_PROGRESS (expect 400 Bad Request)
    console.log('9. Testing Verification attempt while incident is IN_PROGRESS...');
    // Create Incident #3 and advance to IN_PROGRESS
    const report3Res = await fetch(`${API_URL}/reports`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Broken Streetlight on 5th Main',
        category: 'STREETLIGHT',
        description: 'Dark alleyway near school.',
        latitude: 12.9850,
        longitude: 77.6500,
        address: '5th Main Road',
      }),
    });
    const report3Data = await report3Res.json();
    const incident3Id = report3Data.report.incidentId;

    await fetch(`${API_URL}/incidents/${incident3Id}/verify`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${tokenAuth}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ comment: 'Verified' }),
    });

    await fetch(`${API_URL}/incidents/${incident3Id}/assign`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${tokenAuth}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ workerId, notes: 'Fix light' }),
    });

    await fetch(`${API_URL}/incidents/${incident3Id}/start`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${tokenWorker}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ comment: 'Work started' }),
    });

    // Attempt verification while IN_PROGRESS
    const earlyVerifyRes = await fetch(`${API_URL}/incidents/${incident3Id}/verify-resolution`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirmed: true }),
    });
    const earlyVerifyData = await earlyVerifyRes.json();

    if (earlyVerifyRes.status === 400) {
      console.log(`  Received 400 message: "${earlyVerifyData.message}"`);
      console.log('  ✅ TEST 6 PASSED: Verification rejected for IN_PROGRESS status.\n');
    } else {
      console.error('❌ FAIL: Expected 400 Bad Request but received:', earlyVerifyRes.status);
      process.exit(1);
    }

    console.log('=============================================================================');
    console.log('🎉 ALL CITIZEN RESOLUTION VERIFICATION & REOPEN TESTS PASSED CLEANLY! 🎉');
    console.log('=============================================================================');
  } catch (error) {
    console.error('❌ TEST SUITE FAILED WITH ERROR:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runCitizenVerificationTests();
