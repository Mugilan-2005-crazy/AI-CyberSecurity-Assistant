/**
 * routes/executiveRoutes.js
 * ============================================================
 * PHASE 4 — Executive Security Command Center routes.
 * RBAC: admin + security_manager only.
 * All routes are under /api/executive (mounted in app.js).
 */
import { Router } from 'express';
import { protect, authorize } from '../middleware/auth.js';
import { rateLimiter } from '../middleware/rateLimiter.js';
import {
  getSummary,
  getAiSummary,
  getReport,
  getPerformanceMetrics,
} from '../controllers/executiveController.js';

const router = Router();

// All executive routes require authentication AND an executive role.
router.use(protect, authorize('admin', 'security_manager'));

const execLimiter = rateLimiter(60 * 1000, 60, 'Too many executive requests, slow down');

router.get('/summary', execLimiter, getSummary);
router.get('/ai-summary', execLimiter, getAiSummary);
router.get('/report', execLimiter, getReport);
router.get('/metrics', execLimiter, getPerformanceMetrics);

export default router;