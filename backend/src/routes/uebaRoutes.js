import { Router } from 'express';
import { protect, authorize } from '../middleware/auth.js';
import {
  getUebaDashboard,
  getUserRiskRanking,
  getUserProfile,
  getUserTimeline,
  getUserAnomalies,
  getAnomalyDetail,
  getMyAnomalies,
  getMyProfile,
  runDetection,
  resolveAnomaly,
  getMyRiskScore,
  getRiskTrend,
  getMyTimeline,
  runMyDetection,
} from '../controllers/uebaController.js';

const router = Router();
router.use(protect);

/**
 * @openapi
 * /api/ueba/dashboard:
 *   get:
 *     tags: [UEBA]
 *     summary: Get UEBA dashboard summary (all users risk ranking + metrics)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { success, data: { metrics, riskRanking } }
 */
router.get('/dashboard', authorize('admin', 'security_manager'), getUebaDashboard);

/**
 * @openapi
 * /api/ueba/users/risk-ranking:
 *   get:
 *     tags: [UEBA]
 *     summary: Get user risk ranking
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { success, data: [...] }
 */
router.get('/users/risk-ranking', authorize('admin', 'security_manager'), getUserRiskRanking);

/**
 * @openapi
 * /api/ueba/users/:userId/profile:
 *   get:
 *     tags: [UEBA]
 *     summary: Get a specific user's behavior profile
 *     security:
 *       - bearerAuth: []
 */
router.get('/users/:userId/profile', authorize('admin', 'security_manager'), getUserProfile);

/**
 * @openapi
 * /api/ueba/users/:userId/timeline:
 *   get:
 *     tags: [UEBA]
 *     summary: Get user behavior timeline
 *     security:
 *       - bearerAuth: []
 */
router.get('/users/:userId/timeline', authorize('admin', 'security_manager'), getUserTimeline);

/**
 * @openapi
 * /api/ueba/users/:userId/anomalies:
 *   get:
 *     tags: [UEBA]
 *     summary: Get user risk events/anomalies
 *     security:
 *       - bearerAuth: []
 */
router.get('/users/:userId/anomalies', authorize('admin', 'security_manager'), getUserAnomalies);

/**
 * @openapi
 * /api/ueba/users/:userId/risk-trend:
 *   get:
 *     tags: [UEBA]
 *     summary: Get user risk score trend
 *     security:
 *       - bearerAuth: []
 */
router.get('/users/:userId/risk-trend', authorize('admin', 'security_manager'), getRiskTrend);

/**
 * @openapi
 * /api/ueba/users/:userId/detect:
 *   post:
 *     tags: [UEBA]
 *     summary: Run anomaly detection on a user
 *     security:
 *       - bearerAuth: []
 */
router.post('/users/:userId/detect', authorize('admin', 'security_manager'), runDetection);

/**
 * @openapi
 * /api/ueba/anomalies:
 *   get:
 *     tags: [UEBA]
 *     summary: Get all anomalies (admin)
 *     security:
 *       - bearerAuth: []
 */
router.get('/anomalies', authorize('admin', 'security_manager'), async (req, res, next) => {
  try {
    const { status, severity, page = 1, limit = 50 } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (severity) filter.severity = severity;
    const result = await UserRiskEvent.find(filter)
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit))
      .populate('userId', 'name email role');
    const total = await UserRiskEvent.countDocuments(filter);
    res.json({ success: true, data: result.map((e) => ({ id: e._id, userId: e.userId, eventType: e.eventType, severity: e.severity, riskScore: e.riskScore, title: e.title, description: e.description, status: e.status, createdAt: e.createdAt })), total, page: Number(page), totalPages: Math.ceil(total / Number(limit)) });
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /api/ueba/anomaly/{id}:
 *   get:
 *     tags: [UEBA]
 *     summary: Get anomaly detail by ID
 *     security:
 *       - bearerAuth: []
 */
router.get('/anomaly/:id', getAnomalyDetail);

/**
 * @openapi
 * /api/ueba/anomaly/{id}/resolve:
 *   patch:
 *     tags: [UEBA]
 *     summary: Resolve/dismiss an anomaly
 *     security:
 *       - bearerAuth: []
 */
router.patch('/anomaly/:id/resolve', authorize('admin', 'security_manager'), resolveAnomaly);

// User self-service endpoints (limited access)
router.get('/me/profile', getMyProfile);
router.get('/me/anomalies', getMyAnomalies);
router.get('/me/risk-score', getMyRiskScore);
router.get('/me/timeline', getMyTimeline);
router.post('/me/detect', runMyDetection);

export default router;
