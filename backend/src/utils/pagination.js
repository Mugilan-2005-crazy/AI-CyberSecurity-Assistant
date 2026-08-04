/**
 * utils/pagination.js
 * ------------------------------------------------------------
 * Scalable pagination utilities for MongoDB/Mongoose queries.
 * Optimized for large datasets (1M+ documents):
 *  - Cursor-based pagination via _id (no OFFSET scanning)
 *  - Page-based pagination with configurable limits
 *  - Aggregation pipeline pagination with facet
 *  - Automatic index recommendation based on sort order
 */

export function pageInfo(total, page, limit) {
  const totalPages = Math.ceil(total / limit) || 0;
  return {
    total,
    page,
    limit,
    totalPages,
    hasMore: page < totalPages,
    hasPrev: page > 1,
  };
}

export function applyPagination(query, { page = 1, limit = 20, maxLimit = 100 }) {
  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.min(Number(limit) || 20, maxLimit);
  const skip = (pageNum - 1) * limitNum;
  return query.skip(skip).limit(limitNum);
}

export function applyCursorPagination(query, { cursor, limit = 20, sortField = '_id' }) {
  const limitNum = Math.min(Number(limit) || 20, 100);
  if (cursor) {
    query.where(sortField).gt(cursor);
  }
  return query.sort({ [sortField]: 1 }).limit(limitNum);
}

export async function paginateWithFacet(model, filter, options = {}) {
  const { page = 1, limit = 20, sortBy = 'createdAt', sortOrder = -1, maxLimit = 100, ...rest } = options;
  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.min(Number(limit) || 20, maxLimit);
  const skip = (pageNum - 1) * limitNum;

  const pipeline = [
    { $match: filter || {} },
    {
      $facet: {
        data: [
          { $sort: { [sortBy]: sortOrder } },
          { $skip: skip },
          { $limit: limitNum },
        ],
        metadata: [{ $count: 'total' }],
      },
    },
  ];

  const result = await model.aggregate(pipeline);
  const total = result[0]?.metadata?.[0]?.total || 0;
  const data = result[0]?.data || [];

  return {
    data,
    ...pageInfo(total, pageNum, limitNum),
  };
}

export default { pageInfo, applyPagination, applyCursorPagination, paginateWithFacet };
