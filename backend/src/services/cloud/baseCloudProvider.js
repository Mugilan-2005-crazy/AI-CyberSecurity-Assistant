import logger from '../../utils/logger.js';

class BaseCloudProvider {
  constructor(config) {
    this.provider = config.provider;
    this.accountId = config.accountId;
    this.accountName = config.accountName;
    this.region = config.region || 'global';
    this.credentials = config.credentials || {};
    this.metadata = config.metadata || {};
    this.isConnected = false;
    this.cache = new Map();
    this.cacheExpiry = new Map();
  }

  async connect() {
    throw new Error(`connect() not implemented for ${this.provider}`);
  }

  async getInventory() {
    throw new Error(`getInventory() not implemented for ${this.provider}`);
  }

  async scan(findings = []) {
    throw new Error(`scan() not implemented for ${this.provider}`);
  }

  getCache(key) {
    const exp = this.cacheExpiry.get(key);
    if (exp && Date.now() > exp) {
      this.cache.delete(key);
      this.cacheExpiry.delete(key);
      return null;
    }
    return this.cache.get(key);
  }

  setCache(key, value, ttlSec = 300) {
    this.cache.set(key, value);
    this.cacheExpiry.set(key, Date.now() + ttlSec * 1000);
  }

  withRetry(fn, retries = 3, delayMs = 1000) {
    return async (...args) => {
      let lastErr;
      for (let i = 0; i <= retries; i++) {
        try {
          return await fn(...args);
        } catch (err) {
          lastErr = err;
          if (i < retries) {
            logger.warn(`[${this.provider}] Retry attempt ${i + 1}/${retries}`, { error: err.message });
            await new Promise((r) => setTimeout(r, delayMs * (i + 1)));
          }
        }
      }
      throw lastErr;
    };
  }

  async audit(action, details = {}) {
    const { default: SecurityAuditLog } = await import('../../models/SecurityAuditLog.js');
    try {
      await SecurityAuditLog.create({
        action,
        resourceType: 'cloud',
        provider: this.provider,
        resourceId: this.accountId,
        status: details.status !== false ? 'success' : 'failure',
        details: { ...details, provider: this.provider, accountId: this.accountId },
        severity: details.severity || 'Low',
      });
    } catch (err) {
      logger.warn(`[${this.provider}] Audit log write failed`, { error: err.message });
    }
  }

  getRiskLevel(score) {
    if (score >= 81) return 'Critical';
    if (score >= 61) return 'High';
    if (score >= 31) return 'Medium';
    return 'Low';
  }

  getDefaultMetadata() {
    return {
      provider: this.provider,
      accountId: this.accountId,
      region: this.region,
      lastConnected: this.isConnected ? new Date() : null,
    };
  }
}

export default BaseCloudProvider;
