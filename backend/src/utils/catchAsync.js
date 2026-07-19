/**
 * utils/catchAsync.js
 * ------------------------------------------------------------
 * Wraps an async Express handler so thrown/rejected promises
 * are forwarded to the error middleware automatically. Removes
 * repetitive try/catch blocks in controllers.
 */
export const catchAsync = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

export default catchAsync;
