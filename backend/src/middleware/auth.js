/**
 * middleware/auth.js
 * ------------------------------------------------------------
 * Protects routes by validating the Bearer JWT access token
 * and attaching the authenticated user to req.user.
 */
import { verifyAccessToken } from '../utils/jwt.js';
import ApiError from '../utils/ApiError.js';

export const protect = (req, _res, next) => {
  try {
    const header = req.headers.authorization || '';
    if (!header.startsWith('Bearer ')) {
      throw new ApiError(401, 'Not authorized, no token');
    }
    const token = header.split(' ')[1];
    const decoded = verifyAccessToken(token);
    req.user = { id: decoded.sub, role: decoded.role, email: decoded.email, language: decoded.language || 'en' };
    next();
  } catch (err) {
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
