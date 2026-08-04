/**
 * routes/notificationRoutes.js
 * ------------------------------------------------------------
 * REST API for the Notification Center (Phase 3).
 * Mounted at /api/notifications
 * All routes require authentication (protect).
 */
import express from 'express';
import { protect } from '../middleware/auth.js';
import { rateLimiter } from '../middleware/rateLimiter.js';
import {
  getNotifications,
  getUnreadCount,
  markRead,
  markAllRead,
  deleteNotification,
  deleteAllRead,
} from '../controllers/notificationController.js';

const router = express.Router();
router.use(protect);

const notifLimiter = rateLimiter(60 * 1000, 30, 'Too many notification requests, slow down');

router.get('/', notifLimiter, getNotifications);
router.get('/unread-count', notifLimiter, getUnreadCount);
router.post('/mark-read', notifLimiter, markRead);
router.post('/mark-all-read', notifLimiter, markAllRead);
router.delete('/read', notifLimiter, deleteAllRead);
router.delete('/:id', notifLimiter, deleteNotification);

router.post('/:id/read', notifLimiter, markRead);
router.post('/read-all', notifLimiter, markAllRead);

export default router;
