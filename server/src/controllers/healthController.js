const prisma = require('../config/prisma');

/**
 * GET /api/health
 * Returns server operational status and PostgreSQL/Prisma connection status.
 */
const checkHealth = async (req, res) => {
  let dbStatus = 'disconnected';
  let dbMessage = 'Database connection not established';

  try {
    // Execute a lightweight query to verify PostgreSQL connectivity via Prisma
    await prisma.$queryRaw`SELECT 1`;
    dbStatus = 'connected';
    dbMessage = 'PostgreSQL database connected via Prisma';
  } catch (error) {
    dbStatus = 'error';
    dbMessage = error.message || 'Failed to query database';
  }

  return res.status(200).json({
    success: true,
    message: 'CivicPulse API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    database: {
      status: dbStatus,
      message: dbMessage
    }
  });
};

module.exports = {
  checkHealth
};
