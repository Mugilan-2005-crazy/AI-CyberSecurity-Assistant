import { Router } from 'express';
import { protect } from '../middleware/auth.js';
import { authorize } from '../middleware/auth.js';
import { investigateIncident } from '../services/response/incidentResponseAgent.js';
import { getPrioritizedActions } from '../services/response/responsePlanner.js';
import { getResponseHistory, getResponseById, updateResponseStatus, getResponsesByUser } from '../services/response/responseHistory.js';
import ApiError from '../utils/ApiError.js';

const router = Router();
router.use(protect);

/**
 * @openapi
 * /api/response/incidents/{id}/analyze:
 *   get:
 *     tags:
 *       - SOAR
 *     summary: Analyze incident with AI
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
 *         description: AI investigation result
 */
router.get('/incidents/:id/analyze', async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const result = await investigateIncident(id, userId);

    res.json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /api/response/incidents/{id}/recommend:
 *   post:
 *     tags:
 *       - SOAR
 *     summary: Get response plan for incident
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
 *         description: Response plan
 */
router.post('/incidents/:id/recommend', async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const plan = getPrioritizedActions(id, userId);

    res.json({
      success: true,
      data: plan,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /api/response/incidents/{id}/approve:
 *   patch:
 *     tags:
 *       - SOAR
 *     summary: Approve or reject response plan (admin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                   type: string
 *                   enum: [approved, executed, rejected]
 *     responses:
 *       200:
 *         description: Response updated
 */
router.patch('/incidents/:id/approve', authorize('admin'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      throw new ApiError(400, 'status is required');
    }

    const validStatuses = ['approved', 'executed', 'rejected'];
    if (!validStatuses.includes(status)) {
      throw new ApiError(400, `Invalid status. Must be one of: ${validStatuses.join(', ')}`);
    }

    const result = await updateResponseStatus(id, status, req.user.id);
    if (!result) {
      throw new ApiError(404, 'Response not found');
    }

    res.json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /api/response/history:
 *   get:
 *     tags:
 *       - SOAR
 *     summary: Get response history
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: incidentId
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
 *         description: Response history
 */
router.get('/history', async (req, res, next) => {
  try {
    const { incidentId, status, page = 1, limit = 20 } = req.query;

    // Security: Non-admin users can only see their own response history.
    // The userId query param is ignored for regular users to prevent IDOR.
    const filterUserId = req.user.role === 'admin' ? (req.query.userId || undefined) : req.user.id;

    const result = await getResponseHistory({
      incidentId,
      userId: filterUserId,
      status,
      page: Number(page),
      limit: Number(limit),
    });

    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /api/response/history/{id}:
 *   get:
 *     tags:
 *       - SOAR
 *     summary: Get response by ID
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
 *         description: Response details
 *       404:
 *         description: Response not found
 */
router.get('/history/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await getResponseById(id);
    if (!result) {
      throw new ApiError(404, 'Response not found');
    }

    // Security: Non-admin users can only view their own responses (IDOR protection).
    if (req.user.role !== 'admin' && result.userId?.toString() !== req.user.id) {
      throw new ApiError(403, 'Not authorized to view this response');
    }

    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /api/response/user/history:
 *   get:
 *     tags:
 *       - SOAR
 *     summary: Get current user's response history
 *     security:
 *       - bearerAuth: []
 *     parameters:
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
 *         description: User's response history
 */
router.get('/user/history', async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const userId = req.user.id;
    const result = await getResponsesByUser(userId, { page: Number(page), limit: Number(limit) });
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /api/response/admin/history:
 *   get:
 *     tags:
 *       - SOAR
 *     summary: Get all response history (admin)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *       - in: query
 *         name: severity
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
 *         description: All response history
 */
router.get('/admin/history', authorize('admin'), async (req, res, next) => {
  try {
    const { status, severity, page = 1, limit = 20 } = req.query;

    const result = await getResponseHistory({
      status,
      severity,
      page: Number(page),
      limit: Number(limit),
    });

    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

export default router;