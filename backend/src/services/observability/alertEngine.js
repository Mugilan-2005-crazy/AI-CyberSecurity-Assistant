import logger from '../../utils/logger.js';
import metricsService from '../../services/observability/metricsService.js';
import loggingService from '../../services/observability/loggingService.js';

class AlertEngine {
  constructor() {
    this.rules = new Map();
    this.activeAlerts = new Map();
    this.alertHistory = [];
    this.maxHistorySize = 10000;
    this._intervalId = null;
    this._defaultThresholds = {
      cpu: { warning: 80, critical: 95 },
      memory: { warning: 85, critical: 95 },
      disk: { warning: 80, critical: 95 },
      errorRate: { warning: 10, critical: 50 },
      latency: { warning: 1000, critical: 5000 },
      mongoErrors: { warning: 5, critical: 20 },
      socketErrors: { warning: 10, critical: 50 },
      aiErrors: { warning: 5, critical: 20 },
      threatIntelErrors: { warning: 3, critical: 10 },
      cloudErrors: { warning: 5, critical: 15 },
      containerErrors: { warning: 5, critical: 15 },
      k8sErrors: { warning: 5, critical: 15 },
    };
  }

  start(intervalMs = 30000) {
    this._intervalId = setInterval(() => {
      this.evaluateRules();
    }, intervalMs);
    this.evaluateRules();
    logger.info('[alertEngine] Alert engine started', { intervalMs });
  }

  stop() {
    if (this._intervalId) {
      clearInterval(this._intervalId);
      this._intervalId = null;
    }
    logger.info('[alertEngine] Alert engine stopped');
  }

  addRule(name, checkFn, options = {}) {
    this.rules.set(name, {
      checkFn,
      severity: options.severity || 'warning',
      threshold: options.threshold || null,
      cooldownMs: options.cooldownMs || 300000,
      lastTriggered: 0,
      enabled: options.enabled !== false,
      description: options.description || name,
    });
    logger.info('[alertEngine] Rule added', { name, severity: options.severity || 'warning' });
  }

  removeRule(name) {
    this.rules.delete(name);
    logger.info('[alertEngine] Rule removed', { name });
  }

  evaluateRules() {
    const now = Date.now();

    for (const [name, rule] of this.rules) {
      if (!rule.enabled) continue;

      if (now - rule.lastTriggered < rule.cooldownMs) continue;

      try {
        const result = rule.checkFn();
        if (result && result.triggered) {
          rule.lastTriggered = now;
          this._fireAlert(name, rule, result);
        }
      } catch (err) {
        logger.error(`[alertEngine] Rule evaluation failed: ${name}`, { error: err.message });
      }
    }

    this._checkSystemHealth();
  }

  _checkSystemHealth() {
    const m = metricsService.metrics;

    if (m.cpu.usage > this._defaultThresholds.cpu.critical) {
      this._fireAlert('system_cpu_critical', { severity: 'critical' }, {
        triggered: true,
        metric: 'cpu_usage',
        value: m.cpu.usage,
        threshold: this._defaultThresholds.cpu.critical,
        message: `CPU usage critical: ${m.cpu.usage}%`,
      });
    } else if (m.cpu.usage > this._defaultThresholds.cpu.warning) {
      this._fireAlert('system_cpu_warning', { severity: 'warning' }, {
        triggered: true,
        metric: 'cpu_usage',
        value: m.cpu.usage,
        threshold: this._defaultThresholds.cpu.warning,
        message: `CPU usage warning: ${m.cpu.usage}%`,
      });
    }

    if (m.memory.heapUsed / Math.max(1, m.memory.heapTotal) * 100 > this._defaultThresholds.memory.critical) {
      this._fireAlert('system_memory_critical', { severity: 'critical' }, {
        triggered: true,
        metric: 'memory_usage',
        value: Math.round(m.memory.heapUsed / Math.max(1, m.memory.heapTotal) * 100),
        threshold: this._defaultThresholds.memory.critical,
        message: `Memory usage critical: ${Math.round(m.memory.heapUsed / Math.max(1, m.memory.heapTotal) * 100)}%`,
      });
    }

    if (m.mongo.errors > this._defaultThresholds.mongoErrors.critical) {
      this._fireAlert('mongo_errors_critical', { severity: 'critical' }, {
        triggered: true,
        metric: 'mongo_errors',
        value: m.mongo.errors,
        threshold: this._defaultThresholds.mongoErrors.critical,
        message: `MongoDB errors critical: ${m.mongo.errors}`,
      });
    }

    if (m.errors.total > this._defaultThresholds.errorRate.critical) {
      this._fireAlert('error_rate_critical', { severity: 'critical' }, {
        triggered: true,
        metric: 'error_rate',
        value: m.errors.total,
        threshold: this._defaultThresholds.errorRate.critical,
        message: `Error rate critical: ${m.errors.total} total errors`,
      });
    }

    if (m.performance.p95 > this._defaultThresholds.latency.critical) {
      this._fireAlert('latency_critical', { severity: 'critical' }, {
        triggered: true,
        metric: 'latency_p95',
        value: m.performance.p95,
        threshold: this._defaultThresholds.latency.critical,
        message: `API latency P95 critical: ${m.performance.p95}ms`,
      });
    }
  }

  _fireAlert(name, rule, result) {
    const alert = {
      id: `alert-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      name,
      severity: rule.severity,
      message: result.message || `Alert triggered: ${name}`,
      metric: result.metric,
      value: result.value,
      threshold: result.threshold,
      timestamp: new Date().toISOString(),
      status: 'active',
    };

    this.activeAlerts.set(alert.id, alert);
    this.alertHistory.push(alert);
    if (this.alertHistory.length > this.maxHistorySize) {
      this.alertHistory.shift();
    }

    metricsService.recordAlert(rule.severity.toUpperCase(), name);

    loggingService.warn(`[ALERT] ${name}`, {
      alertId: alert.id,
      severity: rule.severity,
      metric: result.metric,
      value: result.value,
      threshold: result.threshold,
    });

    logger.warn(`[alertEngine] Alert fired`, { alertId: alert.id, name, severity: rule.severity });
  }

  getActiveAlerts() {
    return Array.from(this.activeAlerts.values());
  }

  getAlertHistory(limit = 100) {
    return this.alertHistory.slice(-limit);
  }

  resolveAlert(alertId) {
    const alert = this.activeAlerts.get(alertId);
    if (alert) {
      alert.status = 'resolved';
      alert.resolvedAt = new Date().toISOString();
      this.activeAlerts.delete(alertId);
      metricsService.recordAlertResolved();
      loggingService.info(`Alert resolved`, { alertId });
    }
    return alert;
  }

  getMetrics() {
    return {
      activeAlerts: this.activeAlerts.size,
      totalAlerts: this.alertHistory.length,
      rulesCount: this.rules.size,
      thresholds: this._defaultThresholds,
    };
  }
}

const alertEngine = new AlertEngine();
export default alertEngine;