/**
 * services/cache/redisClient.js
 * ------------------------------------------------------------
 * Redis connection manager with graceful fallback.
 *
 * Production behavior:
 *  - Redis available: all cache operations use Redis.
 *  - Redis unavailable: transparently falls back to an in-memory
 *    Map-based store so the application never crashes. A warning is
 *    logged so operators know caching is degraded.
 *
 * The module exposes a unified async interface (get/set/del/ttl/exists)
 * so callers do not need to know whether Redis or the fallback is in use.
 */
import { createClient } from 'redis';
import config from '../../config/index.js';
import logger from '../../utils/logger.js';

/* In-memory fallback used when Redis is unavailable */
class MemoryFallback {
  constructor() {
    this.store = new Map();
    this.expiry = new Map();
    this._sweepInterval = null;
  }

  _startSweep() {
    if (this._sweepInterval) return;
    this._sweepInterval = setInterval(() => {
      const now = Date.now();
      for (const [key, exp] of this.expiry.entries()) {
        if (now > exp) {
          this.store.delete(key);
          this.expiry.delete(key);
        }
      }
    }, 60000);
  }

  _stopSweep() {
    if (this._sweepInterval) {
      clearInterval(this._sweepInterval);
      this._sweepInterval = null;
    }
  }

  _isExpired(key) {
    const exp = this.expiry.get(key);
    if (exp && Date.now() > exp) {
      this.store.delete(key);
      this.expiry.delete(key);
      return true;
    }
    return false;
  }

  async get(key) {
    if (this._isExpired(key)) return null;
    const val = this.store.get(key);
    if (val === undefined) return null;
    return typeof val === 'string' ? val : JSON.stringify(val);
  }

  async set(key, value, ttlSeconds) {
    let parsed = value;
    try { parsed = JSON.parse(value); } catch { /* store raw string */ }
    this.store.set(key, parsed);
    if (ttlSeconds && ttlSeconds > 0) {
      this.expiry.set(key, Date.now() + ttlSeconds * 1000);
    }
    if (!this._sweepInterval) this._startSweep();
    return 'OK';
  }

  async del(key) {
    const existed = this.store.has(key);
    this.store.delete(key);
    this.expiry.delete(key);
    return existed ? 1 : 0;
  }

  async exists(key) {
    if (this._isExpired(key)) return 0;
    return this.store.has(key) ? 1 : 0;
  }

  async ttl(key) {
    if (!this._isExpired(key) && this.expiry.has(key)) {
      return Math.ceil((this.expiry.get(key) - Date.now()) / 1000);
    }
    return -2;
  }

  async flushdb() {
    this.store.clear();
    this.expiry.clear();
    return 'OK';
  }

  async quit() {
    this._stopSweep();
    this.store.clear();
    this.expiry.clear();
    return 'OK';
  }

  async ping() {
    return 'PONG';
  }
}

let client = null;
let fallback = null;
let isRedisConnected = false;

const buildRedisUrl = () => {
  if (config.redis.password) {
    return `redis://:${encodeURIComponent(config.redis.password)}@${config.redis.host}:${config.redis.port}/${config.redis.db}`;
  }
  return `redis://${config.redis.host}:${config.redis.port}/${config.redis.db}`;
};

export async function connectRedis() {
  if (process.env.NODE_ENV === 'test') {
    fallback = new MemoryFallback();
    isRedisConnected = false;
    logger.info('[redisClient] Using in-memory fallback (test environment)');
    return fallback;
  }

  if (client && isRedisConnected) return client;

  try {
    client = createClient({
      url: buildRedisUrl(),
      socket: {
        connectTimeout: config.redis.connectTimeoutMs,
        reconnectStrategy: (retries) => {
          if (retries >= config.redis.retryStrategy.retries) {
            logger.error('[redisClient] Max reconnection attempts reached, switching to fallback');
            isRedisConnected = false;
            fallback = new MemoryFallback();
            return;
          }
          const delay = Math.min(
            config.redis.retryStrategy.baseDelayMs * Math.pow(1.5, retries),
            config.redis.retryStrategy.maxDelayMs
          );
          return delay;
        },
        lazyConnect: config.redis.lazyConnect,
      },
    });

    client.on('error', (err) => {
      logger.warn(`[redisClient] Redis error: ${err.message}`, { code: err.code });
      isRedisConnected = false;
    });

    client.on('connect', () => {
      logger.info('[redisClient] Redis connected');
      isRedisConnected = true;
    });

    client.on('reconnecting', () => {
      logger.info('[redisClient] Redis reconnecting...');
    });

    client.on('end', () => {
      logger.warn('[redisClient] Redis connection ended, falling back to memory');
      isRedisConnected = false;
      if (!fallback) fallback = new MemoryFallback();
    });

    await client.connect();
    isRedisConnected = true;
    fallback = null;
    logger.info('[redisClient] Redis connection established');
    return client;
  } catch (err) {
    logger.warn(`[redisClient] Redis unavailable, using in-memory fallback: ${err.message}`);
    client = null;
    isRedisConnected = false;
    fallback = new MemoryFallback();
    return fallback;
  }
}

export function getRedisClient() {
  return client;
}

export function isRedisAvailable() {
  return isRedisConnected;
}

export function getActiveCache() {
  if (isRedisConnected && client) return client;
  if (!fallback) fallback = new MemoryFallback();
  return fallback;
}

export async function closeRedis() {
  if (client) {
    try {
      await client.quit();
    } catch (err) {
      logger.warn(`[redisClient] Error closing Redis: ${err.message}`);
    }
    client = null;
  }
  isRedisConnected = false;
  if (fallback) {
    await fallback.quit();
    fallback = null;
  }
}

export { MemoryFallback };

export default {
  connectRedis,
  getRedisClient,
  isRedisAvailable,
  getActiveCache,
  closeRedis,
  MemoryFallback,
};
