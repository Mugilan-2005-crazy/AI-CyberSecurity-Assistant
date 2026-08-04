/**
 * services/observability/opentelemetry.js
 * ------------------------------------------------------------
 * OpenTelemetry SDK initialization for distributed tracing.
 *
 * Exports:
 *  - initOpenTelemetry(): Bootstraps the OTel SDK with:
 *      * Express auto-instrumentation
 *      * HTTP/HTTPS auto-instrumentation
 *      * MongoDB auto-instrumentation
 *      * Socket.IO instrumentation
 *      * Prometheus metric reader (for scrapable metrics)
 *      * OTLP HTTP trace exporter (for Grafana Tempo / Jaeger)
 *    All wrapped in try/catch so the app boots even if OTel
 *    packages are missing or misconfigured.
 *  - get Tracer(): returns an OTel tracer for custom spans
 *  - recordDBQuery(): records a MongoDB query span
 *  - recordExternalAPI(): records an external API call span
 *  - recordAIRequest(): records an AI provider call span with
 *    latency, token usage, and confidence scoring
 *
 * This module is OPTIONAL — if the SDK is not installed or
 * OTEL_ENABLED=false, it is a no-op and all tracing calls
 * silently degrade to the existing custom telemetry middleware.
 */
import logger from '../../utils/logger.js';
import config from '../../config/index.js';
import metricsService from './metricsService.js';

let sdk = null;
let tracer = null;
let isInitialized = false;

export async function initOpenTelemetry() {
  if (!config.otel.enabled) {
    logger.info('[opentelemetry] OpenTelemetry disabled (OTEL_ENABLED=false)');
    return false;
  }

  if (process.env.NODE_ENV === 'test') {
    logger.info('[opentelemetry] OpenTelemetry skipped in test environment');
    return false;
  }

  if (isInitialized) {
    return sdk !== null;
  }

  try {
    const { NodeSDK } = await import('@opentelemetry/sdk-node');
    const { getNodeAutoInstrumentations } = await import('@opentelemetry/auto-instrumentations-node');
    const { PrometheusExporter } = await import('@opentelemetry/exporter-prometheus');
    const { OTLPTraceExporter } = await import('@opentelemetry/exporter-trace-otlp-http');
    const { trace } = await import('@opentelemetry/api');

    const prometheusExporter = new PrometheusExporter(
      { port: config.otel.prometheusPort, startServer: true },
      () => {
        logger.info(`[opentelemetry] Prometheus metrics available at :${config.otel.prometheusPort}/metrics`);
      }
    );

    const traceExporter = new OTLPTraceExporter({
      url: `${config.otel.otlpEndpoint}/v1/traces`,
    });

    sdk = new NodeSDK({
      serviceName: config.otel.serviceName,
      traceExporter,
      metricReader: prometheusExporter,
      instrumentations: [getNodeAutoInstrumentations()],
    });

    await sdk.start();
    isInitialized = true;

    tracer = trace.getTracer(config.otel.serviceName);

    logger.info('[opentelemetry] SDK initialized', {
      serviceName: config.otel.serviceName,
      prometheusPort: config.otel.prometheusPort,
      otlpEndpoint: config.otel.otlpEndpoint,
    });
    return true;
  } catch (err) {
    logger.warn(`[opentelemetry] SDK initialization failed, continuing with custom telemetry: ${err.message}`);
    sdk = null;
    isInitialized = true;
    return false;
  }
}

export function getTracer() {
  if (tracer) return tracer;
  return {
    startActiveSpan: (_name, _fn) => null,
    startSpan: (_name) => null,
  };
}

export function recordDBQuery(operation, collection, query, success = true) {
  const span = tracer ? tracer.startSpan(`mongodb.${operation}`, { attributes: { 'db.system': 'mongodb', 'db.operation': operation, 'db.collection': collection } }) : null;

  metricsService.recordMongoOperation(0);
  if (!success) metricsService.recordMongoError();

  if (span) {
    span.setAttribute('db.collection', collection);
    span.setAttribute('db.query', typeof query === 'object' ? JSON.stringify(query) : String(query));
    span.setAttribute('db.success', success);
    span.end();
  }

  return span;
}

export function recordExternalAPI(provider, endpoint, success, latencyMs) {
  const span = tracer ? tracer.startSpan('http.external.api', { attributes: { 'peer.service': provider, 'http.url': endpoint } }) : null;

  if (span) {
    span.setAttribute('peer.service', provider);
    span.setAttribute('http.url', endpoint);
    span.setAttribute('http.success', success);
    if (latencyMs) span.setAttribute('http.latency_ms', latencyMs);
    span.end();
  }

  if (span) span.end();
  return span;
}

export function recordAIRequest(provider, model, latencyMs, tokensUsed, confidenceScore) {
  const span = tracer ? tracer.startSpan('ai.request', {
    attributes: {
      'gen_ai.provider': provider,
      'gen_ai.model': model,
      'gen_ai.response_latency_ms': latencyMs || 0,
      'gen_ai.tokens_used': tokensUsed || 0,
      'gen_ai.confidence_score': confidenceScore || 0,
    },
  }) : null;

  metricsService.recordAIRequest(latencyMs || 0, tokensUsed || 0);

  if (span) {
    span.setAttribute('gen_ai.provider', provider);
    span.setAttribute('gen_ai.model', model);
    span.setAttribute('gen_ai.response_latency_ms', latencyMs || 0);
    span.setAttribute('gen_ai.tokens_used', tokensUsed || 0);
    span.setAttribute('gen_ai.confidence_score', confidenceScore || 0);
    span.end();
  }

  return span;
}

export async function shutdownOpenTelemetry() {
  if (sdk && typeof sdk.shutdown === 'function') {
    await sdk.shutdown();
    logger.info('[opentelemetry] SDK shut down');
  }
  isInitialized = false;
  sdk = null;
  tracer = null;
}

export default {
  initOpenTelemetry,
  getTracer,
  recordDBQuery,
  recordExternalAPI,
  recordAIRequest,
  shutdownOpenTelemetry,
};
