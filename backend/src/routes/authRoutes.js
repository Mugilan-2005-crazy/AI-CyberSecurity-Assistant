/**
 * routes/authRoutes.js
 * Auth endpoints with validation + rate limiting.
 * Mounted at /api/auth
 * @openapi
 * components:
 *   schemas:
 *     LoginRequest:
 *       type: object
 *       required:
 *         - email
 *         - password
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *         password:
 *           type: string
 *           format: password
 *     RegisterRequest:
 *       type: object
 *       required:
 *         - name
 *         - email
 *         - password
 *       properties:
 *         name:
 *           type: string
 *         email:
 *           type: string
 *           format: email
 *         password:
 *           type: string
 *           format: password
 *     ForgotPasswordRequest:
 *       type: object
 *       required:
 *         - email
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *     ResetPasswordRequest:
 *       type: object
 *       required:
 *         - token
 *         - password
 *       properties:
 *         token:
 *           type: string
 *         password:
 *           type: string
 *           format: password
 *     ChangePasswordRequest:
 *       type: object
 *       required:
 *         - currentPassword
 *         - newPassword
 *       properties:
 *         currentPassword:
 *           type: string
 *           format: password
 *         newPassword:
 *           type: string
 *           format: password
 */
import express from 'express';
import { body } from 'express-validator';
import {
  register, login, verifyEmail, forgotPassword, resetPassword,
  refreshToken, logout, me, updateName, changePassword, updateLanguage,
  sendOTP, verifyOTP, resetPasswordWithOTP, verify2FA, loginEnhanced,
  setupTOTP, enableTOTP, verifyTOTP, getBackupCodes, disableTOTP,
} from '../controllers/authController.js';
import { validate } from '../middleware/validate.js';
import { authLimiter, rateLimiter } from '../middleware/rateLimiter.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// Stricter limiter for OTP/2FA verification (brute-force protection)
const otpLimiter = rateLimiter(15 * 60 * 1000, 10, 'Too many OTP attempts, try later');

/**
 * @openapi
 * /api/auth/register:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Register a new user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RegisterRequest'
 *     responses:
 *       201:
 *         description: User created successfully
 *       400:
 *         description: Validation error
 */
router.post(
  '/register',
  authLimiter,
  validate([
    body('name').isLength({ min: 2 }).withMessage('Name required'),
    body('email').isEmail().withMessage('Valid email required'),
    body('password')
      .isLength({ min: 8 }).withMessage('Min 8 chars')
      .matches(/[a-z]/).withMessage('Password must contain a lowercase letter')
      .matches(/[A-Z]/).withMessage('Password must contain an uppercase letter')
      .matches(/[0-9]/).withMessage('Password must contain a number')
      .matches(/[^a-zA-Z0-9]/).withMessage('Password must contain a special character'),
  ]),
  register
);

/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Login user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       200:
 *         description: Login successful
 *       401:
 *         description: Invalid credentials
 */
router.post('/login', authLimiter, validate([body('email').isEmail(), body('password').exists()]), login);
/**
 * @openapi
 * /api/auth/verify-email:
 *   get:
 *     tags:
 *       - Authentication
 *     summary: Verify email address
 *     parameters:
 *       - in: query
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Email verified
 */
router.get('/verify-email', verifyEmail);
/**
 * @openapi
 * /api/auth/forgot-password:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Request password reset
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ForgotPasswordRequest'
 *     responses:
 *       200:
 *         description: Reset email sent
 */
router.post('/forgot-password', authLimiter, validate([body('email').isEmail()]), forgotPassword);
/**
 * @openapi
 * /api/auth/reset-password:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Reset password with token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ResetPasswordRequest'
 *     responses:
 *       200:
 *         description: Password reset successful
 */
router.post('/reset-password', authLimiter, validate([body('token').exists(), body('password').isLength({ min: 8 })
  .matches(/[a-z]/).withMessage('Password must contain a lowercase letter')
  .matches(/[A-Z]/).withMessage('Password must contain an uppercase letter')
  .matches(/[0-9]/).withMessage('Password must contain a number')
  .matches(/[^a-zA-Z0-9]/).withMessage('Password must contain a special character')]), resetPassword);
/**
 * @openapi
 * /api/auth/refresh:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Refresh access token
 *     responses:
 *       200:
 *         description: New access token
 */
router.post('/refresh', refreshToken);
/**
 * @openapi
 * /api/auth/logout:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Logout user
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logged out
 */
router.post('/logout', protect, logout);
/**
 * @openapi
 * /api/auth/me:
 *   get:
 *     tags:
 *       - Authentication
 *     summary: Get current user profile
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current user profile
 */
