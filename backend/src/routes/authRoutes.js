/**
 * routes/authRoutes.js
 * Auth endpoints with validation + rate limiting.
 * Mounted at /api/auth
 */
import express from 'express';
import { body } from 'express-validator';
import {
  register, login, verifyEmail, forgotPassword, resetPassword,
  refreshToken, logout, me, updateName, changePassword, updateLanguage,
  sendOTP, verifyOTP, resetPasswordWithOTP, verify2FA, loginEnhanced,
} from '../controllers/authController.js';
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
router.patch('/me', protect, validate([body('name').isLength({ min: 2 }).withMessage('Name must be at least 2 characters')]), updateName);
router.patch('/me/language', protect, validate([body('language').isIn(['en', 'ta', 'tanglish', 'hi']).withMessage('Unsupported language')]), updateLanguage);
router.post('/change-password', protect, validate([
  body('currentPassword').exists().withMessage('Current password required'),
  body('newPassword').isLength({ min: 8 }).withMessage('Min 8 chars'),
]), changePassword);

// ─── OTP-based password reset ─────────────────────────────
router.post('/forgot-password/send-otp', authLimiter, validate([body('email').isEmail()]), sendOTP);
router.post('/forgot-password/verify-otp', authLimiter, validate([body('email').isEmail(), body('otp').isLength({ min: 6, max: 6 })]), verifyOTP);
router.post('/forgot-password/reset', validate([body('resetToken').exists(), body('password').isLength({ min: 8 })]), resetPasswordWithOTP);

// ─── 2FA ──────────────────────────────────────────────────
router.post('/2fa/verify', validate([body('userId').exists(), body('otp').isLength({ min: 6, max: 6 })]), verify2FA);

// ─── Enhanced login with device tracking ──────────────────
router.post('/login-enhanced', authLimiter, validate([body('email').isEmail(), body('password').exists()]), loginEnhanced);

export default router;
