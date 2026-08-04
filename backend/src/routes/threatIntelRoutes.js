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

const router = Router();
router.use(protect);

const tiLimiter = rateLimiter(60 * 1000, 20, 'Too many threat intel requests, slow down');
const iocLimiter = rateLimiter(60 * 1000, 10, 'Too many IOC analyses, slow down');

/**
 * @openapi
 * /api/threat-intel/feeds:
 *   get:
 *     tags:
 *       - Threat Intelligence
 *     summary: Get latest threat feeds and CVEs
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Threat feeds and recent CVEs
 */
router.get('/feeds', tiLimiter, getThreatFeeds);

/**
 * @openapi
 * /api/threat-intel/dashboard:
 *   get:
 *     tags:
 *       - Threat Intelligence
 *     summary: Get threat intelligence dashboard data
 *     security:
 *       - bearerAuth: []
 */
router.get('/dashboard', tiLimiter, getThreatIntelDashboard);

/**
 * @openapi
 * /api/threat-intel/analyze:
 *   post:
 *     tags:
 *       - Threat Intelligence
 *     summary: Analyze an IOC (IP/Domain/URL/Hash/Email/CVE)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - ioc
 *             properties:
 *               ioc:
 *                 type: string
 *               iocType:
 *                 type: string
 *                 enum: [ip, domain, url, hash, email, cve]
 */
router.post(
  '/analyze',
  iocLimiter,
  validate([
    body('ioc').isString().isLength({ min: 3 }).withMessage('Valid IOC value is required'),
    body('iocType').optional().isIn(['ip', 'domain', 'url', 'hash', 'email', 'cve']).withMessage('Invalid IOC type'),
  ]),
  analyzeIOC
);

/**
 * @openapi
 * /api/threat-intel/correlation:
 *   post:
 *     tags:
 *       - Threat Intelligence
 *     summary: Correlate multiple IOCs
 *     security:
 *       - bearerAuth: []
 */
router.post(
  '/correlation',
  iocLimiter,
  validate([
    body('iocs').isArray({ min: 1 }).withMessage('Array of IOCs is required'),
  ]),
  getCorrelationReport
);

/**
 * @openapi
 * /api/threat-intel/iocs:
 *   get:
 *     tags:
 *       - Threat Intelligence
 *     summary: Get IOC lookup history
 *     security:
 *       - bearerAuth: []
 */
router.get('/iocs', tiLimiter, getIocHistoryController);

/**
 * @openapi
 * /api/threat-intel/iocs/:id:
 *   get:
 *     tags:
 *       - Threat Intelligence
 *     summary: Get IOC report by ID
 *     security:
 *       - bearerAuth: []
 */
router.get('/iocs/:id', tiLimiter, getIocReportController);

/**
 * @openapi
 * /api/threat-intel/cache/refresh:
 *   post:
 *     tags:
 *       - Threat Intelligence
 *     summary: Refresh threat intelligence cache
 *     security:
 *       - bearerAuth: []
 */
router.post('/cache/refresh', tiLimiter, refreshThreatIntelCache);

/**
 * @openapi
 * /api/threat-intel/cve/search:
 *   get:
 *     tags:
 *       - Threat Intelligence
 *     summary: Search CVE database
 *     security:
 *       - bearerAuth: []
 */
router.get('/cve/search', tiLimiter, searchCVEController);

/**
 * @openapi
 * /api/threat-intel/cve/:id:
 *   get:
 *     tags:
 *       - Threat Intelligence
 *     summary: Get CVE by ID
 *     security:
 *       - bearerAuth: []
 */
router.get('/cve/:id', tiLimiter, getCVEByIdController);

export default router;
