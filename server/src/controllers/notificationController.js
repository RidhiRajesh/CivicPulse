const prisma = require('../config/prisma');

/**
 * GET /api/notifications
 * Fetch notifications for the authenticated user with pagination and unread count
 */
const getNotifications = async (req, res) => {
  try {
    const userId = req.user.id;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;
    const unreadOnly = req.query.unreadOnly === 'true';

    const whereClause = {
      userId,
      ...(unreadOnly ? { isRead: false } : {}),
    };

    const [notifications, totalCount, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          incident: {
            select: {
              id: true,
              title: true,
              category: true,
              severity: true,
              status: true,
            },
          },
        },
      }),
      prisma.notification.count({ where: whereClause }),
      prisma.notification.count({ where: { userId, isRead: false } }),
    ]);

    return res.status(200).json({
      success: true,
      count: notifications.length,
      totalCount,
      unreadCount,
      page,
      limit,
      totalPages: Math.ceil(totalCount / limit) || 1,
      notifications,
    });
  } catch (error) {
    console.error('getNotifications Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve notifications.',
    });
  }
};

/**
 * PATCH /api/notifications/:id/read
 * Mark a single notification as read (with user ownership authorization)
 */
const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const notification = await prisma.notification.findUnique({
      where: { id },
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found.',
      });
    }

    if (notification.userId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You cannot modify notifications belonging to another user.',
      });
    }

    const updated = await prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });

    return res.status(200).json({
      success: true,
      message: 'Notification marked as read.',
      notification: updated,
    });
  } catch (error) {
    console.error('markAsRead Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update notification.',
    });
  }
};

/**
 * PATCH /api/notifications/read-all
 * Mark all unread notifications for the authenticated user as read
 */
const markAllAsRead = async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await prisma.notification.updateMany({
      where: {
        userId,
        isRead: false,
      },
      data: { isRead: true },
    });

    return res.status(200).json({
      success: true,
      message: `Marked ${result.count} notification(s) as read.`,
      updatedCount: result.count,
    });
  } catch (error) {
    console.error('markAllAsRead Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to mark all notifications as read.',
    });
  }
};

module.exports = {
  getNotifications,
  markAsRead,
  markAllAsRead,
};
