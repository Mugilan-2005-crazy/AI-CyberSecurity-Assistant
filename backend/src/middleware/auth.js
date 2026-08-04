/**
 * middleware/auth.js
 * ------------------------------------------------------------
 * Protects routes by validating the Bearer JWT access token
 * and attaching the authenticated user to req.user.
 *
 * Security improvements (Batch #2):
 *  - Verifies user still exists in the database
 *  - Verifies account is still active (not disabled/suspended)
 *  - Rejects deleted, suspended, or disabled accounts
 *  - Uses lightweight query (only selects needed fields)
 */
import { verifyAccessToken } from '../utils/jwt.js';
import ApiError from '../utils/ApiError.js';
import User from '../models/User.js';

export const protect = async (req, _res, next) => {
  try {
    const header = req.headers.authorization || '';
    if (!header.startsWith('Bearer ')) {
      throw new ApiError(401, 'Not authorized, no token');
    }
    const token = header.split(' ')[1];
    const decoded = verifyAccessToken(token);

    // Security: Verify the user still exists and is active.
    // This prevents deleted/disabled users from using valid tokens
    // until they expire. Uses a lightweight query for performance.
    const user = await User.findById(decoded.sub).select('role email language isActive isEmailVerified').lean();

    if (!user) {
      throw new ApiError(401, 'User no longer exists');
    }

    if (!user.isActive) {
      throw new ApiError(403, 'Account has been disabled');
    }

    req.user = {
      id: decoded.sub,
      role: user.role,
      email: user.email,
      language: user.language || 'en',
      isEmailVerified: user.isEmailVerified,
    };
    next();
  } catch (err) {
    // Preserve the ApiError's status code if it's already an ApiError.
    // This ensures 403 (disabled account) isn't rewritten as 401.
    if (err instanceof ApiError) {
      return next(err);
    }
    next(new ApiError(401, 'Not authorized, token failed'));
  }
};

/**
 * Ensures the authenticated user has one of the allowed roles.
 * Usage: router.use(protect, authorize('admin'))
 */
export const authorize = (...roles) => (req, _res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return next(new ApiError(403, 'Not authorized as an admin'));
  }
  next();
};

export default { protect, authorize };