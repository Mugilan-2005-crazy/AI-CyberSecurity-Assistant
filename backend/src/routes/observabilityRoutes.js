import { Router } from 'express';
import { protect, authorize } from '../middleware/auth.js';
import metricsService from '../services/observability/metricsService.js';
import healthService from '../services/observability/healthService.js';
import alertEngine from '../services/observability/alertEngine.js';
import loggingService from '../services/observability/loggingService.js';
import ObservabilityMetric from '../models/observability/ObservabilityMetric.js';
import HealthCheck from '../models/observability/HealthCheck.js';
import Alert from '../models/observability/Alert.js';
import LogEntry from '../models/observability/LogEntry.js';
import { getAuditEvents, exportAuditEvents } from '../services/audit/soc2AuditService.js';
import logger from '../utils/logger.js';

const router = Router();
router.use(protect);
router.use(authorize('admin', 'security_manager', 'cloud_admin', 'container_admin', 'devops'));

const metricsLimiter = (req, res, next) => {
  if (req.user.role === 'admin') return next();
  return res.status(403).json({ success: false, message: 'Metrics access requires admin role' });
};

router.get('/metrics', metricsLimiter, async (_req, res, next) => {
  try {
    const format = _req.query.format || 'prometheus';
    if (format === 'prometheus') {
      res.setHeader('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      return res.send(metricsService.getPrometheusMetrics());
    }
    res.json({ success: true, data: metricsService.getMetricsSnapshot() });
  } catch (err) {
    logger.error('[observability] Metrics endpoint failed', { error: err.message });
    next(err);
  }
});

router.get('/metrics/snapshot', metricsLimiter, async (_req, res, next) => {
  try {
    res.json({ success: true, data: metricsService.getMetricsSnapshot() });
  } catch (err) {
    next(err);
  }
});

router.get('/health', async (_req, res, next) => {
  try {
    const health = await healthService.runAllChecks();
    const statusCode = health.status === 'healthy' ? 200 : health.status === 'critical' ? 503 : 200;
    res.status(statusCode).json({ success: true, data: health });
  } catch (err) {
    next(err);
  }
});

router.get('/health/:name', async (req, res, next) => {
  try {
    const check = healthService.getCheck(req.params.name);
    if (!check) {
      return res.status(404).json({ success: false, message: 'Health check not found' });
    }
    res.json({ success: true, data: check });
  } catch (err) {
    next(err);
  }
});

router.get('/health/all', async (_req, res, next) => {
  try {
    res.json({ success: true, data: healthService.getAllChecks() });
  } catch (err) {
    next(err);
  }
});

router.get('/alerts', async (_req, res, next) => {
  try {
    const { status, severity, limit = 100, page = 1 } = _req.query;
    const filter = {};
    if (status) filter.status = status;
    if (severity) filter.severity = severity;

    const alerts = await Alert.find(filter)
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));
    const total = await Alert.countDocuments(filter);

    res.json({ success: true, data: alerts, total, page: Number(page), totalPages: Math.ceil(total / Number(limit)) });
  } catch (err) {
    next(err);
  }
});

router.get('/alerts/active', async (_req, res, next) => {
  try {
    const alerts = await Alert.find({ status: 'active' }).sort({ createdAt: -1 }).limit(50);
    res.json({ success: true, data: alerts, count: alerts.length });
  } catch (err) {
    next(err);
  }
});

router.patch('/alerts/:id/acknowledge', async (req, res, next) => {
  try {
    const alert = await Alert.findById(req.params.id);
    if (!alert) {
      return res.status(404).json({ success: false, message: 'Alert not found' });
    }
    alert.status = 'acknowledged';
    alert.acknowledgedBy = req.user.id;
    alert.acknowledgedAt = new Date();
    await alert.save();
    alertEngine.resolveAlert(req.params.id);
    res.json({ success: true, data: alert, message: 'Alert acknowledged' });
  } catch (err) {
    next(err);
  }
});

router.patch('/alerts/:id/resolve', async (req, res, next) => {
  try {
    const alert = await Alert.findById(req.params.id);
    if (!alert) {
      return res.status(404).json({ success: false, message: 'Alert not found' });
    }
    alert.status = 'resolved';
    alert.resolvedAt = new Date();
    await alert.save();
    alertEngine.resolveAlert(req.params.id);
    res.json({ success: true, data: alert, message: 'Alert resolved' });
  } catch (err) {
    next(err);
  }
});

