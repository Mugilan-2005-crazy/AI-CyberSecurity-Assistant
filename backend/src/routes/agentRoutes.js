/**
 * routes/agentRoutes.js
 * ============================================================
 * Agent API routes.
 * All routes require JWT authentication.
 * @openapi
 * /api/agent/security-insights:
 *   get:
 *     tags:
 *       - AI Security Agent
 *     summary: Get AI-generated security insights
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Security insights
 */
import { Router } from 'express';
import { protect } from '../middleware/auth.js';
import { runSecurityAgent } from '../services/agent/securityAgent.js';

const router = Router();

/**
 * GET /api/agent/security-insights
 * Returns AI-generated security insights for the authenticated user.
 */
router.get('/security-insights', protect, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const result = await runSecurityAgent(userId, {
      device: req.headers['user-agent'] || undefined,
      location: req.ip || undefined,
      language: req.user.language || 'en',
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
