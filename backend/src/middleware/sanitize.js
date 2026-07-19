/**
 * middleware/sanitize.js
 * ------------------------------------------------------------
 * Defense-in-depth: strips common NoSQL injection operators
 * and trims strings from req.body/query/params. Should run
 * before validation. (express-validator still enforces types.)
 */
const stripNoSql = (value) => {
  if (Array.isArray(value)) return value.map(stripNoSql);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([k]) => !['$where', '$gt', '$lt', '$ne', '$regex', '$exists'].includes(k))
        .map(([k, v]) => [k, stripNoSql(v)])
    );
  }
  if (typeof value === 'string') return value.trim();
  return value;
};

export const sanitize = (req, _res, next) => {
  if (req.body) req.body = stripNoSql(req.body);
  if (req.query) req.query = stripNoSql(req.query);
  if (req.params) req.params = stripNoSql(req.params);
  next();
};

export default sanitize;
