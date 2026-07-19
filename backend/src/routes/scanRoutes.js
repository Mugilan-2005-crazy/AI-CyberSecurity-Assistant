/**
 * routes/scanRoutes.js
 * All security module endpoints. Every route requires auth.
 * Mounted at /api/scan
 */
import express from 'express';
import { body } from 'express-validator';
import {
  scanUrlRoute, scanPasswordRoute, scanEmailRoute, scanFileRoute, scanQrRoute, dashboard, generateReport, listReports,
} from '../controllers/scanController.js';
import { validate } from '../middleware/validate.js';
import { protect } from '../middleware/auth.js';
import { rateLimiter } from '../middleware/rateLimiter.js';
import { uploadSingle, uploadQr } from '../middleware/upload.js';

const router = express.Router();
router.use(protect); // all scan routes protected

router.get('/dashboard', dashboard);
router.post('/url', rateLimiter(60 * 1000, 30), validate([body('url').isURL().withMessage('Valid URL required')]), scanUrlRoute);
router.post('/password', validate([body('password').isString()]), scanPasswordRoute);
router.post('/email', validate([body('body').isString(), body('subject').optional().isString(), body('sender').optional().isString()]), scanEmailRoute);
router.post('/qr', rateLimiter(60 * 1000, 20), uploadQr, scanQrRoute);
router.post('/file', rateLimiter(60 * 1000, 15), uploadSingle, scanFileRoute);
router.post('/report', validate([]), generateReport);
router.get('/reports', listReports);

export default router;
