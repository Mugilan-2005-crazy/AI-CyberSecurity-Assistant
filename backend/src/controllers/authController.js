/**
 * controllers/authController.js
 * ------------------------------------------------------------
 * Handles registration, login, email verification, password
 * reset (token + OTP), refresh tokens, 2FA verification,
 * and current-user lookup. Issues JWT access + refresh tokens
 * and stores refresh tokens on the user.
 *
 * Security improvements (Batch #2):
 *  - User enumeration prevention (forgotPassword, sendOTP)
 *  - Brute-force protection on loginEnhanced
 *  - Email verification check on loginEnhanced
 *  - Secure 2FA flow using signed token (no userId in body)
 */
import crypto from 'crypto';
import User from '../models/User.js';
import ApiError from '../utils/ApiError.js';
import { signAccessToken, signRefreshToken, signTwoFactorToken, verifyTwoFactorToken, verifyRefreshToken } from '../utils/jwt.js';
import { generateToken, hashToken } from '../utils/tokens.js';
import { sendVerificationEmail, sendPasswordResetEmail, sendOTPEmail, sendSuspiciousLoginEmail } from '../utils/email.js';
import logger from '../utils/logger.js';
import config from '../config/index.js';
import { recordActivity } from '../services/ueba/behaviorService.js';
import {
  generateSecret,
  generateQrCodeUrl,
  generateQrCodeSvg,
  verifyToken as verifyTotpToken,
  generateBackupCodes,
  hashBackupCode,
  encryptSecret,
  decryptSecret,
} from '../services/auth/totpService.js';
import cacheManager from '../services/cache/cacheManager.js';
import { logTotpSetup, logTotpVerify } from '../services/audit/soc2AuditService.js';
import { recordAuditEvent, SOC2_EVENT_TYPES } from '../services/audit/soc2AuditService.js';

const cookieOpts = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: 30 * 24 * 60 * 60 * 1000,
};

const clearCookieOpts = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
};

const issueTokens = (user) => {
  const access = signAccessToken({ sub: user._id.toString(), role: user.role, email: user.email, language: user.language || 'en' });
  const refresh = signRefreshToken({ sub: user._id.toString() });
  return { access, refresh };
};

const maskEmail = (email) => {
  if (!email || !email.includes('@')) return 'unknown';
  const [name, domain] = email.split('@');
  return name[0] + '*****@' + domain;
};

export const register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    const existing = await User.findOne({ email });
    if (existing) throw new ApiError(409, 'Email already registered');

    const verifyToken = generateToken();
    const user = await User.create({
      name,
      email,
      password,
      emailVerificationToken: hashToken(verifyToken),
      emailVerificationExpire: Date.now() + 24 * 60 * 60 * 1000,
    });

    await sendVerificationEmail(email, verifyToken);

    const { access, refresh } = issueTokens(user);
    user.refreshTokens.push(refresh);
    await user.save();

    res.cookie('refreshToken', refresh, cookieOpts);
    res.status(201).json({
      success: true,
      accessToken: access,
      user: { id: user._id, name: user.name, email: user.email, role: user.role, isEmailVerified: user.isEmailVerified, language: user.language || 'en' },
    });
  } catch (err) { next(err); }
};

