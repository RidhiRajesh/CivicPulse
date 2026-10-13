const express = require('express');
const router = express.Router();
const { getWorkers } = require('../controllers/workerController');
const { authenticateToken, authorizeRoles } = require('../middleware/authMiddleware');

// GET /api/workers - Authority only list of field workers
router.get('/', authenticateToken, authorizeRoles('AUTHORITY'), getWorkers);

module.exports = router;
