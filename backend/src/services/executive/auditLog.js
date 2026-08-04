/**
 * services/executive/auditLog.js
 * ============================================================
 * PHASE 4 — Executive audit logging.
 *
 * Reuses the existing Winston logger (no new MongoDB collection).
 * Records structured `audit` entries for:
 *   - Executive report generation
 *   - Export actions (pdf/csv/excel/print)
 *   - AI Summary generation
 */
import logger from '../../utils/logger.js';

export const AUDIT_ACTIONS = {
  REPORT_GENERATED: 'executive.report.generated',
  EXPORT: 'executive.export',
  AI_SUMMARY: 'executive.ai.summary',
};

/**
 * Write an audit entry via the shared logger with `audit:true` + action metadata.
 * @param {object} opts { action, userId, email, period, format, details }
 */
export const audit = ({ action, userId, email, period, format, details = {} }) => {
  logger.info(`[audit] ${action}`, {
    audit: true,
    action,
    userId,
    email,
    period,
    format,
    ...details,
    timestamp: new Date().toISOString(),
  });
};

export default { audit, AUDIT_ACTIONS };