export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email }).select('+password +refreshTokens +failedLoginAttempts +lockedUntil');
    if (!user) throw new ApiError(401, 'Invalid credentials');
    if (!user.isActive) throw new ApiError(403, 'Account disabled');
    if (!user.isEmailVerified) {
      throw new ApiError(403, 'Please verify your email address before logging in.');
    }

    if (user.lockedUntil && user.lockedUntil > Date.now()) {
      const remainingMs = user.lockedUntil - Date.now();
      const remainingMin = Math.ceil(remainingMs / 60000);
      throw new ApiError(403, `Account locked due to too many failed attempts. Try again in ${remainingMin} minutes.`);
    }

    const passwordMatch = await user.comparePassword(password);
    if (!passwordMatch) {
      user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
      if (user.failedLoginAttempts >= config.security.maxLoginAttempts) {
        user.lockedUntil = Date.now() + config.security.lockoutDuration;
        logger.warn(`Account locked: ${maskEmail(email)} after ${user.failedLoginAttempts} failed attempts`, { email: maskEmail(email), ip: req.ip });
      }
      await user.save();
      recordActivity(user._id, {
        type: 'login',
        action: 'Failed login attempt',
        ip: req.ip || '',
        location: '',
        device: req.headers['user-agent'] || '',
        success: false,
        metadata: { source: 'login', failedAttempts: user.failedLoginAttempts },
      }).catch((err) => logger.warn('[ueba] Failed login activity recording failed', { error: err.message }));
      throw new ApiError(401, 'Invalid credentials');
    }

    user.failedLoginAttempts = 0;
    user.lockedUntil = null;
    user.lastLogin = new Date();
    const { access, refresh } = issueTokens(user);
    user.refreshTokens.push(refresh);
    await user.save();

    recordActivity(user._id, {
      type: 'login',
      action: 'User logged in',
      ip: req.ip || '',
      location: user.lastLoginLocation || '',
      device: user.lastLoginDevice || '',
      success: true,
      metadata: { source: 'login' },
    }).catch((err) => logger.warn('[ueba] Login activity recording failed', { error: err.message }));

    res.cookie('refreshToken', refresh, cookieOpts);
    res.json({
      success: true,
      accessToken: access,
      user: { id: user._id, name: user.name, email: user.email, role: user.role, isEmailVerified: user.isEmailVerified, language: user.language || 'en' },
    });
  } catch (err) { next(err); }
};

export const verifyEmail = async (req, res, next) => {
  try {
    const { token } = req.query;
    const user = await User.findOne({ emailVerificationToken: hashToken(token) });
    if (!user || user.emailVerificationExpire < Date.now()) {
      throw new ApiError(400, 'Invalid or expired verification token');
    }
    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpire = undefined;
    await user.save();
    res.json({ success: true, message: 'Email verified' });
  } catch (err) { next(err); }
};

// Security: Always return the same generic success response regardless of
// whether the email exists. This prevents user enumeration attacks.
export const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (user) {
      const token = generateToken();
      user.passwordResetToken = hashToken(token);
      user.passwordResetExpire = Date.now() + 60 * 60 * 1000;
      await user.save();
      await sendPasswordResetEmail(email, token);
    }

    res.json({ success: true, message: 'If an account with that email exists, a password reset link has been sent.' });
  } catch (err) { next(err); }
};

export const resetPassword = async (req, res, next) => {
  try {
    const { token, password } = req.body;
    const user = await User.findOne({ passwordResetToken: hashToken(token) });
    if (!user || user.passwordResetExpire < Date.now()) {
      throw new ApiError(400, 'Invalid or expired reset token');
    }
    user.password = password;
    user.passwordResetToken = undefined;
    user.passwordResetExpire = undefined;
    user.refreshTokens = [];
    await user.save();
    res.json({ success: true, message: 'Password updated' });
  } catch (err) { next(err); }
};

export const refreshToken = async (req, res, next) => {
  try {
    const token = req.cookies.refreshToken || req.body.refreshToken;
    if (!token) throw new ApiError(401, 'No refresh token');
    const decoded = verifyRefreshToken(token);
    const user = await User.findById(decoded.sub).select('+refreshTokens');
    if (!user || !user.refreshTokens.includes(token)) {
      throw new ApiError(401, 'Invalid refresh token');
    }

    // Security: Rotate refresh token — revoke the old one and issue a new one.
    // This prevents replay attacks with stolen refresh tokens.
    user.refreshTokens = user.refreshTokens.filter((t) => t !== token);
    const { access, refresh } = issueTokens(user);
    user.refreshTokens.push(refresh);
    await user.save();

    res.cookie('refreshToken', refresh, cookieOpts);
    res.json({ success: true, accessToken: access });
  } catch (err) { next(err); }
};

export const logout = async (req, res, next) => {
  try {
    const token = req.cookies && req.cookies.refreshToken;
    if (token && req.user) {
      const user = await User.findById(req.user.id).select('+refreshTokens');
      if (user) {
        user.refreshTokens = user.refreshTokens.filter((t) => t !== token);
        await user.save();
      }
    }
    res.clearCookie('refreshToken', clearCookieOpts);
    res.json({ success: true, message: 'Logged out' });
  } catch (err) { next(err); }
};

