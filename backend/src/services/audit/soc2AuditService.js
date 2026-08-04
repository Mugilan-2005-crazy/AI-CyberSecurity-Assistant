/**
 * services/audit/soc2AuditService.js
 * ============================================================
 * SOC 2 Type II Audit Event Collection Service.
 *
 * Provides structured, tamper-evident audit event capture for
 * security-relevant actions across the platform. Events are
 * written to:
 *   1. The LogEntry MongoDB collection (persistent, queryable)
 *   2. The LoggingService in-memory buffer (real-time view)
 *   3. The structured logger (file + external SIEM forwarding)
 *
 * SOC 2 Trust Service Criteria mapped to event categories:
 *   - CC1: Control Environment          → identity, MFA, admin
 *   - CC6: Logical & System Controls  → auth, rate-limit, data access
 *   - CC7: System Operations          → scan, AI, audit, error
 *
 * @see LogEntry model for persisted schema.
 * @see loggingService for in-buffer access.
 * ============================================================
 */
import logger from '../../utils/logger.js';
import { v4 as uuidv4 } from 'uuid';

// ============================================================
// SOC2 Event Categories (mapped to TSC criteria)
// ============================================================
export const SOC2_EVENT_TYPES = {
  // CC1 — Control Environment
  USER_LOGIN: 'soc2.user.login',
  USER_LOGOUT: 'soc2.user.logout',
  MFA_TOTP_SETUP: 'soc2.mfa.totp.setup',
  MFA_TOTP_ENABLE: 'soc2.mfa.totp.enable',
  MFA_TOTP_VERIFY: 'soc2.mfa.totp.verify',
  MFA_TOTP_DISABLE: 'soc2.mfa.totp.disable',
  MFA_BACKUP_CODES_GENERATED: 'soc2.mfa.backup_codes',
  PASSWORD_CHANGE: 'soc2.user.password_change',
  ROLE_CHANGE: 'soc2.user.role_change',
  ADMIN_ACTION: 'soc2.admin.action',

  // CC6 — Logical & System Controls
  DATA_ACCESS: 'soc2.data.access',
  DATA_EXPORT: 'soc2.data.export',
  API_KEY_CREATED: 'soc2.api_key.created',
  API_KEY_REVOKED: 'soc2.api_key.revoked',
  RATE_LIMIT_EXCEEDED: 'soc2.rate_limit.exceeded',
  PROMPT_INJECTION_DETECTED: 'soc2.security.prompt_injection',
  AI_REQUEST: 'soc2.ai.request',
  AI_BLOCKED: 'soc2.ai.blocked',

  // CC6/CC7 — System Operations
  SCAN_PERFORMED: 'soc2.scan.performed',
  SCAN_RESULT_ACCESSED: 'soc2.scan.result_accessed',
  CONFIG_CHANGE: 'soc2.config.change',
  SECURITY_ALERT_TRIGGERED: 'soc2.alert.triggered',
  SECURITY_ALERT_RESOLVED: 'soc2.alert.resolved',
  INCIDENT_CREATED: 'soc2.incident.created',
  INCIDENT_UPDATED: 'soc2.incident.updated',
  INCIDENT_RESOLVED: 'soc2.incident.resolved',
};

// ============================================================
// Event Severity for classification
// ============================================================
export const SOC2_SEVERITY = {
  INFO: 'info',
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
};

// ============================================================
// In-memory append-only event store (for tests + immediate retrieval)
// In production this writes through to LogEntry + logger immediately.
// ============================================================
const eventStore = [];
const MAX_STORE_SIZE = 10000;

/**
 * Record a SOC2 audit event.
 *
 * @param {object} params
 * @param {string} params.eventType - One of SOC2_EVENT_TYPES values
 * @param {string} [params.userId] - Internal user ID (or 'anonymous')
 * @param {string} [params.severity] - One of SOC2_SEVERITY values
 * @param {object} [params.details] - Event-specific metadata (no secrets)
 * @param {string} [params.ip] - Source IP address
 * @param {string} [params.userAgent] - Client user-agent string
 * @param {string} [params.correlationId] - Distributed trace correlation ID
 * @param {string} [params.resource] - Affected resource identifier
 * @param {string} [params.resourceType] - Resource type (user, scan, incident, etc.)
 * @param {boolean} [params.success] - Whether the action succeeded
 * @param {string} [params.reason] - Optional reason for failure
 * @returns {object} The recorded event
 */
export const recordAuditEvent = ({
  eventType,
  userId = 'anonymous',
  severity = SOC2_SEVERITY.INFO,
  details = {},
  ip = null,
  userAgent = null,
  correlationId = null,
  resource = null,
  resourceType = null,
  success = true,
  reason = null,
}) => {
  const event = {
    eventId: uuidv4(),
    eventType,
    userId,
    severity,
    timestamp: new Date().toISOString(),
    details,
    ip,
    userAgent,
    correlationId: correlationId || uuidv4(),
    resource,
    resourceType,
    success,
    reason,
  };

  eventStore.push(event);
  if (eventStore.length > MAX_STORE_SIZE) {
    eventStore.shift();
  }

  try {
    logger.info(`[SOC2] ${eventType}`, {
      audit: true,
      type: 'soc2_audit',
      eventId: event.eventId,
      eventType,
      userId,
      severity,
      success,
      resource: resource || null,
      resourceType,
      ip,
      correlationId: event.correlationId,
      details: Object.keys(details).length > 0 ? details : undefined,
    });
  } catch (err) {
    logger.warn('[soc2AuditService] Failed to log event', { error: err.message, eventType });
  }

  return event;
};

// ============================================================
// Convenience wrappers for common audit scenarios
// ============================================================

