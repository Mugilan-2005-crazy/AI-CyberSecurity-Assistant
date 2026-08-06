/**
 * middleware/rateLimiter.js
 * ------------------------------------------------------------
 * Configurable rate limiting using express-rate-limit + a
 * custom key generator (IP + route) so each endpoint is
 * throttled independently. Prevents brute-force & abuse.
 *
 * Uses a Redis-backed store (with MemoryStore fallback) so
 * that TTL expiration is handled by Redis server-side,
 * preventing stale rate-limit entries that block legitimate
 * clients in production.
 *
 * In test environment (NODE_ENV=test), rate limiting is
 * automatically disabled to avoid blocking test requests.
 */
import rateLimit from 'express-rate-limit';
import ApiError from '../utils/ApiError.js';
import { createRateLimitStore } from '../services/cache/rateLimitStore.js';

export const rateLimiter = (windowMs = 15 * 60 * 1000, max = 100, message = 'Too many requests') => {
  // Disable rate limiting in test environment
  if (process.env.NODE_ENV === 'test') {
    return (_req, _res, next) => next();
  }

  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, _res, next) => next(new ApiError(429, message)),
    keyGenerator: (req) => `${req.ip}:${req.baseUrl}${req.route?.path || ''}`,
    store: createRateLimitStore(),
  });
};

// Stricter limiter for auth endpoints (brute-force protection).
export const authLimiter = rateLimiter(15 * 60 * 1000, 10, 'Too many auth attempts, try later');

// AI chat endpoints.
export const chatLimiter = rateLimiter(60 * 1000, 20, 'Too many chat messages, slow down');
export const chatUploadLimiter = rateLimiter(60 * 1000, 5, 'Too many file analyses, slow down');
export const webSearchLimiter = rateLimiter(60 * 1000, 10, 'Too many web searches, slow down');

// Security scan endpoints.
export const scanLimiter = rateLimiter(60 * 1000, 30, 'Too many scans, slow down');
export const qrScanLimiter = rateLimiter(60 * 1000, 20, 'Too many QR scans, slow down');
export const fileScanLimiter = rateLimiter(60 * 1000, 15, 'Too many file scans, slow down');

export default { rateLimiter, authLimiter, chatLimiter, chatUploadLimiter, webSearchLimiter, scanLimiter, qrScanLimiter, fileScanLimiter };
