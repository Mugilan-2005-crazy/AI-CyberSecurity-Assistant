/**
 * routes/aiUploadRoutes.js
 * ------------------------------------------------------------
 * File upload endpoints for multimodal AI chat analysis.
 * Mounted at /api/ai/upload.
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

router.post(
  '/analyze',
  rateLimiter(60 * 1000, 10, 'Too many uploads, slow down'),
  upload.single('file'),
  uploadAndAnalyze
);

router.get('/history', getUploadHistory);

export default router;
