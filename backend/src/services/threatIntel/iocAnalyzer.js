import logger from '../../utils/logger.js';
import * as virusTotalProvider from './providers/virusTotalProvider.js';
import * as abuseIpdbProvider from './providers/abuseipdbProvider.js';
import * as otxProvider from './providers/otxProvider.js';
import * as nvdProvider from './providers/nvdProvider.js';

export const IOC_TYPES = {
  IP: 'ip',
  DOMAIN: 'domain',
  URL: 'url',
  HASH: 'hash',
  EMAIL: 'email',
  CVE: 'cve',
};

export const IOC_REGEX = {
  cve: /^CVE-\d{4}-\d{4,}$/i,
  md5: /^[a-f0-9]{32}$/i,
  sha1: /^[a-f0-9]{40}$/i,
  sha256: /^[a-f0-9]{64}$/i,
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  ipv4: /^(\d{1,3}\.){3}\d{1,3}$/,
  ipv6: /^[0-9a-f]{0,4}::?[0-9a-f]{0,4}(?::[0-9a-f]{0,4}){0,6}$/i,
  url: /^https?:\/\//i,
  domain: /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i,
};

export function detectIocType(value) {
  if (typeof value !== 'string') return 'unknown';
  const v = value.trim();

  if (IOC_REGEX.cve.test(v)) return IOC_TYPES.CVE;
  if (IOC_REGEX.md5.test(v) || IOC_REGEX.sha1.test(v) || IOC_REGEX.sha256.test(v)) return IOC_TYPES.HASH;
  if (IOC_REGEX.email.test(v)) return IOC_TYPES.EMAIL;
  if (IOC_REGEX.ipv4.test(v) || IOC_REGEX.ipv6.test(v)) return IOC_TYPES.IP;
  if (IOC_REGEX.url.test(v)) return IOC_TYPES.URL;
  if (IOC_REGEX.domain.test(v)) return IOC_TYPES.DOMAIN;

  return 'unknown';
}

export function validateIoc(value, iocType) {
  if (!value || typeof value !== 'string') {
    return { valid: false, error: 'IOC value is required' };
  }
  const v = value.trim();
  if (!v) return { valid: false, error: 'IOC value cannot be empty' };

  const detected = detectIocType(v);
  if (iocType && iocType !== 'unknown' && detected !== iocType && detected !== 'unknown') {
    return { valid: true, warning: `Detected type (${detected}) differs from specified type (${iocType})`, effectiveType: detected };
  }

  if (iocType === IOC_TYPES.EMAIL && !IOC_REGEX.email.test(v)) return { valid: false, error: 'Invalid email format' };
  if (iocType === IOC_TYPES.IP && !IOC_REGEX.ipv4.test(v) && !IOC_REGEX.ipv6.test(v)) return { valid: false, error: 'Invalid IP address' };
  if (iocType === IOC_TYPES.URL && !IOC_REGEX.url.test(v)) return { valid: false, error: 'Invalid URL (must start with http:// or https://)' };
  if (iocType === IOC_TYPES.CVE && !IOC_REGEX.cve.test(v)) return { valid: false, error: 'Invalid CVE format (expected CVE-YYYY-NNNN)' };

  return { valid: true, effectiveType: iocType || detected };
}

const PROVIDERS_BY_TYPE = {
  [IOC_TYPES.IP]: [virusTotalProvider, abuseIpdbProvider, otxProvider],
  [IOC_TYPES.DOMAIN]: [virusTotalProvider, otxProvider],
  [IOC_TYPES.URL]: [virusTotalProvider, otxProvider],
  [IOC_TYPES.HASH]: [virusTotalProvider, otxProvider],
  [IOC_TYPES.CVE]: [nvdProvider],
  [IOC_TYPES.EMAIL]: [],
};

export async function queryProviders(ioc, iocType) {
  const providers = PROVIDERS_BY_TYPE[iocType] || [];
  const results = [];

  for (const provider of providers) {
    try {
      if (!provider.isConfigured()) {
        results.push({ provider: provider.name, success: false, error: 'Not configured' });
        continue;
      }
      const result = await provider.query(ioc, iocType);
      results.push(result);
    } catch (err) {
      logger.warn(`[iocAnalyzer] Provider ${provider.name} failed for ${ioc}: ${err.message}`);
      results.push({ provider: provider.name, success: false, error: err.message });
    }
  }

  if (iocType === IOC_TYPES.EMAIL && providers.length === 0) {
    results.push({ provider: 'internal', success: true, reputation: 50, classification: 'unknown', threatCategory: 'email', error: null });
  }

  return results;
}

export async function analyzeIoc(ioc, iocType, userId) {
  logger.info('[iocAnalyzer] Analyzing IOC', { ioc: iocType === 'email' ? '[redacted]' : ioc, iocType, userId });

  const validation = validateIoc(ioc, iocType);
  if (!validation.valid) {
    return { valid: false, error: validation.error };
  }

  const effectiveType = validation.effectiveType || detectIocType(ioc);
  const providerResults = await queryProviders(ioc, effectiveType);
  const successResults = providerResults.filter((r) => r.success);

  return {
    ioc,
    iocType: effectiveType,
    providers: providerResults,
    providerResults: successResults,
    providerCount: providerResults.length,
    successCount: successResults.length,
    userId,
  };
}

export default { detectIocType, validateIoc, analyzeIoc, queryProviders, IOC_TYPES };
