import logger from '../../utils/logger.js';
import { v4 as uuidv4 } from 'uuid';

class LoggingService {
  constructor() {
    this.correlationId = null;
    this.traceId = null;
    this.spanId = null;
    this.requestId = null;
    this.logBuffer = [];
    this.maxBufferSize = 10000;
    this.auditLogBuffer = [];
    this.maxAuditBufferSize = 50000;
  }

  createContext(options = {}) {
    return {
      correlationId: options.correlationId || uuidv4(),
      traceId: options.traceId || this._generateTraceId(),
      spanId: options.spanId || this._generateSpanId(),
      requestId: options.requestId || uuidv4(),
      userId: options.userId || null,
      sessionId: options.sessionId || null,
      tenantId: options.tenantId || null,
      service: options.service || 'unknown',
      operation: options.operation || 'unknown',
    };
  }

  _generateTraceId() {
    return `trace-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  _generateSpanId() {
    return `span-${Math.random().toString(36).slice(2, 10)}`;
  }

  log(level, message, meta = {}) {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      correlationId: meta.correlationId || this.correlationId,
      traceId: meta.traceId || this.traceId,
      spanId: meta.spanId || this.spanId,
      requestId: meta.requestId || this.requestId,
      userId: meta.userId || null,
      tenantId: meta.tenantId || null,
      service: meta.service || 'observability',
      ...meta,
    };

    this._addToBuffer(entry);
    this._emitLog(entry);

    return entry;
  }

  info(message, meta = {}) {
    return this.log('info', message, meta);
  }

  warn(message, meta = {}) {
    return this.log('warn', message, meta);
  }

  error(message, meta = {}) {
    return this.log('error', message, meta);
  }

  debug(message, meta = {}) {
    return this.log('debug', message, meta);
  }

  audit(action, userId, details = {}) {
    const entry = {
      timestamp: new Date().toISOString(),
      type: 'audit',
      action,
      userId,
      correlationId: this.correlationId,
      traceId: this.traceId,
      requestId: this.requestId,
      details,
      ip: details.ip || null,
      userAgent: details.userAgent || null,
    };

    this.auditLogBuffer.push(entry);
    if (this.auditLogBuffer.length > this.maxAuditBufferSize) {
      this.auditLogBuffer.shift();
    }

    logger.info(`[AUDIT] ${action}`, { userId, details, correlationId: this.correlationId, traceId: this.traceId });

    return entry;
  }

  securityEvent(eventType, userId, details = {}) {
    const entry = {
      timestamp: new Date().toISOString(),
      type: 'security',
      eventType,
      userId,
      correlationId: this.correlationId,
      traceId: this.traceId,
      requestId: this.requestId,
      details,
      severity: details.severity || 'MEDIUM',
    };

    this._addToBuffer(entry);
    logger.warn(`[SECURITY] ${eventType}`, { userId, details, correlationId: this.correlationId, traceId: this.traceId });

    return entry;
  }

  cloudLog(provider, operation, details = {}) {
    const entry = {
      timestamp: new Date().toISOString(),
      type: 'cloud',
      provider,
      operation,
      correlationId: this.correlationId,
      traceId: this.traceId,
      requestId: this.requestId,
      details,
      status: details.status || 'unknown',
    };

    this._addToBuffer(entry);
    logger.info(`[CLOUD] ${provider}:${operation}`, { details, correlationId: this.correlationId, traceId: this.traceId });

    return entry;
  }

  containerLog(containerId, operation, details = {}) {
    const entry = {
      timestamp: new Date().toISOString(),
      type: 'container',
      containerId,
      operation,
      correlationId: this.correlationId,
      traceId: this.traceId,
      requestId: this.requestId,
      details,
      status: details.status || 'unknown',
    };

    this._addToBuffer(entry);
    logger.info(`[CONTAINER] ${containerId}:${operation}`, { details, correlationId: this.correlationId, traceId: this.traceId });

    return entry;
  }

  aiLog(operation, model, details = {}) {
    const entry = {
      timestamp: new Date().toISOString(),
      type: 'ai',
      operation,
      model,
      correlationId: this.correlationId,
      traceId: this.traceId,
      requestId: this.requestId,
      details,
      latencyMs: details.latencyMs || null,
      tokensUsed: details.tokensUsed || null,
    };

    this._addToBuffer(entry);
    logger.info(`[AI] ${model}:${operation}`, { details, correlationId: this.correlationId, traceId: this.traceId });

    return entry;
  }

  structuredLog(entry) {
    return JSON.stringify(entry);
  }

  getLogs(filter = {}) {
    let logs = this.logBuffer;

    if (filter.correlationId) {
      logs = logs.filter((l) => l.correlationId === filter.correlationId);
    }
    if (filter.traceId) {
      logs = logs.filter((l) => l.traceId === filter.traceId);
    }
    if (filter.requestId) {
      logs = logs.filter((l) => l.requestId === filter.requestId);
    }
    if (filter.userId) {
      logs = logs.filter((l) => l.userId === filter.userId);
    }
    if (filter.level) {
      logs = logs.filter((l) => l.level === filter.level);
    }
    if (filter.service) {
      logs = logs.filter((l) => l.service === filter.service);
    }
    if (filter.type) {
      logs = logs.filter((l) => l.type === filter.type);
    }
    if (filter.from) {
      logs = logs.filter((l) => new Date(l.timestamp) >= new Date(filter.from));
    }
    if (filter.to) {
      logs = logs.filter((l) => new Date(l.timestamp) <= new Date(filter.to));
    }

    return logs;
  }

  getAuditLogs(filter = {}) {
    let logs = this.auditLogBuffer;

    if (filter.userId) {
      logs = logs.filter((l) => l.userId === filter.userId);
    }
    if (filter.action) {
      logs = logs.filter((l) => l.action === filter.action);
    }
    if (filter.from) {
      logs = logs.filter((l) => new Date(l.timestamp) >= new Date(filter.from));
    }
    if (filter.to) {
      logs = logs.filter((l) => new Date(l.timestamp) <= new Date(filter.to));
    }

    return logs;
  }

  getMetrics() {
    return {
      totalLogs: this.logBuffer.length,
      totalAuditLogs: this.auditLogBuffer.length,
      bufferUsage: `${(this.logBuffer.length / this.maxBufferSize * 100).toFixed(1)}%`,
      auditBufferUsage: `${(this.auditLogBuffer.length / this.maxAuditBufferSize * 100).toFixed(1)}%`,
      currentContext: {
        correlationId: this.correlationId,
        traceId: this.traceId,
        spanId: this.spanId,
        requestId: this.requestId,
      },
    };
  }

  _addToBuffer(entry) {
    this.logBuffer.push(entry);
    if (this.logBuffer.length > this.maxBufferSize) {
      this.logBuffer.shift();
    }
  }

  _emitLog(entry) {
    const serialized = this.structuredLog(entry);
    switch (entry.level) {
      case 'error':
        logger.error(entry.message, { ...entry, structured: true });
        break;
      case 'warn':
        logger.warn(entry.message, { ...entry, structured: true });
        break;
      case 'debug':
        logger.debug(entry.message, { ...entry, structured: true });
        break;
      default:
        logger.info(entry.message, { ...entry, structured: true });
    }
  }
}

const loggingService = new LoggingService();
export default loggingService;