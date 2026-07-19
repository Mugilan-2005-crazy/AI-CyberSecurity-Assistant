/**
 * middleware/validate.js
 * ------------------------------------------------------------
 * Validates incoming requests with express-validator and
 * returns a 422 with field-level errors when validation fails.
 * Used as: router.post('/x', validate([...]), controller)
 */
import { validationResult } from 'express-validator';
import ApiError from '../utils/ApiError.js';

export const validate = (validators) => [
  ...validators,
  (req, _res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const message = errors
        .array()
        .map((e) => `${e.path}: ${e.msg}`)
        .join(', ');
      return next(new ApiError(422, message));
    }
    next();
  },
];

export default validate;