export const me = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) throw new ApiError(404, 'User not found');

    const ScanHistory = (await import('../models/ScanHistory.js')).default;
    const ChatLog = (await import('../models/ChatLog.js')).default;
    const [totalScans, totalChats] = await Promise.all([
      ScanHistory.countDocuments({ user: user._id }),
      ChatLog.countDocuments({ user: user._id }),
    ]).catch(() => [0, 0]);

    res.json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isEmailVerified: user.isEmailVerified,
        language: user.language || 'en',
        createdAt: user.createdAt,
        totalScans,
        totalChats,
      },
    });
  } catch (err) { next(err); }
};

export const updateName = async (req, res, next) => {
  try {
    const { name } = req.body;
    if (typeof name !== 'string' || name.trim().length < 2) {
      throw new ApiError(400, 'Name must be at least 2 characters');
    }
    const user = await User.findById(req.user.id);
    if (!user) throw new ApiError(404, 'User not found');
    user.name = name.trim();
    await user.save();
    res.json({
      success: true,
      user: { id: user._id, name: user.name, email: user.email, role: user.role, isEmailVerified: user.isEmailVerified, createdAt: user.createdAt },
    });
  } catch (err) { next(err); }
};

export const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (typeof newPassword !== 'string' || newPassword.length < 8) {
      throw new ApiError(400, 'New password must be at least 8 characters');
    }
    const user = await User.findById(req.user.id).select('+password');
    if (!user) throw new ApiError(404, 'User not found');
    if (!(await user.comparePassword(currentPassword))) {
      throw new ApiError(401, 'Current password is incorrect');
    }
    user.password = newPassword;
    user.refreshTokens = [];
    await user.save();
    recordActivity(user._id, {
      type: 'password_change',
      action: 'User changed password',
      ip: req.ip || '',
      metadata: { source: 'changePassword' },
    }).catch((err) => logger.warn('[ueba] Password change activity recording failed', { error: err.message }));
    res.json({ success: true, message: 'Password updated successfully' });
  } catch (err) { next(err); }
};

export const updateLanguage = async (req, res, next) => {
  try {
    const { language } = req.body;
    const supported = ['en', 'ta', 'tanglish', 'hi'];
    if (!supported.includes(language)) {
      throw new ApiError(400, 'Unsupported language');
    }
    const user = await User.findById(req.user.id);
    if (!user) throw new ApiError(404, 'User not found');
    user.language = language;
    await user.save();

    const access = signAccessToken({ sub: user._id.toString(), role: user.role, email: user.email, language: user.language });
    res.json({
      success: true,
      message: 'Language preference updated',
      accessToken: access,
      user: { id: user._id, name: user.name, email: user.email, role: user.role, isEmailVerified: user.isEmailVerified, language: user.language },
    });
  } catch (err) { next(err); }
};

// ─── OTP-based password reset ─────────────────────────────

// Security: Always return the same generic success response regardless of
// whether the email exists. This prevents user enumeration attacks.
export const sendOTP = async (req, res, next) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (user) {
      const otp = crypto.randomInt(100000, 1000000).toString();
      user.passwordResetOTP = hashToken(otp);
      user.passwordResetOTPExpire = Date.now() + 10 * 60 * 1000;
      await user.save();
      await sendOTPEmail(email, otp);
    }

    res.json({
      success: true,
      maskedEmail: maskEmail(email),
      message: 'If an account with that email exists, an OTP has been sent.',
    });
  } catch (err) { next(err); }
};

export const verifyOTP = async (req, res, next) => {
  try {
    const { email, otp } = req.body;
    const user = await User.findOne({ email }).select('+passwordResetOTP +passwordResetOTPExpire');
    if (!user || !user.passwordResetOTP) throw new ApiError(400, 'No OTP request found');
    if (user.passwordResetOTPExpire < Date.now()) throw new ApiError(400, 'OTP has expired');
    if (user.passwordResetOTP !== hashToken(otp)) throw new ApiError(400, 'Invalid OTP');

    const resetToken = generateToken();
    user.passwordResetToken = hashToken(resetToken);
    user.passwordResetExpire = Date.now() + 10 * 60 * 1000;
    user.passwordResetOTP = undefined;
    user.passwordResetOTPExpire = undefined;
    await user.save();

    res.json({ success: true, message: 'OTP verified', resetToken });
  } catch (err) { next(err); }
};

