/**
 * middleware/tenantIsolation.js
 * ------------------------------------------------------------
 * Ensures users can only access resources they own.
 * For admin routes, this middleware is skipped (handled by authorize).
 * For user routes, it validates ownership of the target resource.
 */
import ApiError from '../utils/ApiError.js';

export const ownResource = (modelName, idParam = 'id', ownerField = 'user') => {
  return async (req, _res, next) => {
    try {
      if (req.user?.role === 'admin') return next();

      const resourceId = req.params[idParam];
      if (!resourceId) return next(new ApiError(400, 'Resource ID required'));

      const Model = (await import(`../models/${modelName}.js`)).default;
      const resource = await Model.findById(resourceId).select(ownerField).lean();

      if (!resource) {
        return next(new ApiError(404, 'Resource not found'));
      }

      const ownerId = resource[ownerField]?.toString();
      if (ownerId !== req.user?.id) {
        return next(new ApiError(403, 'Not authorized to access this resource'));
      }

      next();
    } catch (err) {
      next(new ApiError(500, 'Tenant isolation check failed'));
    }
  };
};

export default { ownResource };