router.get('/me', protect, me);
/**
 * @openapi
 * /api/auth/me:
 *   patch:
 *     tags:
 *       - Authentication
 *     summary: Update profile name
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *     responses:
 *       200:
 *         description: Profile updated
 */
router.patch('/me', protect, validate([body('name').isLength({ min: 2 }).withMessage('Name must be at least 2 characters')]), updateName);
/**
 * @openapi
 * /api/auth/me/language:
 *   patch:
 *     tags:
 *       - Authentication
 *     summary: Update language preference
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               language:
 *                 type: string
 *                 enum: [en, ta, tanglish, hi]
 *     responses:
 *       200:
 *         description: Language updated
 */
router.patch('/me/language', protect, validate([body('language').isIn(['en', 'ta', 'tanglish', 'hi']).withMessage('Unsupported language')]), updateLanguage);
/**
 * @openapi
 * /api/auth/change-password:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Change password
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ChangePasswordRequest'
 *     responses:
 *       200:
 *         description: Password changed
 */
router.post('/change-password', protect, validate([
  body('currentPassword').exists().withMessage('Current password required'),
  body('newPassword')
    .isLength({ min: 8 }).withMessage('Min 8 chars')
    .matches(/[a-z]/).withMessage('Password must contain a lowercase letter')
    .matches(/[A-Z]/).withMessage('Password must contain an uppercase letter')
    .matches(/[0-9]/).withMessage('Password must contain a number')
    .matches(/[^a-zA-Z0-9]/).withMessage('Password must contain a special character'),
]), changePassword);

router.post('/forgot-password/send-otp', authLimiter, validate([body('email').isEmail()]), sendOTP);
router.post('/forgot-password/verify-otp', otpLimiter, validate([body('email').isEmail(), body('otp').isLength({ min: 6, max: 6 })]), verifyOTP);
router.post('/forgot-password/reset', authLimiter, validate([body('resetToken').exists(), body('password').isLength({ min: 8 })
  .matches(/[a-z]/).withMessage('Password must contain a lowercase letter')
  .matches(/[A-Z]/).withMessage('Password must contain an uppercase letter')
  .matches(/[0-9]/).withMessage('Password must contain a number')
  .matches(/[^a-zA-Z0-9]/).withMessage('Password must contain a special character')]), resetPasswordWithOTP);

// Security: verify2FA now requires a signed twoFactorToken instead of userId
router.post('/2fa/verify', otpLimiter, validate([
  body('twoFactorToken').exists().withMessage('twoFactorToken is required'),
  body('otp').isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits'),
]), verify2FA);

router.post('/login-enhanced', authLimiter, validate([body('email').isEmail(), body('password').exists()]), loginEnhanced);

// TOTP MFA endpoints (RFC 6238)
/**
 * @openapi
 * /api/auth/2fa/totp/setup:
 *   get:
 *     tags: [Authentication]
 *     summary: Generate TOTP secret + QR code for MFA setup
 *     security:
 *       - bearerAuth: []
 */
router.get('/2fa/totp/setup', protect, otpLimiter, setupTOTP);

/**
 * @openapi
 * /api/auth/2fa/totp/enable:
 *   post:
 *     tags: [Authentication]
 *     summary: Enable TOTP MFA by verifying initial token
 *     security:
 *       - bearerAuth: []
 */
router.post('/2fa/totp/enable', protect, otpLimiter, validate([body('token').isLength({ min: 6, max: 6 }).withMessage('TOTP token must be 6 digits')]), enableTOTP);

/**
 * @openapi
 * /api/auth/2fa/totp/verify:
 *   post:
 *     tags: [Authentication]
 *     summary: Verify TOTP token during login flow
 */
router.post('/2fa/totp/verify', otpLimiter, validate([body('twoFactorToken').exists(), body('otp').isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits')]), verifyTOTP);

/**
 * @openapi
 * /api/auth/2fa/totp/backup-codes:
 *   get:
 *     tags: [Authentication]
 *     summary: Get TOTP backup codes
 *     security:
 *       - bearerAuth: []
 */
router.get('/2fa/totp/backup-codes', protect, getBackupCodes);

/**
 * @openapi
 * /api/auth/2fa/totp/disable:
 *   post:
 *     tags: [Authentication]
 *     summary: Disable TOTP MFA (requires current TOTP or backup code)
 *     security:
 *       - bearerAuth: []
 */
router.post('/2fa/totp/disable', protect, otpLimiter, disableTOTP);

export default router;