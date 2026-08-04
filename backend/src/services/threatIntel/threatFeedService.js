import logger from '../../utils/logger.js';

const SAMPLE_FEEDS = {
  phishingDomains: [
    { domain: 'paypa1-secure.com', category: 'phishing', reportedAt: '2024-01-15' },
    { domain: 'netflix-billing-update.net', category: 'phishing', reportedAt: '2024-02-20' },
    { domain: 'microsoft-verify.xyz', category: 'phishing', reportedAt: '2024-03-10' },
    { domain: 'apple-id-locked.info', category: 'phishing', reportedAt: '2024-01-28' },
    { domain: 'google-security-alert.ga', category: 'phishing', reportedAt: '2024-04-05' },
  ],
  malwareHashes: [
    { hash: '5d41402abc4b2a76b9719d911017c592', type: 'trojan', family: 'Emotet', reportedAt: '2024-03-12' },
    { hash: '7d793037a0760186574b0282f2f435e7', type: 'ransomware', family: 'WannaCry', reportedAt: '2024-02-18' },
    { hash: 'fcea920f7412b5da7be0cf42b8c93759', type: 'trojan', family: 'TrickBot', reportedAt: '2024-04-22' },
    { hash: 'e3b0c44298fc1c149afbf4c8996fb924', type: 'backdoor', family: 'Cobalt Strike', reportedAt: '2024-05-01' },
  ],
  suspiciousIps: [
    { ip: '192.168.100.45', reason: 'Known C2 server', country: 'RU', reportedAt: '2024-01-20' },
    { ip: '10.0.0.123', reason: 'Brute force source', country: 'CN', reportedAt: '2024-03-05' },
    { ip: '203.0.113.50', reason: 'Spam relay', country: 'NL', reportedAt: '2024-04-18' },
    { ip: '198.51.100.22', reason: 'Port scanner', country: 'US', reportedAt: '2024-02-28' },
  ],
  cveReferences: [
    { id: 'CVE-2024-21762', severity: 'CRITICAL', affected: 'FortiOS', description: 'Out-of-bound write vulnerability' },
    { id: 'CVE-2024-3400', severity: 'CRITICAL', affected: 'Palo Alto PAN-OS', description: 'Command injection vulnerability' },
    { id: 'CVE-2024-23897', severity: 'HIGH', affected: 'Jenkins', description: 'Arbitrary file read vulnerability' },
    { id: 'CVE-2024-22024', severity: 'HIGH', affected: 'Ivanti Connect Secure', description: 'XML external entity vulnerability' },
    { id: 'CVE-2023-23397', severity: 'HIGH', affected: 'Microsoft Outlook', description: 'NTLM hash theft vulnerability' },
  ],
};

const cache = { timestamp: null, data: null };

export async function getAllThreatFeeds() {
  const now = Date.now();
  if (cache.data && cache.timestamp && now - cache.timestamp < 3600000) {
    return cache.data;
  }

  const data = JSON.parse(JSON.stringify(SAMPLE_FEEDS));
  cache.data = data;
  cache.timestamp = now;
  logger.info('[threatFeedService] Threat feeds loaded from local sample data');
  return data;
}

export async function getPhishingDomains() {
  const feeds = await getAllThreatFeeds();
  return feeds.phishingDomains || [];
}

export async function getMalwareHashes() {
  const feeds = await getAllThreatFeeds();
  return feeds.malwareHashes || [];
}

export async function getSuspiciousIps() {
  const feeds = await getAllThreatFeeds();
  return feeds.suspiciousIps || [];
}

export async function getCVEReferences() {
  const feeds = await getAllThreatFeeds();
  return feeds.cveReferences || [];
}

export async function normalizeThreat(rawThreat) {
  if (!rawThreat || typeof rawThreat !== 'object') return null;

  const normalized = {
    id: rawThreat.id || rawThreat.hash || rawThreat.domain || rawThreat.ip || `unknown-${Date.now()}`,
    category: rawThreat.category || rawThreat.type || 'unknown',
    severity: rawThreat.severity || 'unknown',
    reportedAt: rawThreat.reportedAt || new Date().toISOString(),
    details: rawThreat.description || rawThreat.reason || rawThreat.family || '',
    affected: rawThreat.affected || rawThreat.country || '',
    source: rawThreat.source || 'threatIntelFeed',
  };

  return normalized;
}

export async function refreshCache() {
  cache.timestamp = null;
  cache.data = null;
  await getAllThreatFeeds();
  logger.info('[threatFeedService] Cache refreshed');
}

export default { getAllThreatFeeds, getPhishingDomains, getMalwareHashes, getSuspiciousIps, getCVEReferences, normalizeThreat, refreshCache };
