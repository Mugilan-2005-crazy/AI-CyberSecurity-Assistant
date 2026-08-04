/**
 * middleware/requestSizeLimit.js
 * ------------------------------------------------------------
 * Limits request body size to prevent memory exhaustion attacks.
 * Must be registered before body parsing middleware.
 */
import ApiError from '../utils/ApiError.js';

export const requestSizeLimit = (maxBytes = 10 * 1024 * 1024) => {
  return (req, res, next) => {
    const contentLength = parseInt(req.headers['content-length'] || '0', 10);
    if (contentLength > maxBytes) {
      return next(new ApiError(413, `Request body too large. Maximum size is ${maxBytes} bytes.`));
    }
    next();
  };
};

export default requestSizeLimit;
