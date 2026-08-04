/**
 * routes/chatRoutes.js
 * ============================================================
 * MODULE 5 — AI chatbot endpoint. Mounted at /api/chat.
 * Security: protected (JWT), rate-limited (20 msg/min), validated.
 * @openapi
 * components:
 *   schemas:
 *     ChatMessageRequest:
 *       type: object
 *       required:
 *         - message
 *       properties:
 *         message:
 *           type: string
 *           maxLength: 2000
 *         sessionId:
 *           type: string
 *           maxLength: 100
 *         history:
 *           type: array
 *           maxItems: 50
 *           items:
 *             type: object
 *     WebSearchRequest:
 *       type: object
 *       required:
 *         - query
 *       properties:
 *         query:
 *           type: string
 *           maxLength: 500
 */
import express from 'express';
import { body } from 'express-validator';
import { chat, getChatHistory, clearChatHistory, multimodalChat, webSearch } from '../controllers/chatController.js';
import { askOllama, isOllamaAvailable } from '../services/ai/ollamaService.js';
import gemini from '../services/security/gemini.js';
import { validate } from '../middleware/validate.js';
import { protect, authorize } from '../middleware/auth.js';
import { detectLanguage } from '../middleware/languageDetector.js';
import { rateLimiter, chatLimiter, chatUploadLimiter, webSearchLimiter } from '../middleware/rateLimiter.js';
import multer from 'multer';
import ApiError from '../utils/ApiError.js';
import logger from '../utils/logger.js';

const router = express.Router();

const ALLOWED_EXTENSIONS = ['pdf', 'txt', 'docx', 'png', 'jpg', 'jpeg', 'mp4', 'mov', 'avi'];
const BLOCKED_EXTENSIONS = ['exe', 'bat', 'cmd', 'js', 'sh', 'ps1'];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
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

// GET /api/test/ollama - temporary diagnostic route
/**
 * @openapi
 * /api/chat/test/ollama:
 *   get:
 *     tags:
 *       - AI Chatbot
 *     summary: Test Ollama connectivity (admin only)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Ollama test result
 */
router.get('/test/ollama', protect, authorize('admin'), async (req, res) => {
  try {
    const result = await askOllama('Explain ransomware', []);
    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    logger.error('[test/ollama] error', { error: err.message, stack: err.stack });
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

/**
 * @openapi
 * /api/chat/status:
 *   get:
 *     tags:
 *       - AI Chatbot
 *     summary: Get AI provider status (admin only)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: AI provider status
 */
router.get('/status', protect, authorize('admin'), async (req, res) => {
  try {
    const ollamaAvailable = await isOllamaAvailable();
    const geminiConfigured = gemini.isConfigured();

    res.json({
      success: true,
      ollama: {
        status: ollamaAvailable ? 'online' : 'offline',
        model: ollamaAvailable ? 'llama3.1' : null,
      },
      gemini: {
        status: geminiConfigured ? 'available' : 'unavailable',
        model: geminiConfigured ? 'gemini-2.5-flash' : null,
      },
    });
  } catch (err) {
    logger.error('[chatRoutes] AI status check failed:', err);
    res.json({
      success: true,
      ollama: { status: 'unknown', model: null },
      gemini: { status: 'unknown', model: null },
    });
  }
});

/**
 * @openapi
 * /api/chat/gemini-health:
 *   get:
 *     tags:
 *       - AI Chatbot
 *     summary: Check Gemini AI health (admin only)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Gemini health status
 */

router.use(protect, detectLanguage);

/**
 * @openapi
 * /api/chat/message:
 *   post:
 *     tags:
 *       - AI Chatbot
 *     summary: Send text chat message
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ChatMessageRequest'
 *     responses:
 *       200:
 *         description: AI chat response
 */
router.post(
  '/message',
  chatLimiter,
  validate([
    body('message').optional().isString().isLength({ max: 2000 }).withMessage('Message must be a string up to 2000 characters'),
    body('sessionId').optional().isString().isLength({ max: 100 }).withMessage('Session ID must be a string up to 100 characters'),
    body('history').optional().isArray({ max: 50 }).withMessage('History must be an array with up to 50 items'),
  ]),
  chat
);

/**
 * @openapi
 * /api/chat/upload:
 *   post:
 *     tags:
 *       - AI Chatbot
 *     summary: Upload file for AI analysis
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
 *               message:
 *                 type: string
 *               sessionId:
 *                 type: string
 *     responses:
 *       200:
 *         description: File analysis result
 */
router.post(
  '/upload',
  chatUploadLimiter,
  upload.single('file'),
  validate([
    body('message').optional().isString().isLength({ max: 2000 }).withMessage('Message must be a string up to 2000 characters'),
    body('sessionId').optional().isString().isLength({ max: 100 }).withMessage('Session ID must be a string up to 100 characters'),
  ]),
  (req, res, next) => {
    if (req.file) {
      logger.info('[chatRoutes] File received for AI analysis', {
        filename: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype,
        userId: req.user?.id,
        sessionId: req.body?.sessionId || null,
      });
    }
    next();
  },
  multimodalChat
);
/**
 * @openapi
 * /api/chat/history:
 *   get:
 *     tags:
 *       - AI Chatbot
 *     summary: Get chat history
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Chat history sessions
 */
router.get('/history', getChatHistory);
/**
 * @openapi
 * /api/chat/history:
 *   delete:
 *     tags:
 *       - AI Chatbot
 *     summary: Clear chat history
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Chat history cleared
 */
router.delete('/history', clearChatHistory);
/**
 * @openapi
 * /api/chat/web-search:
 *   post:
 *     tags:
 *       - AI Chatbot
 *     summary: Web search for threat intelligence
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/WebSearchRequest'
 *     responses:
 *       200:
 *         description: Web search results
 */
router.post(
  '/web-search',
  webSearchLimiter,
  validate([
    body('query').isString().isLength({ min: 1, max: 500 }).withMessage('Query must be 1-500 characters'),
  ]),
  webSearch
);

export default router;
