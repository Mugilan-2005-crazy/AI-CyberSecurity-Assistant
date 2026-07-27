/**
 * routes/chatRoutes.js
 * ============================================================
 * MODULE 5 — AI chatbot endpoint. Mounted at /api/chat.
 * Security: protected (JWT), rate-limited (20 msg/min), validated.
 */
import express from 'express';
import { body } from 'express-validator';
import { chat, getChatHistory, clearChatHistory, multimodalChat, webSearch } from '../controllers/chatController.js';
import { askOllama, isOllamaAvailable } from '../services/ai/ollamaService.js';
import gemini from '../services/security/gemini.js';
import { validate } from '../middleware/validate.js';
import { protect } from '../middleware/auth.js';
import { detectLanguage } from '../middleware/languageDetector.js';
import { rateLimiter } from '../middleware/rateLimiter.js';
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
router.get('/test/ollama', async (req, res) => {
  try {
    const result = await askOllama('Explain ransomware', []);
    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[test/ollama] error:', err);
    res.status(500).json({
      success: false,
      message: err.message,
      stack: err.stack,
    });
  }
});

router.get('/status', async (req, res) => {
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

router.get('/gemini-health', async (req, res) => {
  try {
    const geminiConfigured = gemini.isConfigured();
    const health = {
      geminiConfigured,
      model: geminiConfigured ? 'gemini-2.5-flash' : null,
      status: 'unknown',
      lastError: null,
    };
    
    if (geminiConfigured) {
      try {
        const testReply = await gemini.ask('Health check', [], 'en');
        health.status = 'working';
        health.lastError = null;
      } catch (err) {
        health.status = 'failed';
        health.lastError = err.message;
      }
    } else {
      health.status = 'unavailable';
      health.lastError = 'Gemini API key not configured';
    }
    
    res.json(health);
  } catch (err) {
    logger.error('[chatRoutes] Gemini health check failed:', err);
    res.json({
      geminiConfigured: false,
      model: null,
      status: 'error',
      lastError: err.message,
    });
  }
});

router.use(protect, detectLanguage);

router.post(
  '/message',
  rateLimiter(60 * 1000, 20, 'Too many chat messages, slow down'),
  validate([
    body('message').optional().isString().isLength({ max: 2000 }).withMessage('Message must be a string up to 2000 characters'),
    body('sessionId').optional().isString().isLength({ max: 100 }).withMessage('Session ID must be a string up to 100 characters'),
    body('history').optional().isArray({ max: 50 }).withMessage('History must be an array with up to 50 items'),
  ]),
  chat
);

router.post(
  '/upload',
  rateLimiter(60 * 1000, 5, 'Too many file analyses, slow down'),
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

router.get('/history', getChatHistory);
router.delete('/history', clearChatHistory);

router.post(
  '/web-search',
  rateLimiter(60 * 1000, 10, 'Too many web searches, slow down'),
  validate([
    body('query').isString().isLength({ min: 1, max: 500 }).withMessage('Query must be 1-500 characters'),
  ]),
  webSearch
);

export default router;
