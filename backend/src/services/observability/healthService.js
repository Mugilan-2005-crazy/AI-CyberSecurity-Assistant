import logger from '../../utils/logger.js';

class HealthService {
  constructor() {
    this.checks = new Map();
    this.lastCheck = null;
    this.overallStatus = 'healthy';
  }

  registerCheck(name, checkFn, options = {}) {
    this.checks.set(name, {
      checkFn,
      interval: options.interval || 30000,
      timeout: options.timeout || 5000,
      lastResult: null,
      lastChecked: null,
      consecutiveFailures: 0,
      critical: options.critical || false,
    });
    logger.info('[healthService] Health check registered', { name, critical: options.critical || false });
  }

  async runAllChecks() {
    const results = {};
    let allHealthy = true;
    let hasCriticalFailure = false;

    for (const [name, check] of this.checks) {
      try {
        const result = await Promise.race([
          check.checkFn(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Health check timeout')), check.timeout)),
        ]);

        check.lastResult = result;
        check.lastChecked = new Date().toISOString();
        check.consecutiveFailures = 0;

        results[name] = {
          status: 'healthy',
          details: result,
          checkedAt: check.lastChecked,
        };
      } catch (err) {
        check.lastResult = { error: err.message };
        check.lastChecked = new Date().toISOString();
        check.consecutiveFailures++;

        results[name] = {
          status: 'unhealthy',
          error: err.message,
          checkedAt: check.lastChecked,
          consecutiveFailures: check.consecutiveFailures,
        };

        allHealthy = false;
        if (check.critical) {
          hasCriticalFailure = true;
        }
      }
    }

    this.lastCheck = new Date().toISOString();
    this.overallStatus = hasCriticalFailure ? 'critical' : allHealthy ? 'healthy' : 'degraded';

    logger.info('[healthService] Health check completed', {
      overallStatus: this.overallStatus,
      checksRun: this.checks.size,
      healthy: Object.values(results).filter((r) => r.status === 'healthy').length,
      unhealthy: Object.values(results).filter((r) => r.status === 'unhealthy').length,
    });

    return {
      status: this.overallStatus,
      timestamp: this.lastCheck,
      checks: results,
      summary: {
        total: this.checks.size,
        healthy: Object.values(results).filter((r) => r.status === 'healthy').length,
        unhealthy: Object.values(results).filter((r) => r.status === 'unhealthy').length,
        critical: hasCriticalFailure,
      },
    };
  }

  async runCheck(name) {
    const check = this.checks.get(name);
    if (!check) {
      throw new Error(`Health check not found: ${name}`);
    }

    try {
      const result = await Promise.race([
        check.checkFn(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Health check timeout')), check.timeout)),
      ]);

      check.lastResult = result;
      check.lastChecked = new Date().toISOString();
      check.consecutiveFailures = 0;

      return { name, status: 'healthy', details: result, checkedAt: check.lastChecked };
    } catch (err) {
      check.lastResult = { error: err.message };
      check.lastChecked = new Date().toISOString();
      check.consecutiveFailures++;

      return { name, status: 'unhealthy', error: err.message, checkedAt: check.lastChecked, consecutiveFailures: check.consecutiveFailures };
    }
  }

  getStatus() {
    return {
      status: this.overallStatus,
      lastCheck: this.lastCheck,
      checksCount: this.checks.size,
    };
  }

  getCheck(name) {
    const check = this.checks.get(name);
    if (!check) return null;
    return {
      name,
      lastResult: check.lastResult,
      lastChecked: check.lastChecked,
      consecutiveFailures: check.consecutiveFailures,
      critical: check.critical,
    };
  }

  getAllChecks() {
    const result = {};
    for (const [name, check] of this.checks) {
      result[name] = {
        lastResult: check.lastResult,
        lastChecked: check.lastChecked,
        consecutiveFailures: check.consecutiveFailures,
        critical: check.critical,
      };
    }
    return result;
  }
}

const healthService = new HealthService();
export default healthService;