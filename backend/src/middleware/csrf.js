/**
 * middleware/csrf.js
 * ------------------------------------------------------------
 * CSRF protection for state-changing requests.
 * For JWT-authenticated API requests (Bearer token), CSRF is not required
 * because the token must be explicitly provided by the client.
 * For cookie-authenticated requests (refresh token), CSRF protection applies.
 */
import ApiError from '../utils/ApiError.js';

export const csrfProtection = (req, _res, next) => {
  const method = req.method;
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    return next();
  }

  const authHeader = req.headers.authorization || '';
  if (authHeader.startsWith('Bearer ')) {
    return next();
  }

  const requestedWith = req.headers['x-requested-with'];
  if (requestedWith === 'XMLHttpRequest') {
    return next();
  }

  const csrfToken = req.headers['x-csrf-token'] || req.body?._csrf;
  if (csrfToken && typeof csrfToken === 'string' && csrfToken.trim().length > 0) {
    return next();
  }

  return next(new ApiError(403, 'CSRF token missing or invalid'));
};

export default csrfProtection;
