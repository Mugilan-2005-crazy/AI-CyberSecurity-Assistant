import config from '../../../config/index.js';
import logger from '../../../utils/logger.js';
import { fetchWithRetry, isConfigured as isKeyConfigured, getProviderError } from '../httpClient.js';
import { getCVEById } from '../cveService.js';

const BASE = 'https://services.nvd.nist.gov/rest/json/cves/2.0';

export const name = 'NVD';
export const supportedIocTypes = ['cve'];

export function isConfigured() {
  return isKeyConfigured(config.nvd.apiKey);
}

export const isNvdConfigured = isConfigured;

export async function query(cveId) {
  const local = await getCVEById(cveId);
  if (local) {
    return {
      provider: name,
      success: true,
      reputation: 0,
      classification: 'unknown',
      threatCategory: 'vulnerability',
      cves: [
        {
          id: local.id,
          severity: local.severity,
          cvssScore: local.cvssScore,
          description: local.description,
          references: local.references,
          affected: local.affected,
          publishedDate: local.publishedDate,
        },
      ],
      mitreTechniques: [],
      attackTimeline: local.publishedDate
        ? [{ date: new Date(local.publishedDate), event: `CVE published: ${local.id}`, description: local.description || '', source: 'NVD' }]
        : [],
      raw: local,
    };
  }

  if (!isNvdConfigured()) {
    return getProviderError('NVD');
  }

  try {
    const url = `${BASE}?cveId=${encodeURIComponent(cveId)}`;
    const data = await fetchWithRetry(url, {
      headers: config.nvd.apiKey ? { 'apiKey': config.nvd.apiKey } : {},
    });

    const vuln = data?.vulnerabilities?.[0]?.cve;
    if (!vuln) {
      return {
        provider: name,
        success: false,
        error: `CVE ${cveId} not found in NVD`,
        reputation: 0,
        classification: 'unknown',
        threatCategory: 'unknown',
        cves: [],
        mitreTechniques: [],
        attackTimeline: [],
      };
    }

    const cvssData = vuln.metrics?.cvssMetricV31?.[0]?.cvssData || vuln.metrics?.cvssMetricV30?.[0]?.cvssData || vuln.metrics?.cvssMetricV2?.[0]?.cvssData || {};
    const cvssScore = cvssData?.baseScore || 0;
    const severity = cvssData?.baseSeverity || 'UNKNOWN';

    const timelines = (vuln.published || vuln.lastModified) ? [
      { date: new Date(vuln.published || vuln.lastModified), event: `CVE published: ${vuln.id}`, description: vuln.descriptions?.[0]?.value || '', source: 'NVD' },
    ] : [];

    const cves = [{
      id: vuln.id,
      severity,
      cvssScore,
      description: vuln.descriptions?.[0]?.value || '',
      references: vuln.references?.map((r) => r.url) || [],
      affected: vuln.weaknesses?.map((w) => w.name) || [],
      publishedDate: vuln.published,
    }];

    return {
      provider: name,
      success: true,
      reputation: 0,
      classification: cvssScore >= 9.0 ? 'malicious' : cvssScore >= 7.0 ? 'suspicious' : 'clean',
      threatCategory: 'vulnerability',
      cves,
      mitreTechniques: [],
      attackTimeline: timelines,
      raw: vuln,
    };
  } catch (err) {
    logger.warn(`[${name}] Query failed for ${cveId}: ${err.message}`);
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

export default { name, supportedIocTypes, isConfigured: isNvdConfigured, query };
