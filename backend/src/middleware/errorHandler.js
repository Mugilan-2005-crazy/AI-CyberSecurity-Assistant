/**
 * middleware/errorHandler.js
 * ------------------------------------------------------------
 * Central error handler (must be registered last in app.js).
 *  - Operational ApiError -> respond with its status/message
 *  - Unexpected errors -> 500, no internal detail leaked in prod
 *  - Mongoose duplicate key -> friendly 409
 *  - Validation errors -> 422
 */
import logger from '../utils/logger.js';
import { ApiError } from '../utils/ApiError.js';

// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, _next) => {
  let { statusCode = 500, message } = err;

  if (err.code === 11000) {
    statusCode = 409;
    message = 'Resource already exists (duplicate key).';
  } else if (err.name === 'ValidationError') {
    statusCode = 422;
    message = Object.values(err.errors).map((e) => e.message).join(', ');
  } else if (err.name === 'CastError') {
    statusCode = 400;
    message = 'Invalid ID format.';
  }

  if (statusCode >= 500) logger.error(`Unhandled error: ${err.stack || err.message}`, { reqId: req.id });

  res.status(statusCode).json({
    success: false,
    message: statusCode >= 500 && process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
    requestId: req.id,
  });
};

// 404 handler for unmatched routes.
export const notFound = (req, _res, next) => {
 next(new ApiError(404, 'Route not found'));
};

export default errorHandler;
