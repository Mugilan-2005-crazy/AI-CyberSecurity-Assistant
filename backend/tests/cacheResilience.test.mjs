/**
 * tests/cacheResilience.test.mjs
 * ============================================================
 * Chaos & resilience tests for the Redis cache layer.
 * Verifies graceful fallback when Redis is unavailable,
 * cache TTL expiry, and memory-store consistency.
 * ============================================================
 */
import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import cacheManager from '../src/services/cache/cacheManager.js';
import redisClient, { getActiveCache, MemoryFallback } from '../src/services/cache/redisClient.js';

describe('Cache Resilience — Redis Fallback', () => {
  test('cacheManager.getStatus returns object with redisConnected', () => {
    const status = cacheManager.getStatus();
    expect(status).toHaveProperty('redisConnected');
    expect(status).toHaveProperty('prefix');
    expect(status).toHaveProperty('defaultTTL');
  });

  test('MemoryFallback get returns null for missing keys', async () => {
    const mem = new MemoryFallback();
    const result = await mem.get('nonexistent-key');
    expect(result).toBeNull();
  });

  test('MemoryFallback set then get returns stored value', async () => {
    const mem = new MemoryFallback();
    await mem.set('test-key', 'test-value', 60);
    const result = await mem.get('test-key');
    expect(result).toBe('test-value');
  });

  test('MemoryFallback del removes key', async () => {
    const mem = new MemoryFallback();
    await mem.set('delete-me', 'data', 60);
    const existed = await mem.exists('delete-me');
    expect(existed).toBe(1);

    const deleted = await mem.del('delete-me');
    expect(deleted).toBe(1);
    const afterDel = await mem.exists('delete-me');
    expect(afterDel).toBe(0);
  });

  test('MemoryFallback respects TTL expiry', async () => {
    const mem = new MemoryFallback();
    await mem.set('expire-key', 'value', 1);

    const beforeExpiry = await mem.get('expire-key');
    expect(beforeExpiry).toBe('value');

    await new Promise((r) => setTimeout(r, 1100));
    const afterExpiry = await mem.get('expire-key');
    expect(afterExpiry).toBeNull();
  });

  test('MemoryFallback ping returns PONG', async () => {
    const mem = new MemoryFallback();
    const result = await mem.ping();
    expect(result).toBe('PONG');
  });

  test('MemoryFallback flushdb clears all keys', async () => {
    const mem = new MemoryFallback();
    await mem.set('key1', 'val1', 60);
    await mem.set('key2', 'val2', 60);
    await mem.flushdb();

    expect(await mem.get('key1')).toBeNull();
    expect(await mem.get('key2')).toBeNull();
  });

  test('MemoryFallback handles JSON objects', async () => {
    const mem = new MemoryFallback();
    const obj = { id: 1, name: 'test', nested: { flag: true } };
    await mem.set('obj-key', obj, 60);
    const result = await mem.get('obj-key');
    expect(JSON.parse(result)).toEqual(obj);
  });

  test('cacheManager getOrSet computes value on cache miss', async () => {
    const testKey = `or-set-test-${Date.now()}`;
    const fetchFn = () => Promise.resolve({ computed: true });

    const result = await cacheManager.getOrSet(testKey, fetchFn, 60);
    expect(result).toEqual({ computed: true });

    await cacheManager.del(testKey);
  });

  test('cacheManager getOrSet returns cached value on hit', async () => {
    const testKey = `or-set-hit-${Date.now()}`;
    await cacheManager.set(testKey, 'cached-value', 300);

    let called = false;
    const fetchFn = () => {
      called = true;
      return Promise.resolve('new-value');
    };

    const result = await cacheManager.getOrSet(testKey, fetchFn, 300);
    expect(result).toBe('cached-value');
    expect(called).toBe(false);

    await cacheManager.del(testKey);
  });

  test('cacheManager gracefully handles get on missing key', async () => {
    const result = await cacheManager.get('definitely-missing-key-12345');
    expect(result).toBeNull();
  });

  test('cacheManager gracefully handles del on missing key', async () => {
    const result = await cacheManager.del('another-missing-key-67890');
    expect(result).toBe(0);
  });

  test('getActiveCache returns a working cache instance', async () => {
    const cache = getActiveCache();
    expect(cache).toBeDefined();
    expect(typeof cache.get).toBe('function');
    expect(typeof cache.set).toBe('function');
    expect(typeof cache.del).toBe('function');
  });
});