export const resetPasswordWithOTP = async (req, res, next) => {
  try {
    const { resetToken, password } = req.body;
    const user = await User.findOne({ passwordResetToken: hashToken(resetToken) });
    if (!user || user.passwordResetExpire < Date.now()) {
      throw new ApiError(400, 'Invalid or expired reset session');
    }
    user.password = password;
    user.passwordResetToken = undefined;
    user.passwordResetExpire = undefined;
    user.refreshTokens = [];
    await user.save();
    res.json({ success: true, message: 'Password updated successfully' });
  } catch (err) { next(err); }
};

// ─── TOTP MFA endpoints ──────────────────────────────────────

const totpRateLimiterKey = (userId) => `mfa:totp:verify:${userId}`;

export const setupTOTP = async (req, res, next) => {
  try {
    const { qrCode } = req.query;
    const user = await User.findById(req.user.id).select('+totpSecret');
    if (!user) throw new ApiError(404, 'User not found');

    const secret = generateSecret();
    const qrUri = generateQrCodeUrl(secret, user.email);

    let response = {
      success: true,
      secret,
      qrUri,
      message: 'Scan the QR code with your authenticator app',
    };

    if (qrCode === 'svg') {
      const svg = await generateQrCodeSvg(qrUri);
      response.qrCode = svg;
    }

    cacheManager.set(`mfa:totp:pending:${user._id.toString()}`, encryptSecret(secret), 300).catch((err) =>
      logger.warn('[auth] Failed to cache pending TOTP secret', { error: err.message })
    );

    logTotpSetup(user._id.toString(), {
      ip: req.ip,
      userAgent: req.get('user-agent'),
      qrCodeRequested: qrCode === 'svg',
    });

    res.json(response);
  } catch (err) { next(err); }
};

export const enableTOTP = async (req, res, next) => {
  try {
    const { token } = req.body;
    if (!token || typeof token !== 'string' || token.length !== 6) {
      throw new ApiError(400, 'A valid 6-digit TOTP token is required');
    }

    const user = await User.findById(req.user.id).select('+totpSecret +totpBackupCodes');
    if (!user) throw new ApiError(404, 'User not found');

    let pendingSecret = await cacheManager.get(`mfa:totp:pending:${user._id.toString()}`);
    if (!pendingSecret) {
      throw new ApiError(400, 'No pending TOTP setup. Call setup first');
    }

    const decryptedSecret = decryptSecret(pendingSecret);
    if (!decryptedSecret) throw new ApiError(400, 'Failed to decrypt TOTP secret');

    if (!verifyTotpToken(decryptedSecret, token)) {
      throw new ApiError(401, 'Invalid TOTP token');
    }

    user.totpSecret = pendingSecret;
    user.twoFactorEnabled = true;
    user.twoFactorType = 'totp';

    const backupCodes = generateBackupCodes();
    user.totpBackupCodes = backupCodes.map(hashBackupCode);
    user.totpBackupCodesUsed = [];
    user.totpAttempts = 0;
    user.totpLockedUntil = null;

    await user.save();

    logger.info('[auth] TOTP MFA enabled', { userId: user._id.toString(), email: user.email });

    logTotpVerify(user._id.toString(), true, {
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });

    res.json({
      success: true,
      message: 'Two-factor authentication (TOTP) enabled successfully',
      backupCodes,
    });
  } catch (err) { next(err); }
};

