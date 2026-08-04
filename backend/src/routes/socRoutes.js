import { Router } from 'express';
import { body } from 'express-validator';
import { protect, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { rateLimiter } from '../middleware/rateLimiter.js';
import { getSocMetrics, getTopThreats, getRecentIncidents, getRiskTrend } from '../services/soc/socAnalytics.js';
import { createIncident, getIncidentById, getIncidentsByUser, updateIncidentStatus, getAllIncidents } from '../services/soc/incidentTracker.js';
import { getAnalysisHistory, getAnalysisById, reopenAnalysis, getAnalysisStats } from '../services/ai/socAnalyzer.js';
import ApiError from '../utils/ApiError.js';

const router = Router();
router.use(protect);

const socLimiter = rateLimiter(60 * 1000, 30, 'Too many SOC requests, slow down');

router.get('/dashboard', authorize('admin'), socLimiter, async (req, res, next) => {
  try {
    const [metrics, topThreats, recent, trend] = await Promise.all([
      getSocMetrics(),
      getTopThreats(5),
      getRecentIncidents(10),
      getRiskTrend(undefined, 30),
    ]);
    const criticalAlerts = metrics.criticalIncidents || 0;
    const totalThreats = metrics.threatsDetected || 0;
    const topThreatsList = topThreats.map((t) => ({ type: t.type, count: t.count, avgRiskScore: t.avgRiskScore }));
    const recentIncidents = recent.map((inc) => ({ id: inc.id, userId: inc.userId, threatType: inc.threatType, mitreTechnique: inc.mitreTechnique, severity: inc.severity, status: inc.status, createdAt: inc.createdAt }));
    res.json({ success: true, data: { totalThreats, criticalAlerts, riskTrend: trend, topThreats: topThreatsList, recentIncidents, verdictDistribution: metrics.verdictDistribution || [], openIncidents: metrics.openIncidents || 0, resolvedIncidents: metrics.resolvedIncidents || 0 } });
  } catch (err) { next(err); }
});

router.get('/metrics', authorize('admin'), socLimiter, async (req, res, next) => {
  try {
    const metrics = await getSocMetrics();
    res.json({ success: true, data: metrics });
  } catch (err) { next(err); }
});

router.post('/incidents', authorize('admin'), socLimiter, validate([
  body('userId').isMongoId().withMessage('Valid userId is required'),
  body('threatType').isString().isLength({ min: 2 }).withMessage('threatType is required'),
  body('severity').optional().isIn(['Low', 'Medium', 'High', 'Critical']).withMessage('Invalid severity'),
]), async (req, res, next) => {
  try {
    const { userId, threatType, mitreTechnique, severity, description } = req.body;
    const incident = await createIncident({ userId, threatType, mitreTechnique: mitreTechnique || {}, severity: severity || 'Medium', description: description || '', metadata: {} });
    res.status(201).json({ success: true, data: incident });
  } catch (err) { next(err); }
});

router.get('/incidents', authorize('admin'), socLimiter, async (req, res, next) => {
  try {
    const { status, severity, userId, page = 1, limit = 20 } = req.query;
    const options = { status, severity, userId, page: Number(page), limit: Number(limit) };
    const result = await getAllIncidents(options);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

router.get('/incidents/:id', authorize('admin'), socLimiter, async (req, res, next) => {
  try {
    const { id } = req.params;
    const incident = await getIncidentById(id);
    if (!incident) { throw new ApiError(404, 'Incident not found'); }
    res.json({ success: true, data: incident });
  } catch (err) { next(err); }
});

router.patch('/incidents/:id/status', authorize('admin'), socLimiter, validate([
  body('status').isString().isLength({ min: 2 }).withMessage('status is required'),
]), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, resolvedAt } = req.body;
    const incident = await updateIncidentStatus(id, status, resolvedAt ? new Date(resolvedAt) : null);
    if (!incident) { throw new ApiError(404, 'Incident not found'); }
    res.json({ success: true, data: incident });
  } catch (err) { next(err); }
});

router.get('/user/incidents', socLimiter, async (req, res, next) => {
  try {
    const { status, severity, page = 1, limit = 20 } = req.query;
    const userId = req.user.id;
    const options = { status, severity, page: Number(page), limit: Number(limit) };
    const result = await getIncidentsByUser(userId, options);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

router.get('/ai/history', socLimiter, async (req, res, next) => {
  try {
    const { page, limit, status, scanType, riskLevel } = req.query;
    const userId = req.user.id;
    const result = await getAnalysisHistory(userId, { page, limit, status, scanType, riskLevel });
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

router.get('/ai/:id', socLimiter, async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const analysis = await getAnalysisById(id, userId);
    if (!analysis) { throw new ApiError(404, 'AI analysis not found'); }
    res.json({
      success: true,
      data: {
        id: analysis._id,
        scanId: analysis.scanId,
        scanType: analysis.scanType,
        scanInput: analysis.scanInput,
        threatScore: analysis.threatScore,
        riskLevel: analysis.riskLevel,
        confidenceScore: analysis.confidenceScore,
        executiveSummary: analysis.executiveSummary,
        technicalSummary: analysis.technicalSummary,
        rootCause: analysis.rootCause,
        businessImpact: analysis.businessImpact,
        recommendedActions: analysis.recommendedActions,
        mitreTechniques: analysis.mitreTechniques,
        cvssScore: analysis.cvssScore,
        cvssVector: analysis.cvssVector,
        aiProvider: analysis.aiProvider,
        aiProvidersUsed: analysis.aiProvidersUsed,
        status: analysis.status,
        createdAt: analysis.createdAt,
      },
    });
  } catch (err) { next(err); }
});

router.post('/ai/:id/reopen', socLimiter, async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const analysis = await reopenAnalysis(id, userId);
    if (!analysis) { throw new ApiError(404, 'AI analysis not found'); }
    res.json({ success: true, data: { id: analysis._id, status: analysis.status, message: 'Analysis reopened for review' } });
  } catch (err) { next(err); }
});

router.get('/ai/stats', socLimiter, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const stats = await getAnalysisStats(userId);
    res.json({ success: true, data: stats });
  } catch (err) { next(err); }
});

export default router;