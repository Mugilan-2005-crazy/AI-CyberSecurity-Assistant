import config from '../../../config/index.js';
import logger from '../../../utils/logger.js';
import { fetchWithRetry, isConfigured as isKeyConfigured, getProviderError } from '../httpClient.js';

const BASE = 'https://api.abuseipdb.com/api/v2';

export const name = 'AbuseIPDB';
export const supportedIocTypes = ['ip'];

export function isConfigured() {
  return isKeyConfigured(config.abuseipdb.apiKey);
}

export const isAbuseIpdbConfigured = isConfigured;

export async function query(ioc) {
  if (!isAbuseIpdbConfigured()) {
    return getProviderError(name);
  }

  try {
    const url = `${BASE}/check?ipAddress=${encodeURIComponent(ioc)}&maxAgeInDays=90`;
    const data = await fetchWithRetry(url, {
      headers: {
        'Key': config.abuseipdb.apiKey,
        'Accept': 'application/json',
      },
    });

    const attrs = data?.data || {};
    const abuseCount = attrs.totalReports || 0;
    const reputation = attrs.abuseConfidenceScore || 0;

    let classification = 'clean';
    if (reputation >= 50) classification = 'malicious';
    else if (reputation > 0) classification = 'suspicious';

    return {
      provider: name,
      success: true,
      reputation,
      classification,
      threatCategory: classification !== 'clean' ? 'abuse' : 'benign',
      malwareInfo: null,
      cves: [],
      mitreTechniques: [],
      attackTimeline: [
        {
          date: attrs.lastReportedAt ? new Date(attrs.lastReportedAt) : new Date(),
          event: 'Abuse report',
          description: `${abuseCount} reports in the last 90 days`,
          source: name,
        },
      ],
      raw: attrs,
    };
  } catch (err) {
    logger.warn(`[${name}] Query failed for ${ioc}: ${err.message}`);
    return {
      provider: name,
      success: false,
      error: err.message,
      reputation: 0,
      classification: 'unknown',
      threatCategory: 'unknown',
      cves: [],
      mitreTechniques: [],
      attackTimeline: [],
    };
  }
}

export default { name, supportedIocTypes, isConfigured: isAbuseIpdbConfigured, query };
