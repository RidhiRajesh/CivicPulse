const express = require('express');
const router = express.Router();
const {
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
} = require('../controllers/incidentController');
const { authenticateToken, authorizeRoles } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

// Field Worker Endpoints (Specific static routes before parameterized :id)
router.get('/worker/my', authenticateToken, authorizeRoles('FIELD_WORKER'), getWorkerAssignedIncidents);

// Authority Endpoints
router.get('/stats', authenticateToken, authorizeRoles('AUTHORITY'), getIncidentStats);
router.get('/', authenticateToken, authorizeRoles('AUTHORITY'), getAllIncidents);

// Parameterized Incident Details (Authority & Assigned Worker & Citizen)
router.get('/:id', authenticateToken, getIncidentById);

// Authority Actions
router.patch('/:id/verify', authenticateToken, authorizeRoles('AUTHORITY'), verifyIncident);
router.patch('/:id/assign', authenticateToken, authorizeRoles('AUTHORITY'), assignIncident);

// Field Worker Actions
router.patch('/:id/start', authenticateToken, authorizeRoles('FIELD_WORKER'), startWorkOnIncident);
router.post('/:id/updates', authenticateToken, authorizeRoles('FIELD_WORKER'), addProgressUpdate);
router.post('/:id/complete', authenticateToken, authorizeRoles('FIELD_WORKER'), upload.single('image'), completeWork);

// Citizen Resolution Verification Action
router.patch('/:id/verify-resolution', authenticateToken, authorizeRoles('CITIZEN'), verifyResolutionByCitizen);

module.exports = router;
