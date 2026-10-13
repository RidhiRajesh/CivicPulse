const express = require('express');
const router = express.Router();
const { checkHealth } = require('../controllers/healthController');

// GET /api/health
router.get('/', checkHealth);

module.exports = router;
