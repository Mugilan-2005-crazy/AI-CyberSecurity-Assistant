/**
 * routes/authRoutes.js
 * Auth endpoints with validation + rate limiting.
 * Mounted at /api/auth
 */
import express from 'express';
import { body } from 'express-validator';
import { register, login, verifyEmail, forgotPassword, resetPassword, refreshToken, logout, me } from '../controllers/authController.js';
import { validate } from '../middleware/validate.js';
import { authLimiter } from '../middleware/rateLimiter.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.post(
  '/register',
  authLimiter,
  validate([
    body('name').isLength({ min: 2 }).withMessage('Name required'),
    body('email').isEmail().withMessage('Valid email required'),
    body('password').isLength({ min: 8 }).withMessage('Min 8 chars'),
  ]),
  register
);

router.post('/login', authLimiter, validate([body('email').isEmail(), body('password').exists()]), login);
router.get('/verify-email', verifyEmail);
router.post('/forgot-password', authLimiter, validate([body('email').isEmail()]), forgotPassword);
router.post('/reset-password', validate([body('token').exists(), body('password').isLength({ min: 8 })]), resetPassword);
router.post('/refresh', refreshToken);
router.post('/logout', protect, logout);
router.get('/me', protect, me);

export default router;
