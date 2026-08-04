import config from '../../../config/index.js';
import logger from '../../../utils/logger.js';
import { fetchWithRetry, isConfigured as isKeyConfigured, getProviderError } from '../httpClient.js';

const BASE = 'https://otx.alienvault.com/api/v1';

export const name = 'AlienVault OTX';
export const supportedIocTypes = ['ip', 'domain', 'url', 'hash'];

export function isConfigured() {
  return isKeyConfigured(config.otx.apiKey);
}

export const isOtxConfigured = isConfigured;

function mapOtxReputation(reputation) {
  if (reputation <= -50) return { score: Math.abs(reputation), classification: 'malicious', category: 'malware' };
  if (reputation > 0) return { score: reputation, classification: 'suspicious', category: 'abuse' };
  if (reputation === 0) return { score: 0, classification: 'clean', category: 'benign' };
  return { score: 0, classification: 'unknown', category: 'unknown' };
}

function buildTimeline(pulses) {
  const timeline = [];
  if (Array.isArray(pulses)) {
    for (const pulse of pulses) {
      timeline.push({
        date: pulse.created ? new Date(pulse.created) : new Date(),
        event: `OTX pulse: ${pulse.name || pulse.id || 'activity'}`,
        description: pulse.description || '',
        source: name,
      });
    }
  }
  return timeline;
}

export async function query(ioc, iocType) {
  if (!isOtxConfigured()) {
    return getProviderError(name);
  }

  try {
    const resourcePath = iocType === 'hash' ? `indicators/file/${ioc}/general` : `indicators/${iocType}/${encodeURIComponent(ioc)}/general`;
    const url = `${BASE}/${resourcePath}`;
    const data = await fetchWithRetry(url, {
      headers: { 'X-OTX-TTL-ACCESS-KEY-USERNAME': config.otx.apiKey },
    });

    const reputation = data?.data?.reputation || 0;
    const pulses = data?.data?.pulses || [];
    const rep = mapOtxReputation(reputation);
    const validation = data?.data?.validation || [];
    const malwareFamilies = [];
    if (Array.isArray(pulses)) {
      for (const pulse of pulses) {
        if (pulse.indicator?.type && pulse.indicator?.indicator_type) {
          const family = pulse.indicator.indicator_type;
          if (!malwareFamilies.includes(family)) malwareFamilies.push(family);
        }
      }
    }

    return {
      provider: name,
      success: true,
      reputation: rep.score,
      classification: rep.classification,
      threatCategory: rep.category,
      malwareInfo: malwareFamilies.length > 0 ? { family: malwareFamilies.join(', '), type: rep.category, isMalware: rep.classification === 'malicious', names: malwareFamilies } : null,
      cves: [],
      mitreTechniques: [],
      attackTimeline: buildTimeline(pulses).slice(0, 10),
      raw: data?.data,
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

export default { name, supportedIocTypes, isConfigured: isOtxConfigured, query };
