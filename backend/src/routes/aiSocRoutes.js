import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { protect, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { rateLimiter } from '../middleware/rateLimiter.js';
import { analyzeScan, getAnalysisHistory, getAnalysisById, reopenAnalysis, getAnalysisStats } from '../services/ai/socAnalyzer.js';
import ApiError from '../utils/ApiError.js';
import logger from '../utils/logger.js';

const router = Router();
router.use(protect);

const socAiLimiter = rateLimiter(60 * 1000, 20, 'Too many AI SOC requests, slow down');

router.post('/analyze', socAiLimiter, validate([
  body('scanId').isMongoId().withMessage('Valid scanId is required'),
]), async (req, res, next) => {
  try {
    const { scanId } = req.body;
    const userId = req.user.id;

    const analysis = await analyzeScan(scanId, userId);

    res.status(201).json({
      success: true,
      data: {
        id: analysis._id,
        scanId: analysis.scanId,
        scanType: analysis.scanType,
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
      },
    });
  } catch (err) {
    logger.error(`[aiSocRoutes] Analysis error: ${err.message}`);
    next(err);
  }
});

router.get('/history', socAiLimiter, validate([
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('status').optional().isIn(['pending', 'completed', 'failed', 'reopened']),
  query('scanType').optional().isIn(['url', 'password', 'email', 'file', 'qr']),
  query('riskLevel').optional().isIn(['Low', 'Medium', 'High', 'Critical']),
]), async (req, res, next) => {
  try {
    const { page, limit, status, scanType, riskLevel } = req.query;
    const userId = req.user.id;

    const result = await getAnalysisHistory(userId, { page, limit, status, scanType, riskLevel });

    res.json({ success: true, data: result });
  } catch (err) {
    logger.error(`[aiSocRoutes] History error: ${err.message}`);
    next(err);
  }
});

router.get('/:id', socAiLimiter, validate([
  param('id').isMongoId().withMessage('Valid analysis ID is required'),
]), async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const analysis = await getAnalysisById(id, userId);
    if (!analysis) {
      throw new ApiError(404, 'AI analysis not found');
    }

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
        cvssVersion: analysis.cvssVersion,
        aiProvider: analysis.aiProvider,
        aiProvidersUsed: analysis.aiProvidersUsed,
        geminiContribution: analysis.geminiContribution,
        ollamaContribution: analysis.ollamaContribution,
        status: analysis.status,
        createdAt: analysis.createdAt,
        updatedAt: analysis.updatedAt,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/reopen', socAiLimiter, validate([
  param('id').isMongoId().withMessage('Valid analysis ID is required'),
]), async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const analysis = await reopenAnalysis(id, userId);
    if (!analysis) {
      throw new ApiError(404, 'AI analysis not found');
    }

    res.json({
      success: true,
      data: {
        id: analysis._id,
        status: analysis.status,
        message: 'Analysis reopened for review',
      },
    });
  } catch (err) {
    next(err);
  }
});

router.get('/stats', socAiLimiter, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const stats = await getAnalysisStats(userId);

    res.json({ success: true, data: stats });
  } catch (err) {
    next(err);
  }
});

router.post('/scan/:scanId/analyze', socAiLimiter, validate([
  param('scanId').isMongoId().withMessage('Valid scanId is required'),
]), async (req, res, next) => {
  try {
    const { scanId } = req.params;
    const userId = req.user.id;

    const analysis = await analyzeScan(scanId, userId);

    res.status(201).json({
      success: true,
      data: {
        id: analysis._id,
        scanId: analysis.scanId,
        scanType: analysis.scanType,
        threatScore: analysis.threatScore,
        riskLevel: analysis.riskLevel,
        confidenceScore: analysis.confidenceScore,
        executiveSummary: analysis.executiveSummary,
        recommendedActions: analysis.recommendedActions,
        mitreTechniques: analysis.mitreTechniques,
        cvssScore: analysis.cvssScore,
        aiProvider: analysis.aiProvider,
        status: analysis.status,
      },
    });
  } catch (err) {
    logger.error(`[aiSocRoutes] Auto-analyze error: ${err.message}`);
    next(err);
  }
});

export default router;