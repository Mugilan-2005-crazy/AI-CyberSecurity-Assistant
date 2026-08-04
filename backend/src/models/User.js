/**
 * models/User.js
 * ------------------------------------------------------------
 * Mongoose schema for the "Users" collection.
 * Responsibilities:
 *  - Stores credentials (hashed), role (user|admin)
 *  - Email verification + password reset tokens
 *  - Refresh token list (allows revocation)
 *  - Hooks: bcrypt password hashing before save
 *
 * Passwords are NEVER stored in plaintext (bcrypt, 12 rounds).
 */
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    password: { type: String, required: true, minlength: 8, select: false },
    role: { type: String, enum: ['user', 'admin', 'security_manager', 'cloud_admin', 'cloud_viewer', 'container_admin', 'devops', 'auditor'], default: 'user' },

    isEmailVerified: { type: Boolean, default: false },
    emailVerificationToken: { type: String, select: false },
    emailVerificationExpire: { type: Date, select: false },

    passwordResetToken: { type: String, select: false },
    passwordResetExpire: { type: Date, select: false },

    // OTP-based password reset fields
    passwordResetOTP: { type: String, select: false },
    passwordResetOTPExpire: { type: Date, select: false },
    passwordResetPhone: { type: String, select: false, default: '' },

    // 2FA fields
    twoFactorEnabled: { type: Boolean, default: false },
    twoFactorSecret: { type: String, select: false },
    twoFactorType: { type: String, enum: ['otp', 'totp'], default: 'totp' },
    totpSecret: { type: String, select: false },
    totpBackupCodes: [{ type: String, select: false }],
    totpBackupCodesUsed: [{ type: String }],
    totpAttempts: { type: Number, default: 0 },
    totpLockedUntil: { type: Date, default: null },

    // Login activity tracking
    lastLoginIp: { type: String, default: '' },
    lastLoginLocation: { type: String, default: '' },
    lastLoginDevice: { type: String, default: '' },
    loginHistory: [
      {
        ip: String,
        location: String,
        device: String,
        time: { type: Date, default: Date.now },
        success: { type: Boolean, default: true },
      },
    ],

    refreshTokens: [{ type: String, select: false }],

    lastLogin: { type: Date },
    isActive: { type: Boolean, default: true },
    language: { type: String, default: 'en', maxlength: 10 },

    failedLoginAttempts: { type: Number, default: 0 },
    lockedUntil: { type: Date, default: null },
  },
  { timestamps: true }
);

userSchema.index({ emailVerificationExpire: 1 }, { expireAfterSeconds: 0 });
userSchema.index({ passwordResetExpire: 1 }, { expireAfterSeconds: 0 });
userSchema.index({ passwordResetOTPExpire: 1 }, { expireAfterSeconds: 0 });
userSchema.index({ totpLockedUntil: 1 }, { expireAfterSeconds: 0 });
// Scale: indexes for admin panel user listing + search
userSchema.index({ role: 1, isActive: 1, createdAt: 1 });
userSchema.index({ isActive: 1, lastLogin: 1 });
userSchema.index({ twoFactorEnabled: 1 });
userSchema.index({ name: 'text', email: 'text' });

// Hash password on every save where the password field changed.
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

const User = mongoose.model('User', userSchema);
export default User;