router.get('/logs', async (_req, res, next) => {
  try {
    const { level, type, correlationId, traceId, requestId, userId, service, from, to, page = 1, limit = 100 } = _req.query;
    const filter = {};
    if (level) filter.level = level;
    if (type) filter.type = type;
    if (correlationId) filter.correlationId = correlationId;
    if (traceId) filter.traceId = traceId;
    if (requestId) filter.requestId = requestId;
    if (userId) filter.userId = userId;
    if (service) filter.service = service;
    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      if (to) filter.createdAt.$lte = new Date(to);
    }

    const logs = await LogEntry.find(filter)
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));
    const total = await LogEntry.countDocuments(filter);

    res.json({ success: true, data: logs, total, page: Number(page), totalPages: Math.ceil(total / Number(limit)) });
  } catch (err) {
    next(err);
  }
});

router.get('/logs/audit', async (_req, res, next) => {
  try {
    const { userId, action, from, to, page = 1, limit = 100 } = _req.query;
    const filter = { type: 'audit' };
    if (userId) filter.userId = userId;
    if (action) filter.details = { $regex: action, $options: 'i' };
    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      if (to) filter.createdAt.$lte = new Date(to);
    }

    const logs = await LogEntry.find(filter)
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));
    const total = await LogEntry.countDocuments(filter);

    res.json({ success: true, data: logs, total, page: Number(page), totalPages: Math.ceil(total / Number(limit)) });
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /api/observability/soc2/events:
 *   get:
 *     tags: [Observability]
 *     summary: Query SOC2 audit events (admin/security_manager only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: eventType
 *         schema: { type: string }
 *         description: Filter by SOC2 event type
 *       - in: query
 *         name: userId
 *         schema: { type: string }
 *         description: Filter by user ID
 *       - in: query
 *         name: severity
 *         schema: { type: string, enum: [info, low, medium, high, critical] }
 *       - in: query
 *         name: from
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: to
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 100 }
 *     responses:
 *       200:
 *         description: SOC2 audit events
 */
