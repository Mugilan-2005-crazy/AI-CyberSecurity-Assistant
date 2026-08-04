import config from '../../config/index.js';
import logger from '../../utils/logger.js';

const CACHE_TTL = config.threatIntel?.cacheTtl ?? 3_600_000;
const DEFAULT_TIMEOUT = config.threatIntel?.requestTimeout ?? 15_000;
const MAX_RETRIES = config.threatIntel?.maxRetries ?? 3;

const cache = new Map();

function getCacheKey(url, options = {}) {
  const headers = options.headers || {};
  const keyParts = [url];
  for (const [k, v] of Object.entries(headers)) {
    keyParts.push(`${k}:${v}`);
  }
  return keyParts.join('|');
}

export function getCached(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.expiresAt > 0) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

export function setCache(key, data, ttl = CACHE_TTL) {
  cache.set(key, { data, expiresAt: Date.now() + ttl });
}

export function clearCache() {
  cache.clear();
}

export function getCacheSize() {
  return cache.size;
}

export async function fetchWithRetry(url, options = {}, retries = MAX_RETRIES) {
  const cacheKey = getCacheKey(url, options);
  const cached = getCached(cacheKey);
  if (cached) {
    logger.debug(`[httpClient] Cache hit for ${url}`);
    return cached;
  }

  const timeout = options.timeout ?? DEFAULT_TIMEOUT;
  let lastError = null;

  for (let attempt = 1; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      logger.debug(`[httpClient] Fetching ${url} (attempt ${attempt}/${retries})`);
      const res = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      if (res.status === 429) {
        const retryAfter = parseInt(res.headers.get('retry-after') || '1', 10) * 1000;
        const wait = Math.min(retryAfter, 5000) * attempt;
        logger.warn(`[httpClient] Rate limited (429) for ${url}, waiting ${wait}ms`);
        await new Promise((r) => setTimeout(r, wait));
        lastError = new Error(`Rate limited (429)`);
        continue;
      }

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        const errMsg = `HTTP ${res.status}: ${body.slice(0, 200)}`;
        if (res.status >= 500 && attempt < retries) {
          const backoff = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
          logger.warn(`[httpClient] ${url} failed (${res.status}), retrying in ${backoff}ms`);
          await new Promise((r) => setTimeout(r, backoff));
          lastError = new Error(errMsg);
          continue;
        }
        throw new Error(errMsg);
      }

      const data = await res.json().catch(() => null);
      clearTimeout(timer);
      setCache(cacheKey, data);
      return data;
    } catch (err) {
      clearTimeout(timer);
      if (err.name === 'AbortError') {
        lastError = new Error(`Request timed out after ${timeout}ms`);
      } else {
        lastError = err;
      }
      if (attempt < retries && !err.name?.includes('Abort')) {
        const backoff = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
        logger.warn(`[httpClient] ${url} failed (attempt ${attempt}), retrying in ${backoff}ms: ${lastError.message}`);
        await new Promise((r) => setTimeout(r, backoff));
      }
    }
  }

  throw lastError || new Error(`All ${retries} attempts failed for ${url}`);
}

export function isConfigured(configKey) {
  const apiKey = configKey;
  return Boolean(apiKey && apiKey.length > 0 && apiKey !== 'your_api_key_here');
}

export function getProviderError(providerName) {
  return { provider: providerName, success: false, error: `${providerName} API key not configured` };
}

export default { fetchWithRetry, getCached, setCache, clearCache, getCacheSize, isConfigured, getProviderError };
