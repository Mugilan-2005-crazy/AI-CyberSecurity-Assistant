/**
 * controllers/notificationController.js
 * ------------------------------------------------------------
 * REST API for the Notification Center (Phase 3).
 * Supports: list (with filter), mark read, mark all read,
 * delete, unread count, and category-based filtering.
 * All endpoints require authentication.
 */
import Notification from '../models/Notification.js';
import { getIoInstance } from '../socket/socketServer.js';
import { dispatchToUser } from '../socket/eventDispatcher.js';
import { EVENTS } from '../socket/socketEvents.js';
import ApiError from '../utils/ApiError.js';
import logger from '../utils/logger.js';

export const getNotifications = async (req, res, next) => {
  try {
    const { category, severity, read, page = 1, limit = 50, search } = req.query;
    const userId = req.user.id;

    const filter = { user: userId };
    if (category) filter.category = category;
    if (severity) filter.severity = severity;
    if (typeof read === 'boolean') filter.read = read;
    if (typeof read === 'string') filter.read = read === 'true';
    if (search) filter.title = { $regex: search, $options: 'i' };

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(Number(limit)),
      Notification.countDocuments(filter),
      Notification.countDocuments({ user: userId, read: false }),
    ]);

    res.json({
      success: true,
      notifications: notifications.map((n) => ({
        id: n._id,
        title: n.title,
        message: n.message,
        type: n.type,
        category: n.category,
        severity: n.severity,
        read: n.read,
        metadata: n.metadata,
        createdAt: n.createdAt,
        updatedAt: n.updatedAt,
      })),
      total,
      unreadCount,
      page: Number(page),
      totalPages: Math.ceil(total / Number(limit)),
    });
  } catch (err) {
    logger.error('[notificationController] Failed to get notifications', { error: err.message });
    next(err);
  }
};

export const getUnreadCount = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const count = await Notification.countDocuments({ user: userId, read: false });
    res.json({ success: true, count });
  } catch (err) {
    logger.error('[notificationController] Failed to get unread count', { error: err.message });
    next(err);
  }
};

export const markRead = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const notification = await Notification.findOneAndUpdate(
      { _id: id, user: userId, read: false },
      { read: true },
      { new: true }
    );

    if (!notification) {
      throw new ApiError(404, 'Notification not found');
    }

    const io = getIoInstance();
    if (io) {
      dispatchToUser(io, userId, EVENTS.NOTIFICATION_READ, { id, read: true });
      const unreadCount = await Notification.countDocuments({ user: userId, read: false });
      dispatchToUser(io, userId, EVENTS.NOTIFICATION_UNREAD_COUNT, { count: unreadCount });
    }

    res.json({ success: true, message: 'Notification marked as read' });
  } catch (err) {
    logger.error('[notificationController] Mark read failed', { error: err.message });
    next(err);
  }
};

export const markAllRead = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const result = await Notification.updateMany(
      { user: userId, read: false },
      { read: true }
    );

    const io = getIoInstance();
    if (io) {
      dispatchToUser(io, userId, EVENTS.NOTIFICATION_UNREAD_COUNT, { count: 0 });
    }

    res.json({ success: true, message: `${result.modifiedCount} notifications marked as read` });
  } catch (err) {
    logger.error('[notificationController] Mark all read failed', { error: err.message });
    next(err);
  }
};

export const deleteNotification = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const notification = await Notification.findOneAndDelete({ _id: id, user: userId });
    if (!notification) {
      throw new ApiError(404, 'Notification not found');
    }

    const io = getIoInstance();
    if (io) {
      dispatchToUser(io, userId, EVENTS.NOTIFICATION_DELETED, { id });
    }

    res.json({ success: true, message: 'Notification deleted' });
  } catch (err) {
    logger.error('[notificationController] Delete failed', { error: err.message });
    next(err);
  }
};

export const deleteAllRead = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const result = await Notification.deleteMany({ user: userId, read: true });
    res.json({ success: true, message: `${result.deletedCount} notifications deleted` });
  } catch (err) {
    logger.error('[notificationController] Delete all read failed', { error: err.message });
    next(err);
  }
};

export default {
  getNotifications,
  getUnreadCount,
  markRead,
  markAllRead,
  deleteNotification,
  deleteAllRead,
};
