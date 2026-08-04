/**
 * routes/aiUploadRoutes.js
 * ------------------------------------------------------------
 * File upload endpoints for multimodal AI chat analysis.
 * Mounted at /api/ai/upload.
 * @openapi
 * components:
 *   schemas:
 *     FileAnalyzeRequest:
 *       type: object
 *       properties:
 *         file:
 *           type: string
 *           format: binary
 */
import express from 'express';
import multer from 'multer';
import ApiError from '../utils/ApiError.js';
import { uploadAndAnalyze, getUploadHistory } from '../controllers/aiUploadController.js';
import { protect } from '../middleware/auth.js';
import { detectLanguage } from '../middleware/languageDetector.js';
import { rateLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

const ALLOWED_EXTENSIONS = ['pdf', 'txt', 'docx', 'png', 'jpg', 'jpeg', 'mp4', 'mov', 'avi'];
const BLOCKED_EXTENSIONS = ['exe', 'bat', 'cmd', 'js', 'sh', 'ps1'];
const MAX_FILE_SIZE = 25 * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    const ext = file.originalname.split('.').pop()?.toLowerCase() || '';
    if (BLOCKED_EXTENSIONS.includes(ext)) {
      return cb(new ApiError(400, 'Blocked file type'), false);
    }
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return cb(new ApiError(400, 'Unsupported file type'), false);
    }
    cb(null, true);
  },
});

router.use(protect, detectLanguage);

/**
 * @openapi
 * /api/ai/upload/analyze:
 *   post:
 *     tags:
 *       - AI Upload
 *     summary: Upload and analyze file with AI
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             $ref: '#/components/schemas/FileAnalyzeRequest'
 *     responses:
 *       200:
 *         description: File analysis result
 */
router.post(
  '/analyze',
  rateLimiter(60 * 1000, 10, 'Too many uploads, slow down'),
  upload.single('file'),
  uploadAndAnalyze
);

/**
 * @openapi
 * /api/ai/upload/history:
 *   get:
 *     tags:
 *       - AI Upload
 *     summary: Get upload history
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Upload history
 */
router.get('/history', getUploadHistory);

export default router;
