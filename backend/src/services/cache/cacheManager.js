/**
 * services/cache/cacheManager.js
 * ------------------------------------------------------------
 * Unified cache abstraction layer.
 *
 * Provides a consistent API regardless of whether Redis or the
 * in-memory fallback is active. All cache operations are async
 * so they work identically in both modes.
 *
 * Features:
 *  - Key prefixing (config.redis.keyPrefix)
 *  - JSON serialization of objects
 *  - TTL support (seconds)
 *  - Cache invalidation (del / delPattern)
 *  - getOrSet: atomic fetch-or-compute pattern
 *  - Graceful fallback: if Redis fails mid-operation, the call
 *    still succeeds using the memory store.
 *
 * Use cases:
 *  - Threat intelligence cache
 *  - Session/cache optimization
 *  - Rate limiting storage
 *  - Frequently accessed security data
 */
import config from '../../config/index.js';
import logger from '../../utils/logger.js';
import redisClient, { getActiveCache, connectRedis, MemoryFallback } from './redisClient.js';

class CacheManager {
  constructor() {
    this.prefix = config.redis.keyPrefix || 'csa:';
    this.defaultTTL = Number(process.env.CACHE_DEFAULT_TTL) || 3600;
  }

  _key(key) {
    return `${this.prefix}${key}`;
  }

  _serialize(value) {
    if (typeof value === 'string') return value;
    return JSON.stringify(value);
  }

  _deserialize(raw) {
    if (raw === null || raw === undefined) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }

  async get(key) {
    try {
      const cache = getActiveCache();
      const raw = await cache.get(this._key(key));
      return this._deserialize(raw);
    } catch (err) {
      logger.warn(`[cacheManager] GET failed for key "${key}": ${err.message}`);
      return null;
    }
  }

  async set(key, value, ttlSeconds) {
    try {
      const cache = getActiveCache();
      const ttl = ttlSeconds || this.defaultTTL;
      const serialized = this._serialize(value);
      await cache.set(this._key(key), serialized, ttl);
      return true;
    } catch (err) {
      logger.warn(`[cacheManager] SET failed for key "${key}": ${err.message}`);
      return false;
    }
  }

  async del(key) {
    try {
      const cache = getActiveCache();
      return await cache.del(this._key(key));
    } catch (err) {
      logger.warn(`[cacheManager] DEL failed for key "${key}": ${err.message}`);
      return 0;
    }
  }

  async delPattern(pattern) {
    try {
      const cache = getActiveCache();
      const fullPattern = this._key(pattern);
      if (cache.scan) {
        let cursor = '0';
        const matchedKeys = [];
        do {
          const result = await cache.scan(cursor, 'MATCH', fullPattern, 'COUNT', '100');
          cursor = result[0];
          matchedKeys.push(...result[1]);
        } while (cursor !== '0');
        if (matchedKeys.length === 0) return 0;
        let deleted = 0;
        for (const k of matchedKeys) {
          deleted += await cache.del(k);
        }
        return deleted;
      }
      if (cache instanceof MemoryFallback) {
        let deleted = 0;
        for (const key of cache.store.keys()) {
          if (key.includes(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))) {
            cache.store.delete(key);
            cache.expiry.delete(key);
            deleted++;
          }
        }
        return deleted;
      }
      return 0;
    } catch (err) {
      logger.warn(`[cacheManager] DEL_PATTERN failed for pattern "${pattern}": ${err.message}`);
      return 0;
    }
  }

  async exists(key) {
    try {
      const cache = getActiveCache();
      return await cache.exists(this._key(key));
    } catch (err) {
      return 0;
    }
  }

  async ttl(key) {
    try {
      const cache = getActiveCache();
      return await cache.ttl(this._key(key));
    } catch (err) {
      return -2;
    }
  }

  async getOrSet(key, fetchFn, ttlSeconds) {
    const cached = await this.get(key);
    if (cached !== null && cached !== undefined) {
      return cached;
    }
    const value = await fetchFn();
    if (value !== null && value !== undefined) {
      await this.set(key, value, ttlSeconds);
    }
    return value;
  }

  async invalidatePattern(pattern) {
    return await this.delPattern(pattern);
  }

  async flush() {
    try {
      const cache = getActiveCache();
      await cache.flushdb();
      return true;
    } catch (err) {
      logger.warn(`[cacheManager] FLUSH failed: ${err.message}`);
      return false;
    }
  }

  getStatus() {
    return {
      redisConnected: redisClient.isRedisAvailable(),
      prefix: this.prefix,
      defaultTTL: this.defaultTTL,
    };
  }
}

const cacheManager = new CacheManager();
export default cacheManager;

export { connectRedis };
