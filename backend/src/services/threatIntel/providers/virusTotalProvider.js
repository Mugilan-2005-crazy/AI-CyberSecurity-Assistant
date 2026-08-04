import config from '../../../config/index.js';
import logger from '../../../utils/logger.js';
import { fetchWithRetry, isConfigured as isKeyConfigured, getProviderError } from '../httpClient.js';

const BASE = 'https://www.virustotal.com/api/v3';

export const name = 'VirusTotal';
export const supportedIocTypes = ['ip', 'domain', 'url', 'hash'];

export function isConfigured() {
  return isKeyConfigured(config.virusTotal.apiKey);
}

export const isVtConfigured = isConfigured;

function mapVtToReputation(stats, type) {
  const total = (stats.malicious || 0) + (stats.suspicious || 0) +
    (stats.undetected || 0) + (stats.harmless || 0) + (stats.timeout || 0);
  const dangerous = (stats.malicious || 0) + (stats.suspicious || 0);
  const reputation = total ? Math.round((dangerous / total) * 100) : 0;
  let classification = 'clean';
  if (stats.malicious > 0) classification = 'malicious';
  else if (stats.suspicious > 0) classification = 'suspicious';
  return { reputation, classification, stats, total, dangerous };
}

function extractMalwareInfo(lastAnalysis) {
  if (!lastAnalysis || !lastAnalysis.results) return null;
  const results = Object.values(lastAnalysis.results).filter((r) => r.category && r.category !== 'harmless' && r.category !== 'timeout');
  if (!results.length) return null;
  const engine = results[0];
  return {
    isMalware: engine.category === 'malicious',
    type: engine.category,
    family: engine.result || '',
    names: results.map((r) => r.result).filter(Boolean),
  };
}

function mapVtToMitre(deprecated) {
  if (!deprecated || !Array.isArray(deprecated)) return [];
  return deprecated.map((t) => ({
    techniqueId: t.id || '',
    techniqueName: t.name || '',
    tactic: t.tactic || '',
    severity: t.severity || 'Medium',
    confidence: t.confidence ? Number((t.confidence / 100).toFixed(2)) : 0.5,
  }));
}

function buildTimeline(date, event, description) {
  if (!date) return null;
  return { date: new Date(date), event, description, source: 'VirusTotal' };
}

export async function query(ioc, iocType) {
  if (!isVtConfigured()) {
    return getProviderError(name);
  }

  try {
    const endpoint = iocType === 'url'
      ? `/urls/${encodeURIComponent(btoa(ioc))}`
      : iocType === 'hash'
        ? `/files/${ioc}`
        : `/${iocType}s/${encodeURIComponent(ioc)}`;

    const url = `${BASE}${endpoint}`;
    const data = await fetchWithRetry(url, {
      headers: { 'x-apikey': config.virusTotal.apiKey },
    });

    const attrs = data?.data?.attributes || {};
    const lastAnalysis = attrs.last_analysis_stats || {};
    const { reputation, classification, stats, total, dangerous } = mapVtToReputation(lastAnalysis, iocType);

    return {
      provider: name,
      success: true,
      reputation,
      classification,
      threatCategory: attrs.category_name || (classification !== 'clean' ? 'malware' : 'benign'),
      malwareInfo: extractMalwareInfo(attrs.last_analysis_results),
      cves: [],
      mitreTechniques: mapVtToMitre(attrs.deprecated),
      attackTimeline: [
        buildTimeline(attrs.last_analysis_date, 'VT scan', `VirusTotal analysis: ${dangerous}/${total} engines flagged`),
      ].filter(Boolean),
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

export default { name, supportedIocTypes, isConfigured: isVtConfigured, query, mapVtToReputation, extractMalwareInfo };
