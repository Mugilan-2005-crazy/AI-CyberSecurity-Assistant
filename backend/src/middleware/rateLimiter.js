/**
 * middleware/rateLimiter.js
 * ------------------------------------------------------------
 * Configurable rate limiting using express-rate-limit + a
 * custom key generator (IP + route) so each endpoint is
 * throttled independently. Prevents brute-force & abuse.
 */
import rateLimit from 'express-rate-limit';
import ApiError from '../utils/ApiError.js';

export const rateLimiter = (windowMs = 15 * 60 * 1000, max = 100, message = 'Too many requests') =>
  rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, _res, next) => next(new ApiError(429, message)),
    keyGenerator: (req) => `${req.ip}:${req.baseUrl}${req.route?.path || ''}`,
  });

// Stricter limiter for auth endpoints (brute-force protection).
export const authLimiter = rateLimiter(15 * 60 * 1000, 10, 'Too many auth attempts, try later');

export default { rateLimiter, authLimiter };
