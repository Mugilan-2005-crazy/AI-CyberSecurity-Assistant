import logger from '../../utils/logger.js';
import metricsService from '../../services/observability/metricsService.js';
import loggingService from '../../services/observability/loggingService.js';
import { trace } from '@opentelemetry/api';

function generateTraceId() {
  return `trace-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function generateSpanId() {
  return `span-${Math.random().toString(36).slice(2, 10)}`;
}

export function telemetryMiddleware(req, res, next) {
  const traceId = req.headers['x-trace-id'] || generateTraceId();
  const spanId = generateSpanId();
  const parentSpanId = req.headers['x-parent-span-id'] || null;

  req.traceId = traceId;
  req.spanId = spanId;
  req.parentSpanId = parentSpanId;

  res.setHeader('X-Trace-Id', traceId);
  res.setHeader('X-Span-Id', spanId);

  const startTime = process.hrtime.bigint();

  const activeSpan = trace.getTracer('express').startSpan(`${req.method} ${req.route?.path || req.path}`, {
    attributes: {
      'http.method': req.method,
      'http.url': req.path,
      'http.user_agent': req.get('User-Agent'),
      'http.request.header.x-trace-id': traceId,
      'user.id': req.user?.id || undefined,
      'user.role': req.user?.role || undefined,
    },
  });

  res.on('finish', () => {
    const endTime = process.hrtime.bigint();
    const latencyNs = Number(endTime - startTime);
    const latencyMs = Math.round(latencyNs / 1e6);

    metricsService.recordHttpRequest(req.method, req.route?.path || req.path, res.statusCode, latencyMs);
    metricsService.recordApiLatency(req.route?.path || req.path, latencyMs);

    activeSpan.setAttribute('http.status_code', res.statusCode);
    activeSpan.setAttribute('http.response.latency_ms', latencyMs);
    if (res.statusCode >= 400) {
      activeSpan.setAttribute('error', true);
      activeSpan.setAttribute('error.type', `HTTP ${res.statusCode}`);
    }
    activeSpan.end();

    loggingService.log('info', `Request completed`, {
      correlationId: req.id,
      traceId,
      spanId,
      requestId: req.id,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      latencyMs,
      userId: req.user?.id || null,
      service: 'express',
    });
  });

  next();
}

export function traceMiddleware(req, res, next) {
  const traceId = req.traceId || generateTraceId();
  const spanId = generateSpanId();

  req.traceId = traceId;
  req.spanId = spanId;

  const span = {
    traceId,
    spanId,
    parentSpanId: req.parentSpanId,
    operation: `${req.method} ${req.path}`,
    startTime: Date.now(),
    tags: {
      'http.method': req.method,
      'http.url': req.path,
      'http.user_agent': req.get('User-Agent'),
      'user.id': req.user?.id,
      'user.role': req.user?.role,
    },
  };

  req.span = span;

  res.on('finish', () => {
    span.endTime = Date.now();
    span.duration = span.endTime - span.startTime;
    span.tags['http.status_code'] = res.statusCode;
    span.tags['http.latency_ms'] = span.duration;

    loggingService.info(`Span completed: ${span.operation}`, {
      traceId,
      spanId,
      duration: span.duration,
      statusCode: res.statusCode,
    });
  });

  next();
}

export function contextPropagationMiddleware(req, res, next) {
  req.correlationId = req.headers['x-correlation-id'] || req.id;
  req.traceId = req.headers['x-trace-id'] || req.traceId || generateTraceId();
  req.spanId = req.spanId || generateSpanId();
  req.requestId = req.id;

  res.setHeader('X-Correlation-Id', req.correlationId);
  res.setHeader('X-Trace-Id', req.traceId);
  res.setHeader('X-Span-Id', req.spanId);
  res.setHeader('X-Request-Id', req.requestId);

  loggingService.info(`Request started`, {
    correlationId: req.correlationId,
    traceId: req.traceId,
    spanId: req.spanId,
    requestId: req.requestId,
    method: req.method,
    path: req.path,
    userId: req.user?.id || null,
  });

  next();
}

export function instrumentExpress(app) {
  app.use(telemetryMiddleware);
  app.use(contextPropagationMiddleware);
  app.use(traceMiddleware);
}

export default { telemetryMiddleware, traceMiddleware, contextPropagationMiddleware, instrumentExpress };