export const verifyTOTP = async (req, res, next) => {
  try {
    const { twoFactorToken, token } = req.body;
    if (!twoFactorToken) throw new ApiError(400, 'twoFactorToken is required');
    if (!token || typeof token !== 'string' || token.length !== 6) {
      throw new ApiError(400, 'A valid 6-digit TOTP token is required');
    }

    let decoded;
    try {
      decoded = verifyTwoFactorToken(twoFactorToken);
    } catch {
      throw new ApiError(401, 'Invalid or expired 2FA token');
    }

    const user = await User.findById(decoded.sub).select('+totpSecret +totpBackupCodes +totpAttempts +totpLockedUntil');
    if (!user) throw new ApiError(404, 'User not found');

    if (user.totpLockedUntil && user.totpLockedUntil > Date.now()) {
      throw new ApiError(429, 'Too many failed TOTP attempts. Try again later.');
    }

    const rateKey = totpRateLimiterKey(user._id.toString());
    const rateLimitCount = await cacheManager.get(rateKey);
    const attempts = rateLimitCount ? Number(rateLimitCount) : 0;
    if (attempts >= config.mfa.verificationRateLimit) {
      const lockUntil = Date.now() + config.mfa.verificationRateWindow;
      user.totpLockedUntil = new Date(lockUntil);
      await user.save();
      throw new ApiError(429, `Too many TOTP attempts. Try again in ${Math.ceil(config.mfa.verificationRateWindow / 60000)} minutes.`);
    }

    const decryptedSecret = decryptSecret(user.totpSecret);
    if (!decryptedSecret) throw new ApiError(401, 'Invalid TOTP configuration');

    const isValid = verifyTotpToken(decryptedSecret, token);

    if (!isValid) {
      logTotpVerify(decoded.sub, false, {
        ip: req.ip,
        userAgent: req.get('user-agent'),
        reason: 'invalid_token',
      });

      const newAttempts = await cacheManager.getOrSet(rateKey, async () => '0', config.mfa.verificationRateWindow / 1000);
      const current = newAttempts ? Number(newAttempts) : 0;
      await cacheManager.set(rateKey, String(current + 1), config.mfa.verificationRateWindow / 1000);

      user.totpAttempts += 1;
      await user.save();
      throw new ApiError(401, 'Invalid TOTP token');
    }

    await cacheManager.del(rateKey);
    user.totpAttempts = 0;
    user.totpLockedUntil = null;
    await user.save();

    logTotpVerify(decoded.sub, true, {
      ip: req.ip,
      userAgent: req.get('user-agent'),
      reason: 'token_verified',
    });

    const { access, refresh } = issueTokens(user);
    user.refreshTokens.push(refresh);
    await user.save();

    res.cookie('refreshToken', refresh, cookieOpts);
    res.json({
      success: true,
      accessToken: access,
      requires2FA: false,
      user: { id: user._id, name: user.name, email: user.email, role: user.role, isEmailVerified: user.isEmailVerified, twoFactorEnabled: user.twoFactorEnabled, language: user.language || 'en' },
    });
  } catch (err) { next(err); }
};

export const getBackupCodes = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select('+totpBackupCodes');
    if (!user) throw new ApiError(404, 'User not found');

    if (!user.twoFactorEnabled || user.twoFactorType !== 'totp') {
      throw new ApiError(400, 'TOTP not enabled');
    }

    const usedSet = new Set(user.totpBackupCodesUsed || []);
    const backupCodes = (user.totpBackupCodes || []).map((hash) => {
      const isUsed = usedSet.has(hash);
      return { code: '••••••••', used: isUsed };
    });

    recordAuditEvent({
      eventType: SOC2_EVENT_TYPES.MFA_BACKUP_CODES_GENERATED,
      userId: user._id.toString(),
      severity: 'info',
      details: { remaining: backupCodes.filter((c) => !c.used).length },
      ip: req.ip,
      userAgent: req.get('user-agent'),
      resource: user._id.toString(),
      resourceType: 'user',
    });

    res.json({
      success: true,
      backupCodes,
      remaining: backupCodes.filter((c) => !c.used).length,
    });
  } catch (err) { next(err); }
};

