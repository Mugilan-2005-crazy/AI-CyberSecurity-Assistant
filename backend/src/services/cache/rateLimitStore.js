/**
 * services/cache/rateLimitStore.js
 * ------------------------------------------------------------
 * Redis-backed rate limit store factory with MemoryStore
 * fallback.
 *
 * Root cause addressed:
 *   express-rate-limit ships with MemoryStore, which is a simple
 *   in-memory Map. Under production load the setTimeout-based
 *   TTL cleanup can be delayed by a busy event loop, causing
 *   rate-limit entries to persist past their window and
 *   permanently block clients with HTTP 429.
 *
 * Fix:
 *   Use Redis as the backing store. Redis TTLs are enforced
 *   server-side and never miss an expiry. When Redis is
 *   unreachable the store transparently falls back to
 *   MemoryStore so the app keeps working.
 *
 * express-rate-limit v7 forbids sharing a store instance across
 * multiple limiters (ERR_ERL_STORE_REUSE), so this module
 * exports a factory that returns a NEW store per call.
 *
 * Redis packages (redis + rate-limit-redis) are loaded via
 * dynamic import to avoid Jest ESM loader issues in test mode
 * and to avoid pulling them into the test runtime.
 */
import { MemoryStore } from 'express-rate-limit';
import config from '../../config/index.js';
import logger from '../../utils/logger.js';

function getRedisUrl() {
  if (process.env.REDIS_URL) return process.env.REDIS_URL;
  const scheme = config.redis.tls ? 'rediss' : 'redis';
  if (config.redis.password) {
    return `${scheme}://:${encodeURIComponent(config.redis.password)}@${config.redis.host}:${config.redis.port}/${config.redis.db}`;
  }
  return `${scheme}://${config.redis.host}:${config.redis.port}/${config.redis.db}`;
}

class LazyRedisRateLimitStore {
  constructor() {
    this._lazyInit = false;
    this._redisStore = null;
    this._memoryStore = null;
    this._redisClient = null;
  }

  init(options) {
    this.windowMs = options.windowMs;
    this.max = options.max;
    this._memoryStore = new MemoryStore({
      windowMs: options.windowMs,
      max: options.max,
      dispatchResetPeriod: 1000,
    });
  }

  async _ensureRedis() {
    if (this._lazyInit) return;
    this._lazyInit = true;

    if (process.env.NODE_ENV === 'test') return;

    try {
      const [{ createClient }, { RedisStore }] = await Promise.all([
        import('redis'),
        import('rate-limit-redis'),
      ]);

      this._redisClient = createClient({
        url: getRedisUrl(),
        socket: {
          connectTimeout: config.redis.connectTimeoutMs,
          reconnectStrategy: (retries) => {
            if (retries >= 5) {
              logger.warn('[RateLimitStore] Max Redis reconnection attempts reached, using MemoryStore');
              this._redisStore = null;
              this._redisClient = null;
              return false;
            }
            const delay = Math.min(100 * Math.pow(1.5, retries), 5000);
            return delay;
          },
        },
      });

      this._redisClient.on('error', (err) => {
        logger.warn('[RateLimitStore] Redis error', { error: err.message });
      });

      this._redisClient.on('ready', () => {
        logger.info('[RateLimitStore] Redis ready for rate limiting');
      });

      this._redisClient.on('reconnecting', () => {
        logger.info('[RateLimitStore] Redis reconnecting for rate limiting');
      });

      await this._redisClient.connect();

      this._redisStore = new RedisStore({
        sendCommand: (...args) => this._redisClient.sendCommand(args),
        prefix: `rl:${Date.now()}:${Math.random().toString(36).slice(2, 9)}:`,
      });
      this._redisStore.init({ windowMs: this.windowMs, max: this.max });
      logger.info('[RateLimitStore] Redis-backed rate limit store initialized');
    } catch (err) {
      logger.warn('[RateLimitStore] Redis unavailable, using MemoryStore fallback', { error: err.message });
      this._redisStore = null;
      this._redisClient = null;
    }
  }

  _fallbackIncrement(key, delta, windowMs) {
    return this._memoryStore.increment(key, delta, windowMs);
  }

  increment(key, delta, windowMs) {
    if (this._redisStore) {
      return this._redisStore.increment(key, delta, windowMs).catch((err) => {
        logger.warn('[RateLimitStore] Redis increment failed, using memory fallback', { error: err.message, key });
        return this._memoryStore.increment(key, delta, windowMs);
      });
    }

    return this._ensureRedis().then(() => {
      if (this._redisStore) {
        return this._redisStore.increment(key, delta, windowMs).catch((err) => {
          logger.warn('[RateLimitStore] Redis increment failed, using memory fallback', { error: err.message, key });
          return this._memoryStore.increment(key, delta, windowMs);
        });
      }
      return this._memoryStore.increment(key, delta, windowMs);
    });
  }

  decrement(key, delta) {
    if (this._redisStore) {
      return this._redisStore.decrement(key, delta).catch((err) => {
        logger.warn('[RateLimitStore] Redis decrement failed', { error: err.message, key });
        return this._memoryStore.decrement(key, delta);
      });
    }
    return this._memoryStore.decrement(key, delta);
  }

  resetKey(key) {
    if (this._redisStore) {
      return this._redisStore.resetKey(key).catch((err) => {
        logger.warn('[RateLimitStore] Redis resetKey failed', { error: err.message, key });
        return this._memoryStore.resetKey(key);
      });
    }
    return this._memoryStore.resetKey(key);
  }

  resetAll() {
    if (this._redisStore) {
      return this._redisStore.resetAll().catch((err) => {
        logger.warn('[RateLimitStore] Redis resetAll failed', { error: err.message });
        return this._memoryStore.resetAll();
      });
    }
    return this._memoryStore.resetAll();
  }
}

function createRateLimitStore() {
  if (process.env.NODE_ENV === 'test') {
    return new MemoryStore({ windowMs: 15 * 60 * 1000, max: 100, dispatchResetPeriod: 1000 });
  }
  return new LazyRedisRateLimitStore();
}

export { createRateLimitStore, LazyRedisRateLimitStore };
export default { createRateLimitStore };
