import { Router } from 'express';
import { protect, authorize } from '../middleware/auth.js';
import { getAlerts, getAlertById, acknowledgeAlert, getAlertsByUser, getDashboardAlerts } from '../controllers/alertController.js';

const router = Router();

router.use(protect);

/**
 * @openapi
 * /api/alerts:
 *   get:
 *     tags:
 *       - Alerts
 *     summary: List alerts
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: severity
 *         schema:
 *           type: string
 *           enum: [INFO, LOW, MEDIUM, HIGH, CRITICAL]
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [unread, read, acknowledged, resolved]
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: List of alerts
 */
router.get('/', getAlerts);
/**
 * @openapi
 * /api/alerts/dashboard:
 *   get:
 *     tags:
 *       - Alerts
 *     summary: Get alert dashboard summary
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: timeframe
 *         schema:
 *           type: string
 *           enum: [1h, 24h, 7d, 30d]
 *           default: 24h
 *     responses:
 *       200:
 *         description: Dashboard alerts summary
 */
router.get('/dashboard', getDashboardAlerts);
/**
 * @openapi
 * /api/alerts/user:
 *   get:
 *     tags:
 *       - Alerts
 *     summary: Get current user's alerts
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: severity
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: User's alerts
 */
router.get('/user', getAlertsByUser);

/**
 * @openapi
 * /api/alerts/admin/all:
 *   get:
 *     tags:
 *       - Alerts
 *     summary: List all alerts (admin)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: severity
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: All alerts
 */
router.get('/admin/all', authorize('admin'), getAlerts);

/**
 * @openapi
 * /api/alerts/{id}:
 *   get:
 *     tags:
 *       - Alerts
 *     summary: Get alert by ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Alert details
 *       404:
 *         description: Alert not found
 */
router.get('/:id', getAlertById);
/**
 * @openapi
 * /api/alerts/{id}/acknowledge:
 *   patch:
 *     tags:
 *       - Alerts
 *     summary: Acknowledge alert
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Alert acknowledged
 */
router.patch('/:id/acknowledge', acknowledgeAlert);

export default router;