export const disableTOTP = async (req, res, next) => {
  try {
    const { token, backupCode } = req.body;

    const user = await User.findById(req.user.id).select('+totpSecret +totpBackupCodes +password');
    if (!user) throw new ApiError(404, 'User not found');

    if (!user.twoFactorEnabled || user.twoFactorType !== 'totp') {
      throw new ApiError(400, 'TOTP not enabled');
    }

    const isBackupCode = backupCode && typeof backupCode === 'string';
    if (isBackupCode) {
      const isValid = user.totpBackupCodes.some((hash) => {
        if (user.totpBackupCodesUsed.includes(hash)) return false;
        return hash === hashBackupCode(backupCode);
      });
      if (!isValid) throw new ApiError(401, 'Invalid backup code');
      user.totpBackupCodesUsed.push(
        ...user.totpBackupCodes.filter((h) => !user.totpBackupCodesUsed.includes(h) && h === hashBackupCode(backupCode))
      );
    } else if (token) {
      const decryptedSecret = decryptSecret(user.totpSecret);
      if (!decryptedSecret) throw new ApiError(401, 'Invalid TOTP configuration');
      if (!verifyTotpToken(decryptedSecret, token)) throw new ApiError(401, 'Invalid TOTP token');
    } else {
      throw new ApiError(400, 'Either token (TOTP code) or backupCode is required');
    }

    user.twoFactorEnabled = false;
    user.twoFactorType = 'totp';
    user.totpSecret = undefined;
    user.totpBackupCodes = [];
    user.totpBackupCodesUsed = [];
    user.totpAttempts = 0;
    user.totpLockedUntil = null;
    user.twoFactorSecret = undefined;
    await user.save();

    logger.info('[auth] TOTP MFA disabled', { userId: user._id.toString(), email: user.email });

    recordAuditEvent({
      eventType: SOC2_EVENT_TYPES.MFA_TOTP_DISABLE,
      userId: user._id.toString(),
      severity: 'medium',
      details: { method: isBackupCode ? 'backup_code' : 'totp_token' },
      ip: req.ip,
      userAgent: req.get('user-agent'),
      resource: user._id.toString(),
      resourceType: 'user',
      success: true,
    });

    res.json({ success: true, message: 'Two-factor authentication (TOTP) disabled successfully' });
  } catch (err) { next(err); }
};

// ─── 2FA endpoints ────────────────────────────────────────

// Security: Uses a signed twoFactorToken instead of accepting userId in body.
// Supports both TOTP (RFC 6238) and legacy random OTP flows.
export const verify2FA = async (req, res, next) => {
  try {
    const { twoFactorToken, otp } = req.body;

    if (!twoFactorToken) {
      throw new ApiError(400, 'twoFactorToken is required');
    }

    let decoded;
    try {
      decoded = verifyTwoFactorToken(twoFactorToken);
    } catch {
      throw new ApiError(401, 'Invalid or expired 2FA token');
    }

    const user = await User.findById(decoded.sub).select('+twoFactorSecret +totpSecret +totpBackupCodes');
    if (!user) throw new ApiError(404, 'User not found');

    const isTotp = user.twoFactorEnabled && user.twoFactorType === 'totp' && user.totpSecret;

    if (isTotp) {
      const decryptedSecret = decryptSecret(user.totpSecret);
      if (!decryptedSecret) throw new ApiError(401, 'Invalid 2FA configuration');
      if (!verifyTotpToken(decryptedSecret, otp)) {
        throw new ApiError(401, 'Invalid verification code');
      }
    } else {
      if (!user.twoFactorSecret || user.twoFactorSecret !== hashToken(otp)) {
        throw new ApiError(401, 'Invalid verification code');
      }
    }

    const { access, refresh } = issueTokens(user);
    user.refreshTokens.push(refresh);
    user.twoFactorSecret = undefined;
    user.totpAttempts = 0;
    user.totpLockedUntil = null;
    await user.save();

    res.cookie('refreshToken', refresh, cookieOpts);
    res.json({
      success: true,
      accessToken: access,
      twoFactorType: isTotp ? 'totp' : 'otp',
      user: { id: user._id, name: user.name, email: user.email, role: user.role, isEmailVerified: user.isEmailVerified, language: user.language || 'en' },
    });
  } catch (err) { next(err); }
};

// ─── Enhanced login with device tracking ──────────────────

