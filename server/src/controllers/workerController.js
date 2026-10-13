const prisma = require('../config/prisma');

/**
 * GET /api/workers
 * Returns active FIELD_WORKER users (AUTHORITY only)
 * Excludes password hashes and sensitive data.
 */
const getWorkers = async (req, res) => {
  try {
    const workers = await prisma.user.findMany({
      where: {
        role: 'FIELD_WORKER',
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        department: true,
        role: true,
        createdAt: true,
      },
      orderBy: { name: 'asc' },
    });

    return res.status(200).json({
      success: true,
      count: workers.length,
      workers,
    });
  } catch (error) {
    console.error('getWorkers Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve field workers.',
    });
  }
};

module.exports = {
  getWorkers,
};
