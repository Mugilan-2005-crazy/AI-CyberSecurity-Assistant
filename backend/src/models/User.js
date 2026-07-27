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
    role: { type: String, enum: ['user', 'admin'], default: 'user' },

    isEmailVerified: { type: Boolean, default: false },
    emailVerificationToken: { type: String, select: false },
    emailVerificationExpire: { type: Date, select: false },

    passwordResetToken: { type: String, select: false },
    passwordResetExpire: { type: Date, select: false },

    refreshTokens: [{ type: String, select: false }],

    lastLogin: { type: Date },
    isActive: { type: Boolean, default: true },
    language: { type: String, default: 'en', maxlength: 10 },
  },
  { timestamps: true }
);

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
