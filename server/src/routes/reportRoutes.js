const express = require('express');
const router = express.Router();
const { createReport, getMyReports, getReportById } = require('../controllers/reportController');
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

// POST /api/reports - Citizens only
router.post('/', authenticateToken, authorizeRoles('CITIZEN'), handleUpload, createReport);

// GET /api/reports/my - Logged-in Citizen's reports
router.get('/my', authenticateToken, authorizeRoles('CITIZEN'), getMyReports);

// GET /api/reports/:id - Individual report details
router.get('/:id', authenticateToken, getReportById);

module.exports = router;
