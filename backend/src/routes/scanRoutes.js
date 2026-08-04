/**
 * routes/scanRoutes.js
 * All security module endpoints. Every route requires auth.
 * Mounted at /api/scan
 * @openapi
 * components:
 *   schemas:
 *     UrlScanRequest:
 *       type: object
 *       required:
 *         - url
 *       properties:
 *         url:
 *           type: string
 *           format: uri
 *     PasswordScanRequest:
 *       type: object
 *       required:
 *         - password
 *       properties:
 *         password:
 *           type: string
 *     EmailScanRequest:
 *       type: object
 *       required:
 *         - body
 *       properties:
 *         body:
 *           type: string
 *         subject:
 *           type: string
 *         sender:
 *           type: string
 */
import express from 'express';
import { body } from 'express-validator';
import {
  scanUrlRoute, scanPasswordRoute, scanEmailRoute, scanFileRoute, scanQrRoute, dashboard, generateReport, listReports,
} from '../controllers/scanController.js';
import { validate } from '../middleware/validate.js';
import { protect } from '../middleware/auth.js';
import { rateLimiter, scanLimiter, qrScanLimiter, fileScanLimiter } from '../middleware/rateLimiter.js';
import { uploadSingle, uploadQr } from '../middleware/upload.js';

const router = express.Router();
router.use(protect); // all scan routes protected

router.get('/dashboard', dashboard);
/**
 * @openapi
 * /api/scan/dashboard:
 *   get:
 *     tags:
 *       - Security Scans
 *     summary: Get dashboard aggregate data
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard data
 */
router.get('/dashboard', dashboard);
/**
 * @openapi
 * /api/scan/url:
 *   post:
 *     tags:
 *       - Security Scans
 *     summary: Scan a URL
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UrlScanRequest'
 *     responses:
 *       200:
 *         description: URL scan result
 */
router.post('/url', scanLimiter, validate([body('url').isURL().withMessage('Valid URL required')]), scanUrlRoute);
/**
 * @openapi
 * /api/scan/password:
 *   post:
 *     tags:
 *       - Security Scans
 *     summary: Analyze password strength
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PasswordScanRequest'
 *     responses:
 *       200:
 *         description: Password analysis result
 */
router.post('/password', validate([body('password').isString()]), scanPasswordRoute);
/**
 * @openapi
 * /api/scan/email:
 *   post:
 *     tags:
 *       - Security Scans
 *     summary: Analyze email for phishing
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/EmailScanRequest'
 *     responses:
 *       200:
 *         description: Email analysis result
 */
router.post('/email', validate([body('body').isString(), body('subject').optional().isString(), body('sender').optional().isString()]), scanEmailRoute);
/**
 * @openapi
 * /api/scan/qr:
 *   post:
 *     tags:
 *       - Security Scans
 *     summary: Analyze QR code
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               qrImage:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: QR code analysis result
 */
router.post('/qr', qrScanLimiter, uploadQr, scanQrRoute);
/**
 * @openapi
 * /api/scan/file:
 *   post:
 *     tags:
 *       - Security Scans
 *     summary: Scan file for malware
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: File scan result
 */
router.post('/file', fileScanLimiter, uploadSingle, scanFileRoute);
/**
 * @openapi
 * /api/scan/report:
 *   post:
 *     tags:
 *       - Security Scans
 *     summary: Generate PDF report
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: PDF report generated
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 */
router.post('/report', validate([]), generateReport);
/**
 * @openapi
 * /api/scan/reports:
 *   get:
 *     tags:
 *       - Security Scans
 *     summary: List previous reports
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of reports
 */
router.get('/reports', listReports);

export default router;
