/**
 * controllers/authController.js
 * ------------------------------------------------------------
 * Handles registration, login, email verification, password
 * reset (token + OTP), refresh tokens, 2FA verification,
 * and current-user lookup. Issues JWT access + refresh tokens
 * and stores refresh tokens on the user.
 */
import crypto from 'crypto';
import User from '../models/User.js';
import ApiError from '../utils/ApiError.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt.js';
import { generateToken, hashToken } from '../utils/tokens.js';
import { sendVerificationEmail, sendPasswordResetEmail, sendOTPEmail, sendSuspiciousLoginEmail } from '../utils/email.js';

const cookieOpts = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: 30 * 24 * 60 * 60 * 1000,
};

const issueTokens = (user) => {
  const access = signAccessToken({ sub: user._id.toString(), role: user.role, email: user.email, language: user.language || 'en' });
  const refresh = signRefreshToken({ sub: user._id.toString() });
  return { access, refresh };
};

const maskEmail = (email) => {
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
    const user = await User.findOne({ email }).select('+password +refreshTokens');
    if (!user || !(await user.comparePassword(password))) {
      throw new ApiError(401, 'Invalid credentials');
    }
    if (!user.isActive) throw new ApiError(403, 'Account disabled');

    user.lastLogin = new Date();
    const { access, refresh } = issueTokens(user);
    user.refreshTokens.push(refresh);
    await user.save();

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

export const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) throw new ApiError(404, 'No account with that email');
    const token = generateToken();
    user.passwordResetToken = hashToken(token);
    user.passwordResetExpire = Date.now() + 60 * 60 * 1000;
    await user.save();
    await sendPasswordResetEmail(email, token);
    res.json({ success: true, message: 'Password reset email sent' });
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
    user.refreshTokens = []; // force re-login everywhere
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
    const access = signAccessToken({ sub: user._id.toString(), role: user.role, email: user.email });
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
    res.clearCookie('refreshToken', cookieOpts);
    res.json({ success: true, message: 'Logged out' });
  } catch (err) { next(err); }
};

export const me = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) throw new ApiError(404, 'User not found');

    // Account stats from the scan + chat collections (best-effort).
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

// PATCH /api/auth/me — update the display name (min 2 chars).
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

// POST /api/auth/change-password — verify current password, set a new one.
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
    user.refreshTokens = []; // force re-login on all devices
    await user.save();
    res.json({ success: true, message: 'Password updated successfully' });
  } catch (err) { next(err); }
};

// PATCH /api/auth/me/language — update the user's language preference.
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

// POST /api/auth/forgot-password/send-otp — send 6-digit OTP to email
export const sendOTP = async (req, res, next) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) throw new ApiError(404, 'No account with that email');

      const otp = crypto.randomInt(100000, 1000000).toString();
    user.passwordResetOTP = hashToken(otp);
    user.passwordResetOTPExpire = Date.now() + 10 * 60 * 1000; // 10 min
    await user.save();

    await sendOTPEmail(email, otp);
    res.json({
      success: true,
      maskedEmail: maskEmail(email),
      message: 'OTP sent to your email',
    });
  } catch (err) { next(err); }
};

// POST /api/auth/forgot-password/verify-otp — verify OTP
export const verifyOTP = async (req, res, next) => {
  try {
    const { email, otp } = req.body;
    const user = await User.findOne({ email }).select('+passwordResetOTP +passwordResetOTPExpire');
    if (!user || !user.passwordResetOTP) throw new ApiError(400, 'No OTP request found');
    if (user.passwordResetOTPExpire < Date.now()) throw new ApiError(400, 'OTP has expired');
    if (user.passwordResetOTP !== hashToken(otp)) throw new ApiError(400, 'Invalid OTP');

    // OTP verified — generate a short-lived reset token
    const resetToken = generateToken();
    user.passwordResetToken = hashToken(resetToken);
    user.passwordResetExpire = Date.now() + 10 * 60 * 1000;
    user.passwordResetOTP = undefined;
    user.passwordResetOTPExpire = undefined;
    await user.save();

    res.json({ success: true, message: 'OTP verified' });
  } catch (err) { next(err); }
};

// POST /api/auth/forgot-password/reset — reset password with OTP-verified token
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

// ─── 2FA endpoints ────────────────────────────────────────

// POST /api/auth/2fa/verify — verify 2FA after login
export const verify2FA = async (req, res, next) => {
  try {
    const { userId, otp, trustDevice } = req.body;
    const user = await User.findById(userId).select('+twoFactorSecret');
    if (!user) throw new ApiError(404, 'User not found');

    // For simplicity, use a 6-digit OTP match (can be upgraded to TOTP)
    if (user.twoFactorSecret !== hashToken(otp)) {
      throw new ApiError(401, 'Invalid verification code');
    }

    const { access, refresh } = issueTokens(user);
    user.refreshTokens.push(refresh);
    if (trustDevice) user.twoFactorSecret = undefined; // bypass next time (simplified)
    await user.save();

    res.cookie('refreshToken', refresh, cookieOpts);
    res.json({
      success: true,
      accessToken: access,
      user: { id: user._id, name: user.name, email: user.email, role: user.role, isEmailVerified: user.isEmailVerified, language: user.language || 'en' },
    });
  } catch (err) { next(err); }
};

// ─── Enhanced login with device tracking ──────────────────

// POST /api/auth/login-enhanced — login with device tracking + suspicious detection
export const loginEnhanced = async (req, res, next) => {
  try {
    const { email, password, device, location } = req.body;
    const user = await User.findOne({ email }).select('+password +refreshTokens');
    if (!user || !(await user.comparePassword(password))) {
      throw new ApiError(401, 'Invalid credentials');
    }
    if (!user.isActive) throw new ApiError(403, 'Account disabled');

    // Detect suspicious login
    const isNewDevice = device && user.lastLoginDevice && user.lastLoginDevice !== device;
    const isNewLocation = location && user.lastLoginLocation && user.lastLoginLocation !== location;
    const isSuspicious = isNewDevice || isNewLocation;

    if (isSuspicious) {
      await sendSuspiciousLoginEmail(user.email, device || 'Unknown', location || 'Unknown');
    }

    // Update login tracking
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

    // Check 2FA
    if (user.twoFactorEnabled) {
    const otp = crypto.randomInt(100000, 1000000).toString();
      user.twoFactorSecret = hashToken(otp);
      await user.save();
      // In production, send OTP via email/SMS here
      return res.json({
        success: true,
        requires2FA: true,
        userId: user._id,
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

export default { register, login, verifyEmail, forgotPassword, resetPassword, refreshToken, logout, me, updateName, changePassword, updateLanguage, sendOTP, verifyOTP, resetPasswordWithOTP, verify2FA, loginEnhanced };
