/**
 * routes/documentRoutes.js
 * ============================================================
 * MODULE — Security Notes AI — API routes.
 * Mounted at /api/notes.
 * Security: protected (JWT), rate-limited, validated.
 */
import express from 'express';
import { body } from 'express-validator';
import { validate } from '../middleware/validate.js';
import { protect } from '../middleware/auth.js';
import { detectLanguage } from '../middleware/languageDetector.js';
import { rateLimiter } from '../middleware/rateLimiter.js';
import {
  upload,
  getSupportedFormats,
  uploadDocument,
  getDocuments,
  getDocument,
  deleteDocument,
  chat,
  getChatHistory,
  getSupportedLanguages,
} from '../controllers/documentController.js';

const router = express.Router();

router.use(protect, detectLanguage);

router.get('/formats', getSupportedFormats);
router.get('/languages', getSupportedLanguages);

router.get('/documents', getDocuments);

router.post(
  '/upload',
  rateLimiter(60 * 1000, 10, 'Too many uploads, slow down'),
  upload.single('file'),
  uploadDocument
);

router.get('/:id', getDocument);
router.delete('/:id', deleteDocument);

router.post(
  '/chat',
  rateLimiter(60 * 1000, 30, 'Too many chat messages, slow down'),
  validate([
    body('documentId').isMongoId().withMessage('Valid documentId is required'),
    body('message').isString().isLength({ min: 1, max: 3000 }).withMessage('Message must be 1-3000 chars'),
    body('language').optional().isString().isLength({ max: 10 }),
  ]),
  chat
);

router.get('/history/:documentId', getChatHistory);

export default router;