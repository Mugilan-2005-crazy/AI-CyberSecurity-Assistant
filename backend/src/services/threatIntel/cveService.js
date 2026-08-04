import logger from '../../utils/logger.js';
import { getCVEReferences, normalizeThreat } from './threatFeedService.js';

const LOCAL_CVE_DB = {
  'CVE-2024-21762': {
    id: 'CVE-2024-21762',
    severity: 'CRITICAL',
    cvssScore: 9.8,
    description: 'A heap-based buffer overflow in FortiOS SSL-VPN allows remote attackers to execute arbitrary code via crafted requests.',
    references: ['https://cve.mitre.org/cgi-bin/cvename.cgi?name=CVE-2024-21762'],
    publishedDate: '2024-02-09',
    affected: ['FortiOS 7.0.0 through 7.0.12', 'FortiOS 7.2.0 through 7.2.5', 'FortiOS 7.4.0 through 7.4.2'],
  },
  'CVE-2024-3400': {
    id: 'CVE-2024-3400',
    severity: 'CRITICAL',
    cvssScore: 10.0,
    description: 'Command injection vulnerability in Palo Alto Networks PAN-OS allows unauthenticated attackers to execute arbitrary commands as root.',
    references: ['https://cve.mitre.org/cgi-bin/cvename.cgi?name=CVE-2024-3400'],
    publishedDate: '2024-04-12',
    affected: ['Palo Alto Networks PAN-OS 11.0.0', 'Palo Alto Networks PAN-OS 11.0.1', 'Palo Alto Networks PAN-OS 10.1.0 - 10.2.1'],
  },
  'CVE-2024-23897': {
    id: 'CVE-2024-23897',
    severity: 'HIGH',
    cvssScore: 7.4,
    description: 'Arbitrary file read vulnerability in Jenkins CLI allows attackers to read arbitrary files on the Jenkins controller file system.',
    references: ['https://cve.mitre.org/cgi-bin/cvename.cgi?name=CVE-2024-23897'],
    publishedDate: '2024-01-24',
    affected: ['Jenkins 2.217', 'Jenkins LTS 2.222.1 - 2.426.1', 'Jenkins 2.426 - 2.440'],
  },
  'CVE-2024-22024': {
    id: 'CVE-2024-22024',
    severity: 'HIGH',
    cvssScore: 7.5,
    description: 'XML external entity (XXE) vulnerability in Ivanti Connect Secure allows remote attackers to read arbitrary files.',
    references: ['https://cve.mitre.org/cgi-bin/cvename.cgi?name=CVE-2024-22024'],
    publishedDate: '2024-01-30',
    affected: ['Ivanti Connect Secure 22.7R2', 'Ivanti Connect Secure 22.7R1.1 - 22.7R2.3', 'Policy Secure 9.1R18.1 - 9.1R18.3'],
  },
  'CVE-2023-23397': {
    id: 'CVE-2023-23397',
    severity: 'HIGH',
    cvssScore: 9.8,
    description: 'NTLM hash theft vulnerability in Microsoft Outlook via specially crafted email messages sent from an attacker-controlled server.',
    references: ['https://cve.mitre.org/cgi-bin/cvename.cgi?name=CVE-2023-23397'],
    publishedDate: '2023-03-14',
    affected: ['Microsoft Outlook 2013', 'Microsoft Outlook 2016', 'Microsoft 365'],
  },
};

let nvdCache = { timestamp: null, data: null };

export async function searchCVE(query, options = {}) {
  const { includeReferences = true, includeAffected = true } = options;

  logger.info('[cveService] Searching CVE database', { query });

  const matched = [];

  for (const [id, cve] of Object.entries(LOCAL_CVE_DB)) {
    const haystack = `${id} ${cve.description} ${cve.affected.join(' ')}`.toLowerCase();
    if (haystack.includes(query.toLowerCase())) {
      const entry = { ...cve };
      if (!includeReferences) delete entry.references;
      if (!includeAffected) delete entry.affected;
      matched.push(entry);
    }
  }

  const result = matched.sort((a, b) => (b.cvssScore || 0) - (a.cvssScore || 0));
  logger.info('[cveService] CVE search completed', { matches: result.length, query });
  return result;
}

export async function getCVEById(cveId) {
  logger.info('[cveService] Fetching CVE by ID', { cveId });
  return LOCAL_CVE_DB[cveId] || null;
}

export async function getRecentCVEs(limit = 10) {
  const refs = await getCVEReferences();
  const mapped = refs.map((r) => {
    const full = LOCAL_CVE_DB[r.id];
    return full ? full : { ...r, cvssScore: 0, description: '', references: [], affected: [] };
  });
  return mapped.slice(0, limit);
}

export async function matchAgainstThreat(threat) {
  const normalized = await normalizeThreat(threat);
  if (!normalized) return [];

  const cves = await searchCVE(normalized.details || normalized.id || normalized.category);
  return cves.map((cve) => ({
    ...cve,
    matchedFrom: normalized.id,
    matchedCategory: normalized.category,
  }));
}

export async function getCVSSSeverity(cvssScore) {
  if (cvssScore >= 9.0) return 'CRITICAL';
  if (cvssScore >= 7.0) return 'HIGH';
  if (cvssScore >= 4.0) return 'MEDIUM';
  if (cvssScore > 0) return 'LOW';
  return 'INFO';
}

export async function refreshCVECache() {
  nvdCache = { timestamp: null, data: null };
  logger.info('[cveService] CVE cache refreshed');
}

export default { searchCVE, getCVEById, getRecentCVEs, matchAgainstThreat, getCVSSSeverity, refreshCVECache };