router.get('/soc2/events', authorize('admin', 'security_manager'), (req, res) => {
  try {
    const { eventType, userId, severity, from, to, limit = 100 } = req.query;
    const filter = {};
    if (eventType) filter.eventType = eventType;
    if (userId) filter.userId = userId;
    if (severity) filter.severity = severity;
    if (from) filter.from = from;
    if (to) filter.to = to;

    const events = getAuditEvents(filter, Number(limit));
    res.json({ success: true, data: events, count: events.length });
  } catch (err) {
    logger.error('[observability] SOC2 events query failed', { error: err.message });
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * @openapi
 * /api/observability/soc2/export:
 *   get:
 *     tags: [Observability]
 *     summary: Export all SOC2 audit events for SIEM integration (admin only)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: All SOC2 audit events
 */
router.get('/soc2/export', authorize('admin'), (req, res) => {
  try {
    const events = exportAuditEvents();
    res.json({ success: true, data: events, count: events.length });
  } catch (err) {
    logger.error('[observability] SOC2 export failed', { error: err.message });
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/logs/metrics', async (_req, res, next) => {
  try {
    res.json({ success: true, data: loggingService.getMetrics() });
  } catch (err) {
    next(err);
  }
});

router.get('/dashboard/system', async (_req, res, next) => {
  try {
    const snapshot = metricsService.getMetricsSnapshot();
    const health = await healthService.runAllChecks();
    const activeAlerts = alertEngine.getActiveAlerts();

    res.json({
      success: true,
      data: {
        metrics: snapshot,
        health,
        alerts: activeAlerts,
        systemHealthScore: calculateSystemHealthScore(snapshot, health, activeAlerts),
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err) {
    next(err);
  }
});

router.get('/dashboard/infrastructure', async (_req, res, next) => {
  try {
    const snapshot = metricsService.getMetricsSnapshot();
    res.json({
      success: true,
      data: {
        cpu: snapshot.cpu,
        memory: snapshot.memory,
        disk: snapshot.disk,
        system: snapshot.system,
        mongo: snapshot.mongo,
        socket: snapshot.socket,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err) {
    next(err);
  }
});

router.get('/dashboard/application', async (_req, res, next) => {
  try {
    const snapshot = metricsService.getMetricsSnapshot();
    res.json({
      success: true,
      data: {
        httpRequests: snapshot.httpRequests,
        responseTime: snapshot.responseTime,
        apiLatency: snapshot.apiLatency,
        errors: snapshot.errors,
        performance: snapshot.performance,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err) {
    next(err);
  }
});

router.get('/dashboard/security', async (_req, res, next) => {
  try {
    const snapshot = metricsService.getMetricsSnapshot();
    const activeAlerts = alertEngine.getActiveAlerts();
    res.json({
      success: true,
      data: {
        alerts: {
          total: snapshot.alerts.total,
          active: snapshot.alerts.active,
          resolved: snapshot.alerts.resolved,
          bySeverity: snapshot.alerts.bySeverity,
          byType: snapshot.alerts.byType,
          activeAlerts,
        },
        securityEvents: loggingService.getLogs({ type: 'security', limit: 50 }),
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err) {
    next(err);
  }
});

router.get('/dashboard/ai', async (_req, res, next) => {
  try {
    const snapshot = metricsService.getMetricsSnapshot();
    res.json({
      success: true,
      data: {
        ai: snapshot.ai,
        threatIntel: snapshot.threatIntel,
        knowledgeGraph: snapshot.knowledgeGraph,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err) {
    next(err);
  }
});

router.get('/dashboard/cloud', async (_req, res, next) => {
  try {
    const snapshot = metricsService.getMetricsSnapshot();
    res.json({
      success: true,
      data: {
        cloud: snapshot.cloud,
        container: snapshot.container,
        kubernetes: snapshot.kubernetes,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err) {
    next(err);
  }
});

router.get('/dashboard/executive', async (_req, res, next) => {
  try {
    const snapshot = metricsService.getMetricsSnapshot();
    const health = await healthService.runAllChecks();
    const activeAlerts = alertEngine.getActiveAlerts();

    res.json({
      success: true,
      data: {
        systemHealthScore: calculateSystemHealthScore(snapshot, health, activeAlerts),
        infrastructureHealth: calculateInfrastructureHealth(snapshot),
        performanceScore: calculatePerformanceScore(snapshot),
        availability: calculateAvailability(snapshot, health),
        errorRate: snapshot.errors.total,
        latencyTrends: {
          p50: snapshot.performance.p50,
          p95: snapshot.performance.p95,
          p99: snapshot.performance.p99,
          avg: snapshot.performance.avg,
        },
        serviceStatus: {
          backend: 'healthy',
          frontend: 'healthy',
          mongodb: health.checks?.mongodb?.status || 'unknown',
          socket: 'healthy',
          gemini: 'healthy',
          ollama: 'healthy',
          threatIntel: 'healthy',
          cloudProviders: 'healthy',
          docker: 'healthy',
          kubernetes: 'healthy',
        },
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err) {
    next(err);
  }
});

export function calculateSystemHealthScore(snapshot, health, activeAlerts) {
  let score = 100;
  if (health.status !== 'healthy') score -= 20;
  score -= activeAlerts.filter((a) => a.severity === 'CRITICAL').length * 10;
  score -= activeAlerts.filter((a) => a.severity === 'WARNING').length * 3;
  score -= Math.min(20, snapshot.errors.total * 0.5);
  score -= Math.min(10, snapshot.performance.p95 > 1000 ? 5 : 0);
  return Math.max(0, Math.min(100, score));
}

function calculateInfrastructureHealth(snapshot) {
  const cpuHealth = snapshot.cpu.usage < 80 ? 100 : snapshot.cpu.usage < 95 ? 50 : 0;
  const memHealth = snapshot.memory.heapUsed / Math.max(1, snapshot.memory.heapTotal) < 0.85 ? 100 : 50;
  const diskHealth = snapshot.disk.usagePercent < 80 ? 100 : snapshot.disk.usagePercent < 95 ? 50 : 0;
  return { cpu: cpuHealth, memory: memHealth, disk: diskHealth, overall: Math.round((cpuHealth + memHealth + diskHealth) / 3) };
}

function calculatePerformanceScore(snapshot) {
  let score = 100;
  if (snapshot.performance.p95 > 1000) score -= 30;
  else if (snapshot.performance.p95 > 500) score -= 15;
  if (snapshot.errors.total > 100) score -= 20;
  else if (snapshot.errors.total > 50) score -= 10;
  return Math.max(0, score);
}

function calculateAvailability(snapshot, health) {
  const unhealthyChecks = Object.values(health.checks || {}).filter((c) => c.status === 'unhealthy').length;
  const totalChecks = Object.keys(health.checks || {}).length || 1;
  const uptime = snapshot.system?.uptime || 0;
  const availability = ((totalChecks - unhealthyChecks) / totalChecks) * 100;
  return { percentage: Math.round(availability * 10) / 10, uptime, totalChecks, unhealthyChecks };
}

export default router;