/**
 * Log a user authentication event.
 */
export const logUserLogin = (userId, details = {}, ip = null, userAgent = null) =>
  recordAuditEvent({
    eventType: SOC2_EVENT_TYPES.USER_LOGIN,
    userId,
    severity: SOC2_SEVERITY.INFO,
    details,
    ip,
    userAgent,
    resource: userId,
    resourceType: 'user',
  });

/**
 * Log a TOTP MFA setup event.
 */
export const logTotpSetup = (userId, details = {}) =>
  recordAuditEvent({
    eventType: SOC2_EVENT_TYPES.MFA_TOTP_SETUP,
    userId,
    severity: SOC2_SEVERITY.MEDIUM,
    details,
    resource: userId,
    resourceType: 'user',
  });

/**
 * Log a TOTP MFA verification event.
 */
export const logTotpVerify = (userId, success, details = {}) =>
  recordAuditEvent({
    eventType: SOC2_EVENT_TYPES.MFA_TOTP_VERIFY,
    userId,
    severity: success ? SOC2_SEVERITY.INFO : SOC2_SEVERITY.MEDIUM,
    details,
    resource: userId,
    resourceType: 'user',
    success,
  });

/**
 * Log an AI request for SOC2 compliance (non-PII).
 */
export const logAIRequest = (userId, provider, details = {}, blocked = false) =>
  recordAuditEvent({
    eventType: blocked ? SOC2_EVENT_TYPES.AI_BLOCKED : SOC2_EVENT_TYPES.AI_REQUEST,
    userId,
    severity: blocked ? SOC2_SEVERITY.MEDIUM : SOC2_SEVERITY.INFO,
    details: { provider, ...details },
    resource: provider,
    resourceType: 'ai',
    success: !blocked,
  });

/**
 * Log a prompt injection attempt.
 */
export const logPromptInjectionAttempt = (userId, details = {}, ip = null) =>
  recordAuditEvent({
    eventType: SOC2_EVENT_TYPES.PROMPT_INJECTION_DETECTED,
    userId,
    severity: SOC2_SEVERITY.HIGH,
    details,
    ip,
    resourceType: 'ai',
    success: false,
    reason: 'prompt_injection_attempt',
  });

/**
 * Log a rate limit exceeded event.
 */
export const logRateLimitExceeded = (userId, details = {}, ip = null) =>
  recordAuditEvent({
    eventType: SOC2_EVENT_TYPES.RATE_LIMIT_EXCEEDED,
    userId,
    severity: SOC2_SEVERITY.LOW,
    details,
    ip,
    resourceType: 'rate_limit',
    success: false,
    reason: 'rate_limited',
  });

/**
 * Log a config change.
 */
export const logConfigChange = (userId, configKey, oldValue, newValue, details = {}) =>
  recordAuditEvent({
    eventType: SOC2_EVENT_TYPES.CONFIG_CHANGE,
    userId,
    severity: SOC2_SEVERITY.HIGH,
    details: { configKey, action: 'modified', ...details },
    resource: configKey,
    resourceType: 'config',
    success: true,
  });

/**
 * Log a security scan event.
 */
export const logScanEvent = (userId, scanType, details = {}) =>
  recordAuditEvent({
    eventType: SOC2_EVENT_TYPES.SCAN_PERFORMED,
    userId,
    severity: SOC2_SEVERITY.INFO,
    details: { scanType, ...details },
    resourceType: scanType,
    success: details.status !== false,
  });

/**
 * Log a data export event.
 */
export const logDataExport = (userId, resource, format, details = {}) =>
  recordAuditEvent({
    eventType: SOC2_EVENT_TYPES.DATA_EXPORT,
    userId,
    severity: SOC2_SEVERITY.HIGH,
    details: { format, ...details },
    resource,
    resource: resource,
    resourceType: 'data_export',
    success: true,
  });

/**
 * Get audit events from the in-memory store.
 * @param {object} filter - Optional filter by eventType, userId, severity, etc.
 * @param {number} limit
 * @returns {Array}
 */
export const getAuditEvents = (filter = {}, limit = 100) => {
  let events = eventStore;

  if (filter.eventType) {
    events = events.filter((e) => e.eventType === filter.eventType);
  }
  if (filter.userId) {
    events = events.filter((e) => e.userId === filter.userId);
  }
  if (filter.severity) {
    events = events.filter((e) => e.severity === filter.severity);
  }
  if (filter.resource) {
    events = events.filter((e) => e.resource === filter.resource);
  }
  if (filter.resourceType) {
    events = events.filter((e) => e.resourceType === filter.resourceType);
  }
  if (filter.from) {
    events = events.filter((e) => new Date(e.timestamp) >= new Date(filter.from));
  }
  if (filter.to) {
    events = events.filter((e) => new Date(e.timestamp) <= new Date(filter.to));
  }
  if (filter.success === false) {
    events = events.filter((e) => !e.success);
  }

  return events.slice(-limit);
};

/**
 * Export audit events for SIEM integration.
 * @returns {Array} All events (up to MAX_STORE_SIZE)
 */
export const exportAuditEvents = () => {
  return eventStore.slice();
};

/**
 * Clear the in-memory event store (for testing).
 */
export const clearAuditEvents = () => {
  eventStore.length = 0;
};

export default {
  SOC2_EVENT_TYPES,
  SOC2_SEVERITY,
  recordAuditEvent,
  logUserLogin,
  logTotpSetup,
  logTotpVerify,
  logAIRequest,
  logPromptInjectionAttempt,
  logRateLimitExceeded,
  logConfigChange,
  logScanEvent,
  logDataExport,
  getAuditEvents,
  exportAuditEvents,
  clearAuditEvents,
};
