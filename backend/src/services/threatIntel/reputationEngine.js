import logger from '../../utils/logger.js';
import { mapThreatToMITRE } from '../security/mitre/mitreMapper.js';

export function calculateReputation(providerResults) {
  const validResults = (providerResults || []).filter((r) => r && r.success && typeof r.reputation === 'number');
  if (validResults.length === 0) return { score: 0, classification: 'unknown', confidence: 0 };

  const weightedSum = validResults.reduce((acc, r, i) => {
    const weight = 1 / (i + 1);
    return acc + (r.reputation || 0) * weight;
  }, 0);
  const totalWeight = validResults.reduce((acc, _, i) => acc + 1 / (i + 1), 0);
  const score = Math.round(weightedSum / totalWeight);

  let classification = 'unknown';
  const maliciousCount = validResults.filter((r) => r.classification === 'malicious').length;
  const suspiciousCount = validResults.filter((r) => r.classification === 'suspicious').length;

  if (maliciousCount > 0 && maliciousCount >= Math.ceil(validResults.length / 2)) {
    classification = 'malicious';
  } else if (maliciousCount > 0) {
    classification = 'suspicious';
  } else if (suspiciousCount > 0) {
    classification = 'suspicious';
  } else if (validResults.every((r) => r.classification === 'clean')) {
    classification = 'clean';
  } else {
    classification = 'unknown';
  }

  const confidence = Math.min(100, Math.round((validResults.length / Math.max(1, providerResults.length)) * 100));

  return { score: Math.max(0, Math.min(100, score)), classification, confidence };
}

export function classifyIoc(score) {
  if (score >= 80) return 'malicious';
  if (score >= 40) return 'suspicious';
  if (score >= 1) return 'clean';
  return 'unknown';
}

export function extractThreatCategory(providerResults) {
  const categories = (providerResults || [])
    .filter((r) => r && r.success && r.threatCategory)
    .map((r) => r.threatCategory)
    .filter((c) => c !== 'unknown' && c !== 'benign' && c !== 'clean');

  if (categories.length === 0) return 'unknown';

  const counts = {};
  for (const cat of categories) {
    counts[cat] = (counts[cat] || 0) + 1;
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

export function extractMalwareInfo(providerResults) {
  const malwareInfos = (providerResults || [])
    .filter((r) => r && r.success && r.malwareInfo)
    .map((r) => r.malwareInfo)
    .filter(Boolean);

  if (malwareInfos.length === 0) return null;

  const merged = {
    isMalware: malwareInfos.some((m) => m.isMalware),
    family: malwareInfos
      .map((m) => m.family)
      .filter(Boolean)
      .join(', ') || '',
    type: malwareInfos
      .map((m) => m.type)
      .filter(Boolean)
      .join(', ') || '',
    names: Array.from(new Set(malwareInfos.flatMap((m) => m.names || []))),
  };

  return merged.isMalware || merged.family ? merged : null;
}

export function extractRelatedCves(providerResults) {
  const cveSets = (providerResults || [])
    .filter((r) => r && r.success && Array.isArray(r.cves))
    .map((r) => r.cves)
    .flat();

  const seen = new Set();
  const unique = [];
  for (const cve of cveSets) {
    const id = cve.id || cve;
    if (!seen.has(id)) {
      seen.add(id);
      unique.push(typeof cve === 'string' ? { id: cve } : cve);
    }
  }

  return unique;
}

export function extractMitreTechniques(providerResults, ioc, iocType) {
  const directTechniques = (providerResults || [])
    .filter((r) => r && r.success && Array.isArray(r.mitreTechniques))
    .map((r) => r.mitreTechniques)
    .flat()
    .filter(Boolean);

  if (directTechniques.length > 0) return directTechniques;

  const mapped = mapThreatToMITRE({
    threats: [{ threat: `${iocType} IOC: ${ioc}`, type: iocType }],
    overallRiskScore: 50,
  });

  return mapped.mitreMatches || [];
}

export function generateAttackTimeline(providerResults) {
  const timelines = (providerResults || [])
    .filter((r) => r && r.success && Array.isArray(r.attackTimeline))
    .map((r) => r.attackTimeline)
    .flat()
    .filter(Boolean);

  const sorted = timelines
    .sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0))
    .map((t) => ({
      date: t.date ? new Date(t.date) : new Date(),
      event: t.event || 'Threat activity detected',
      description: t.description || '',
      source: t.source || 'threat-intel',
    }));

  return sorted;
}

export function buildCorrelation(providerResults, ioc, iocType) {
  const { score, classification, confidence } = calculateReputation(providerResults);
  const threatCategory = extractThreatCategory(providerResults);
  const malwareInfo = extractMalwareInfo(providerResults);
  const relatedCves = extractRelatedCves(providerResults);
  const mitreTechniques = extractMitreTechniques(providerResults, ioc, iocType);
  const attackTimeline = generateAttackTimeline(providerResults);

  const threatPriority = score >= 80 ? 'Critical' : score >= 50 ? 'High' : score >= 25 ? 'Medium' : score > 0 ? 'Low' : 'Unknown';
  const recommendedResponse = score >= 80 ? 'immediate_block' : score >= 50 ? 'investigate_block' : score >= 25 ? 'monitor' : 'allow_pass';

  const correlation = {
    reputationScore: score,
    confidence,
    threatPriority,
    recommendedResponse,
    classification,
    threatCategory,
    malwareInfo,
    relatedCves,
    mitreTechniques,
    attackTimeline,
    providerCount: providerResults.length,
    successCount: providerResults.filter((r) => r.success).length,
    providerResults,
  };

  logger.info('[reputationEngine] Correlation built', {
    ioc,
    iocType,
    score,
    classification,
    threatCategory,
    cveCount: relatedCves.length,
    mitreCount: mitreTechniques.length,
    timelineEvents: attackTimeline.length,
  });

  return correlation;
}

export default { calculateReputation, classifyIoc, extractThreatCategory, extractMalwareInfo, extractRelatedCves, extractMitreTechniques, generateAttackTimeline, buildCorrelation };
