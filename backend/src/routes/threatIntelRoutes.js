import { Router } from 'express';
import { body, param } from 'express-validator';
import { protect, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { rateLimiter } from '../middleware/rateLimiter.js';
import {
  getThreatFeeds,
  searchCVEController,
  getCVEByIdController,
  analyzeIOC,
  getIocHistoryController,
  getIocReportController,
  getThreatIntelDashboard,
  refreshThreatIntelCache,
  getCorrelationReport,
} from '../controllers/threatIntelController.js';
import { ownResource } from '../middleware/tenantIsolation.js';

const router = Router();
router.use(protect);

const tiLimiter = rateLimiter(60 * 1000, 20, 'Too many threat intel requests, slow down');
const iocLimiter = rateLimiter(60 * 1000, 10, 'Too many IOC analyses, slow down');

router.get('/feeds', tiLimiter, getThreatFeeds);
router.get('/dashboard', tiLimiter, getThreatIntelDashboard);

router.post(
  '/analyze',
  iocLimiter,
  validate([
    body('ioc').isString().isLength({ min: 3 }).withMessage('Valid IOC value is required'),
    body('iocType').optional().isIn(['ip', 'domain', 'url', 'hash', 'email', 'cve']).withMessage('Invalid IOC type'),
  ]),
  analyzeIOC
);

router.post(
  '/correlation',
  iocLimiter,
  validate([
    body('iocs').isArray({ min: 1 }).withMessage('Array of IOCs is required'),
  ]),
  getCorrelationReport
);

router.get('/iocs', tiLimiter, getIocHistoryController);
router.get('/iocs/:id', tiLimiter, ownResource('ThreatIntel', 'id', 'user'), getIocReportController);

router.post('/cache/refresh', authorize('admin'), tiLimiter, refreshThreatIntelCache);

router.get('/cve/search', tiLimiter, searchCVEController);
router.get('/cve/:id', tiLimiter, getCVEByIdController);

export default router;
