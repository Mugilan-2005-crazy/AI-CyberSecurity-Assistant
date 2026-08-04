import { Router } from 'express';
import { protect } from '../middleware/auth.js';
import { authorize } from '../middleware/auth.js';
import {
  generateReport,
  listReports,
  getReport,
  shareReport,
  getSharedReportByToken,
  emailReport,
  exportReport,
} from '../controllers/incidentReportController.js';

const router = Router();
router.use(protect);

/**
 * @openapi
 * /api/incident-reports/generate/{incidentId}:
 *   post:
 *     tags:
 *       - Incident Reports
 *     summary: Generate AI incident report
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: incidentId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       201:
 *         description: Report generated successfully
 */
router.post('/generate/:incidentId', generateReport);

/**
 * @openapi
 * /api/incident-reports:
 *   get:
 *     tags:
 *       - Incident Reports
 *     summary: List incident reports
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: incidentId
 *         schema:
 *           type: string
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
 *         description: List of reports
 */
router.get('/', listReports);

/**
 * @openapi
 * /api/incident-reports/{id}:
 *   get:
 *     tags:
 *       - Incident Reports
 *     summary: Get incident report by ID
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
 *         description: Report details
 */
router.get('/:id', getReport);

/**
 * @openapi
 * /api/incident-reports/{id}/share:
 *   post:
 *     tags:
 *       - Incident Reports
 *     summary: Generate shareable link
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               expiresInHours:
 *                 type: integer
 *                 default: 72
 *     responses:
 *       200:
 *         description: Share link generated
 */
router.post('/:id/share', shareReport);

/**
 * @openapi
 * /api/incident-reports/share/{token}:
 *   get:
 *     tags:
 *       - Incident Reports
 *     summary: Access shared report
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Shared report data
 */
router.get('/share/:token', getSharedReportByToken);

/**
 * @openapi
 * /api/incident-reports/{id}/email:
 *   post:
 *     tags:
 *       - Incident Reports
 *     summary: Email incident report
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
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *     responses:
 *       200:
 *         description: Report emailed
 */
router.post('/:id/email', emailReport);

/**
 * @openapi
 * /api/incident-reports/{id}/export:
 *   post:
 *     tags:
 *       - Incident Reports
 *     summary: Export incident report
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [pdf, docx, markdown]
 *           default: pdf
 *     responses:
 *       200:
 *         description: Exported report
 */
router.post('/:id/export', exportReport);

export default router;
