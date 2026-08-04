/**
 * routes/documentRoutes.js
 * ============================================================
 * MODULE — Security Notes AI — API routes.
 * Mounted at /api/notes.
 * Security: protected (JWT), rate-limited, validated.
 * @openapi
 * components:
 *   schemas:
 *     DocumentChatRequest:
 *       type: object
 *       required:
 *         - documentId
 *         - message
 *       properties:
 *         documentId:
 *           type: string
 *         message:
 *           type: string
 *           maxLength: 3000
 *         language:
 *           type: string
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

/**
 * @openapi
 * /api/notes/formats:
 *   get:
 *     tags:
 *       - Security Notes AI
 *     summary: Get supported file formats
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Supported formats
 */
router.get('/formats', getSupportedFormats);
/**
 * @openapi
 * /api/notes/languages:
 *   get:
 *     tags:
 *       - Security Notes AI
 *     summary: Get supported languages
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Supported languages
 */
router.get('/languages', getSupportedLanguages);
/**
 * @openapi
 * /api/notes/documents:
 *   get:
 *     tags:
 *       - Security Notes AI
 *     summary: List user documents
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of documents
 */
router.get('/documents', getDocuments);

/**
 * @openapi
 * /api/notes/upload:
 *   post:
 *     tags:
 *       - Security Notes AI
 *     summary: Upload document
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
 *         description: Document uploaded
 */
router.post(
  '/upload',
  rateLimiter(60 * 1000, 10, 'Too many uploads, slow down'),
  upload.single('file'),
  uploadDocument
);

/**
 * @openapi
 * /api/notes/chat:
 *   post:
 *     tags:
 *       - Security Notes AI
 *     summary: Chat with document
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/DocumentChatRequest'
 *     responses:
 *       200:
 *         description: Chat response
 */
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

/**
 * @openapi
 * /api/notes/history/{documentId}:
 *   get:
 *     tags:
 *       - Security Notes AI
 *     summary: Get document chat history
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: documentId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Chat history
 */
router.get('/history/:documentId', getChatHistory);

/**
 * @openapi
 * /api/notes/{id}:
 *   get:
 *     tags:
 *       - Security Notes AI
 *     summary: Get document by ID
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
 *         description: Document details
 */
router.get('/:id', getDocument);
/**
 * @openapi
 * /api/notes/{id}:
 *   delete:
 *     tags:
 *       - Security Notes AI
 *     summary: Delete document
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *       schema:
 *         type: string
 *     responses:
 *       200:
 *         description: Document deleted
 */
router.delete('/:id', deleteDocument);

export default router;