// Security improvements:
//  - Brute-force protection (failedLoginAttempts, lockedUntil)
//  - Email verification check
//  - Secure 2FA flow using signed token
export const loginEnhanced = async (req, res, next) => {
  try {
    const { email, password, device, location } = req.body;
    const user = await User.findOne({ email }).select('+password +refreshTokens +failedLoginAttempts +lockedUntil');

    if (!user) {
      throw new ApiError(401, 'Invalid credentials');
    }
    if (!user.isActive) throw new ApiError(403, 'Account disabled');

    if (user.lockedUntil && user.lockedUntil > Date.now()) {
      const remainingMs = user.lockedUntil - Date.now();
      const remainingMin = Math.ceil(remainingMs / 60000);
      throw new ApiError(403, `Account locked due to too many failed attempts. Try again in ${remainingMin} minutes.`);
    }

    const passwordMatch = await user.comparePassword(password);
    if (!passwordMatch) {
      user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
      if (user.failedLoginAttempts >= config.security.maxLoginAttempts) {
        user.lockedUntil = Date.now() + config.security.lockoutDuration;
        logger.warn(`Account locked: ${maskEmail(email)} after ${user.failedLoginAttempts} failed attempts`, { email: maskEmail(email), ip: req.ip });
      }
      await user.save();
      recordActivity(user._id, {
        type: 'login',
        action: 'Failed login attempt (enhanced)',
        ip: req.ip || '',
        location: location || '',
        device: device || '',
        success: false,
        metadata: { source: 'loginEnhanced', failedAttempts: user.failedLoginAttempts },
      }).catch((err) => logger.warn('[ueba] Failed login activity recording failed', { error: err.message }));
      throw new ApiError(401, 'Invalid credentials');
    }

    if (!user.isEmailVerified) {
      throw new ApiError(403, 'Please verify your email address before logging in.');
    }

    user.failedLoginAttempts = 0;
    user.lockedUntil = null;

    const isNewDevice = device && user.lastLoginDevice && user.lastLoginDevice !== device;
    const isNewLocation = location && user.lastLoginLocation && user.lastLoginLocation !== location;
    const isSuspicious = isNewDevice || isNewLocation;

    if (isSuspicious) {
      await sendSuspiciousLoginEmail(user.email, device || 'Unknown', location || 'Unknown');
    }

    user.lastLogin = new Date();
    user.lastLoginIp = req.ip || '';
    user.lastLoginLocation = location || user.lastLoginLocation;
    user.lastLoginDevice = device || user.lastLoginDevice;
    user.loginHistory.push({
      ip: req.ip || '',
      location: location || '',
      device: device || '',
      time: new Date(),
      success: true,
    });
    if (user.loginHistory.length > 50) user.loginHistory = user.loginHistory.slice(-50);

    recordActivity(user._id, {
      type: 'login',
      action: 'User logged in (enhanced)',
      ip: req.ip || '',
      location: location || user.lastLoginLocation || '',
      device: device || user.lastLoginDevice || '',
      success: true,
      metadata: { source: 'loginEnhanced', suspicious: isSuspicious, device, location },
    }).catch((err) => logger.warn('[ueba] Login activity recording failed', { error: err.message }));

    if (user.twoFactorEnabled) {
      if (user.twoFactorType === 'totp' && user.totpSecret) {
        const twoFactorToken = signTwoFactorToken(user._id.toString());
        return res.json({
          success: true,
          requires2FA: true,
          twoFactorType: 'totp',
          twoFactorToken,
          deviceInfo: { device: device || 'Unknown', location: location || 'Unknown', time: new Date().toISOString() },
          message: '2FA verification required',
        });
      }
      const otp = crypto.randomInt(100000, 1000000).toString();
      user.twoFactorSecret = hashToken(otp);
      await user.save();
      const twoFactorToken = signTwoFactorToken(user._id.toString());
      return res.json({
        success: true,
        requires2FA: true,
        twoFactorType: 'otp',
        twoFactorToken,
        deviceInfo: { device: device || 'Unknown', location: location || 'Unknown', time: new Date().toISOString() },
        message: '2FA verification required',
      });
    }

    const { access, refresh } = issueTokens(user);
    user.refreshTokens.push(refresh);
    await user.save();

    res.cookie('refreshToken', refresh, cookieOpts);
    res.json({
      success: true,
      accessToken: access,
      user: { id: user._id, name: user.name, email: user.email, role: user.role, isEmailVerified: user.isEmailVerified, language: user.language || 'en' },
      suspicious: isSuspicious,
      lastLogin: { device: user.lastLoginDevice, location: user.lastLoginLocation, time: user.lastLogin },
    });
  } catch (err) { next(err); }
};

export default { register, login, verifyEmail, forgotPassword, resetPassword, refreshToken, logout, me, updateName, changePassword, updateLanguage, sendOTP, verifyOTP, resetPasswordWithOTP, verify2FA, loginEnhanced, setupTOTP, enableTOTP, verifyTOTP, getBackupCodes, disableTOTP };