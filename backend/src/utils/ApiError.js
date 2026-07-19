/**
 * utils/ApiError.js
 * ------------------------------------------------------------
 * Custom error class carrying an HTTP status code. Used
 * together with the global error handler so controllers can
 * throw meaningful errors (e.g. new ApiError(401, 'Invalid')).
 */
export class ApiError extends Error {
  constructor(statusCode, message, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

export default ApiError;
