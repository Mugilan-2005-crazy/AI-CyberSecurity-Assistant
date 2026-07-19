/**
 * routes/chatRoutes.js
 * ============================================================
 * MODULE 5 — AI chatbot endpoint. Mounted at /api/chat.
 * Security: protected (JWT), rate-limited (20 msg/min), validated.
 */
import express from 'express';
import { body } from 'express-validator';
import { chat } from '../controllers/chatController.js';
import { validate } from '../middleware/validate.js';
import { protect } from '../middleware/auth.js';
import { rateLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

// All chatbot requests require a valid token.
router.use(protect);

// POST /api/chat/message
//  - rate limit: 20 requests / minute (brute-force & cost control)
//  - validate: message required string (<=2000), sessionId optional string
router.post(
  '/message',
  rateLimiter(60 * 1000, 20, 'Too many chat messages, slow down'),
  validate([
    body('message').isString().isLength({ min: 1, max: 2000 }).withMessage('Message must be 1-2000 chars'),
    body('sessionId').optional().isString().isLength({ max: 100 }),
    body('history').optional().isArray({ max: 50 }),
  ]),
  chat
);

export default router;
