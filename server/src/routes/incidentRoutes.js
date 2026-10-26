const express = require('express');
const router = express.Router();
const {
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
} = require('../controllers/incidentController');
const { authenticateToken, authorizeRoles } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

// Custom Wrapper Middleware for Multer Error Handling
const handleUpload = (req, res, next) => {
  upload.single('image')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          message: 'Uploaded file size exceeds maximum limit of 5MB.',
        });
      }
      return res.status(400).json({
        success: false,
        message: err.message || 'File upload failed.',
      });
    }
    next();
  });
};

// Field Worker Endpoints (Specific static routes before parameterized :id)
router.get('/worker/my', authenticateToken, authorizeRoles('FIELD_WORKER'), getWorkerAssignedIncidents);

// Authority Endpoints
router.get('/stats', authenticateToken, authorizeRoles('AUTHORITY'), getIncidentStats);
router.get('/export', authenticateToken, authorizeRoles('AUTHORITY'), exportIncidents);
router.get('/', authenticateToken, authorizeRoles('AUTHORITY'), getAllIncidents);

// Parameterized Incident Details (Authority & Assigned Worker & Citizen)
router.get('/:id', authenticateToken, getIncidentById);

// Authority Actions
router.patch('/:id/verify', authenticateToken, authorizeRoles('AUTHORITY'), verifyIncident);
router.patch('/:id/assign', authenticateToken, authorizeRoles('AUTHORITY'), assignIncident);
router.patch('/:id/admin-resolve', authenticateToken, authorizeRoles('AUTHORITY'), adminResolveIncident);

// Field Worker Actions
router.patch('/:id/start', authenticateToken, authorizeRoles('FIELD_WORKER'), startWorkOnIncident);
router.post('/:id/updates', authenticateToken, authorizeRoles('FIELD_WORKER'), addProgressUpdate);
router.post('/:id/complete', authenticateToken, authorizeRoles('FIELD_WORKER'), handleUpload, completeWork);

// Citizen Resolution Verification Action
router.patch('/:id/verify-resolution', authenticateToken, authorizeRoles('CITIZEN'), verifyResolutionByCitizen);

module.exports = router;
