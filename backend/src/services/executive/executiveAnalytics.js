/**
 * services/executive/executiveAnalytics.js
 * ============================================================
 * PHASE 4 — Executive Security Command Center aggregation service.
 *
 * Aggregates ONLY from existing MongoDB collections (no new collections):
 *   - ScanHistory        → KPIs, risk trends, threat categories, scan success
 *   - SecurityAlert      → active/critical/blocked alerts, peak hours
 *   - SecurityIncident   → open/resolved incidents, avg response time, MITRE
 *   - AIAnalysis         → AI analyses, avg threat score, highest risks
 *   - ThreatIntel        → IOC analyses, threat origin, IOC trend, reputation
 *   - IncidentResponse   → resolution counts, SOC efficiency, analyst productivity
 *
 * Security Score formula (0–100, higher = better posture):
 *   score = 100 - weightedPenalty
 *   weightedPenalty =
 *     0.25 * aiThreatPenalty        (avg AI threatScore / 100)
 *   + 0.20 * incidentPenalty        (open incidents capped at 20 → /20)
 *   + 0.15 * intelReputationPenalty (avg malicious+suspicious IOC reputation / 100)
 *   + 0.15 * compliancePenalty      (1 - complianceScore/100)
 *   + 0.15 * criticalAlertPenalty   (open critical+high alerts capped at 10 → /10)
 *   + 0.10 * scanFailurePenalty     (1 - scanSuccessRate)
 *
 * Grade mapping: A ≥ 80, B 65–79, C 50–64, D 35–49, F < 35.
 *
 * Caching: in-memory 60s TTL per period key. Instrumentation records
 * aggregation duration, API duration, and cache hit/miss counters.
 */
import ScanHistory from '../../models/ScanHistory.js';
import SecurityAlert from '../../models/SecurityAlert.js';
import SecurityIncident from '../../models/SecurityIncident.js';
import AIAnalysis from '../../models/AIAnalysis.js';
import ThreatIntel from '../../models/ThreatIntel.js';
import IncidentResponse from '../../models/IncidentResponse.js';
import logger from '../../utils/logger.js';

const CACHE_TTL_MS = 60 * 1000;
const cache = new Map(); // key → { expiresAt, data }
const perf = {
  cacheHits: 0,
  cacheMisses: 0,
  lastAggregationMs: 0,
  lastApiMs: 0,
  totalAggregations: 0,
};

const PERIOD_DAYS = { day: 1, week: 7, month: 30, quarter: 90 };

const gradeFor = (score) => {
  if (score >= 80) return 'A';
  if (score >= 65) return 'B';
  if (score >= 50) return 'C';
  if (score >= 35) return 'D';
  return 'F';
};

const clamp = (n, min = 0, max = 100) => Math.max(min, Math.min(max, n));

const cacheKey = (period) => `executive:${period}`;

export function getPerfMetrics() {
  return { ...perf };
}

export function recordApiTime(ms) {
  perf.lastApiMs = ms;
}

export function clearCache() {
  cache.clear();
  perf.cacheHits = 0;
  perf.cacheMisses = 0;
}

async function getKpis() {
  const [totalScans, threatsDetected, activeAlerts, criticalAlerts, openIncidents, resolvedIncidents, aiAnalyses, iocAnalyses, blockedThreats] = await Promise.all([
    ScanHistory.countDocuments({}),
    ScanHistory.countDocuments({ verdict: { $in: ['malicious', 'suspicious'] } }),
    SecurityAlert.countDocuments({ status: { $in: ['unread', 'read', 'acknowledged'] } }),
    SecurityAlert.countDocuments({ severity: { $in: ['CRITICAL', 'HIGH'] }, status: { $ne: 'resolved' } }),
    SecurityIncident.countDocuments({ status: { $in: ['open', 'in-progress'] } }),
    SecurityIncident.countDocuments({ status: 'resolved' }),
    AIAnalysis.countDocuments({ status: 'completed' }),
    ThreatIntel.countDocuments({}),
    ThreatIntel.countDocuments({ classification: { $in: ['malicious', 'suspicious'] } }),
  ]);

  // Average response time: mean of (resolvedAt - createdAt) for resolved incidents.
  const responseTimes = await SecurityIncident.aggregate([
    { $match: { status: 'resolved', resolvedAt: { $ne: null } } },
    {
      $project: {
        ms: { $subtract: ['$resolvedAt', '$createdAt'] },
      },
    },
    { $group: { _id: null, avgMs: { $avg: '$ms' }, count: { $sum: 1 } } },
  ]);
  const avgResponseMs = responseTimes[0]?.avgMs || 0;
  const avgResponseHours = avgResponseMs ? Math.round((avgResponseMs / 3600000) * 10) / 10 : 0;

  return {
    totalScans,
    threatsDetected,
    activeAlerts,
    criticalAlerts,
    openIncidents,
    resolvedIncidents,
    aiAnalyses,
    iocAnalyses,
    blockedThreats,
    avgResponseHours,
    resolvedIncidentCount: responseTimes[0]?.count || 0,
  };
}

async function getRiskTrends(period) {
  const days = PERIOD_DAYS[period] || 30;
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const format = period === 'day' ? '%Y-%m-%dT%H:00' : '%Y-%m-%d';
  const trend = await ScanHistory.aggregate([
    { $match: { createdAt: { $gte: cutoff } } },
    {
      $group: {
        _id: { $dateToString: { format, date: '$createdAt' } },
        totalScans: { $sum: 1 },
        threats: { $sum: { $cond: [{ $in: ['$verdict', ['malicious', 'suspicious']] }, 1, 0] } },
        avgRiskScore: { $avg: '$riskScore' },
      },
    },
    { $sort: { _id: 1 } },
  ]);
  return trend.map((d) => ({
    date: d._id,
    totalScans: d.totalScans,
    threats: d.threats,
    avgRiskScore: Math.round(d.avgRiskScore || 0),
  }));
}

async function getThreatCategories() {
  const categories = await ScanHistory.aggregate([
    { $match: { verdict: { $in: ['malicious', 'suspicious'] } } },
    { $group: { _id: '$type', count: { $sum: 1 }, avgRiskScore: { $avg: '$riskScore' } } },
    { $sort: { count: -1 } },
  ]);
  const labelMap = {
    url: 'Suspicious URLs',
    password: 'Credential Attacks',
    email: 'Phishing',
    file: 'Malware',
    qr: 'Malware',
  };
  return categories.map((c) => ({
    category: labelMap[c._id] || c._id,
    count: c.count,
    avgRiskScore: Math.round(c.avgRiskScore || 0),
  }));
}

async function getCountryThreats() {
  // Threat origin is derived from ThreatIntel IOC metadata (providers/ip) and
  // ScanHistory details.ip. Falls back to 'Unknown' when no geo data exists.
  const intelGeo = await ThreatIntel.aggregate([
    { $match: { classification: { $in: ['malicious', 'suspicious'] } } },
    {
      $group: {
        _id: { $ifNull: ['$metadata.country', 'Unknown'] },
        count: { $sum: 1 },
        avgReputation: { $avg: '$reputationScore' },
      },
    },
    { $sort: { count: -1 } },
    { $limit: 20 },
  ]);
  const scanGeo = await ScanHistory.aggregate([
    { $match: { verdict: { $in: ['malicious', 'suspicious'] }, 'details.country': { $ne: null } } },
    {
      $group: {
        _id: '$details.country',
        count: { $sum: 1 },
        avgReputation: { $avg: '$riskScore' },
      },
    },
    { $sort: { count: -1 } },
    { $limit: 20 },
  ]);
  const merged = new Map();
  for (const g of [...intelGeo, ...scanGeo]) {
    const key = g._id || 'Unknown';
    const existing = merged.get(key) || { country: key, count: 0, avgReputation: 0 };
    existing.count += g.count;
    existing.avgReputation = Math.max(existing.avgReputation, g.avgReputation || 0);
    merged.set(key, existing);
  }
  return Array.from(merged.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);
}

async function getAttackTrends(period) {
  const days = PERIOD_DAYS[period] || 30;
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [timeline, peakHours, iocTrend] = await Promise.all([
    ScanHistory.aggregate([
      { $match: { createdAt: { $gte: cutoff }, verdict: { $in: ['malicious', 'suspicious'] } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          attacks: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    ScanHistory.aggregate([
      { $match: { createdAt: { $gte: cutoff }, verdict: { $in: ['malicious', 'suspicious'] } } },
      {
        $group: {
          _id: { $hour: '$createdAt' },
          attacks: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    ThreatIntel.aggregate([
      { $match: { createdAt: { $gte: cutoff } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          iocs: { $sum: 1 },
          malicious: { $sum: { $cond: [{ $in: ['$classification', ['malicious', 'suspicious']] }, 1, 0] } },
        },
      },
      { $sort: { _id: 1 } },
    ]),
  ]);

  return {
    timeline: timeline.map((t) => ({ date: t._id, attacks: t.attacks })),
    peakHours: peakHours.map((h) => ({ hour: h._id, attacks: h.attacks })),
    iocTrend: iocTrend.map((t) => ({ date: t._id, iocs: t.iocs, malicious: t.malicious })),
  };
}

// Curated compliance control catalog. Coverage is derived from observed
// platform activity (scans, alerts, incidents, AI analyses, threat intel).
const COMPLIANCE_FRAMEWORKS = [
  {
    id: 'owasp',
    name: 'OWASP Top 10',
    controls: [
      { id: 'A01', name: 'Access Control', weight: 0.2 },
      { id: 'A02', name: 'Cryptographic Failures', weight: 0.15 },
      { id: 'A03', name: 'Injection', weight: 0.15 },
      { id: 'A04', name: 'Insecure Design', weight: 0.15 },
      { id: 'A05', name: 'Security Misconfiguration', weight: 0.15 },
      { id: 'A07', name: 'Identification & Auth Failures', weight: 0.2 },
    ],
  },
  {
    id: 'nist',
    name: 'NIST CSF',
    controls: [
      { id: 'ID', name: 'Identify', weight: 0.2 },
      { id: 'PR', name: 'Protect', weight: 0.2 },
      { id: 'DE', name: 'Detect', weight: 0.2 },
      { id: 'RS', name: 'Respond', weight: 0.2 },
      { id: 'RC', name: 'Recover', weight: 0.2 },
    ],
  },
  {
    id: 'iso27001',
    name: 'ISO 27001',
    controls: [
      { id: 'A.5', name: 'Organizational Controls', weight: 0.2 },
      { id: 'A.6', name: 'People Controls', weight: 0.2 },
      { id: 'A.7', name: 'Physical Controls', weight: 0.2 },
      { id: 'A.8', name: 'Technological Controls', weight: 0.4 },
    ],
  },
  {
    id: 'cis',
    name: 'CIS Controls',
    controls: [
      { id: 'CIS-1', name: 'Inventory & Control', weight: 0.2 },
      { id: 'CIS-3', name: 'Data Protection', weight: 0.2 },
      { id: 'CIS-4', name: 'Secure Configuration', weight: 0.2 },
      { id: 'CIS-6', name: 'Access Control', weight: 0.2 },
      { id: 'CIS-8', name: 'Audit Log Management', weight: 0.2 },
    ],
  },
];

async function getCompliance() {
  const [totalScans, threats, alerts, incidents, aiAnalyses, intel] = await Promise.all([
    ScanHistory.countDocuments({}),
    ScanHistory.countDocuments({ verdict: { $in: ['malicious', 'suspicious'] } }),
    SecurityAlert.countDocuments({}),
    SecurityIncident.countDocuments({}),
    AIAnalysis.countDocuments({ status: 'completed' }),
    ThreatIntel.countDocuments({}),
  ]);

  // Coverage signals (0..1) derived from observed activity.
  const signals = {
    detection: totalScans > 0 ? 1 - threats / Math.max(totalScans, 1) : 0.5,
    response: incidents > 0 ? 0.7 : 0.4,
    monitoring: alerts > 0 ? 0.8 : 0.4,
    intelligence: intel > 0 ? 0.8 : 0.4,
    ai: aiAnalyses > 0 ? 0.8 : 0.4,
    access: totalScans > 0 ? 0.7 : 0.4,
  };

  const frameworks = COMPLIANCE_FRAMEWORKS.map((fw) => {
    const controlScores = fw.controls.map((c) => {
      // Deterministic mapping of control → signal.
      const signalKey = c.id === 'A01' || c.id === 'CIS-6' ? 'access'
        : c.id === 'A02' || c.id === 'CIS-3' ? 'monitoring'
        : c.id === 'A03' || c.id === 'A04' || c.id === 'A05' ? 'detection'
        : c.id === 'A07' || c.id === 'CIS-4' ? 'access'
        : c.id === 'ID' || c.id === 'DE' ? 'detection'
        : c.id === 'PR' || c.id === 'A.8' ? 'monitoring'
        : c.id === 'RS' || c.id === 'RC' ? 'response'
        : c.id === 'CIS-8' ? 'monitoring'
        : 'intelligence';
      const score = Math.round(clamp(signals[signalKey] * 100));
      return { id: c.id, name: c.name, score, weight: c.weight };
    });
    const total = controlScores.reduce((sum, c) => sum + c.score * c.weight, 0);
    const overall = Math.round(total);
    const missing = controlScores.filter((c) => c.score < 60).map((c) => ({
      id: c.id,
      name: c.name,
      score: c.score,
      recommendation: `Strengthen ${c.name} controls to improve ${fw.name} compliance.`,
    }));
    return { id: fw.id, name: fw.name, score: overall, controls: controlScores, missing };
  });

  const overallCompliance = Math.round(frameworks.reduce((s, f) => s + f.score, 0) / frameworks.length);
  const recommendations = frameworks.flatMap((f) => f.missing.slice(0, 2).map((m) => m.recommendation)).slice(0, 6);

  return { overallCompliance, frameworks, recommendations };
}

async function getBusinessMetrics() {
  const [totalScans, threats, resolved, open, responses, aiAnalyses] = await Promise.all([
    ScanHistory.countDocuments({}),
    ScanHistory.countDocuments({ verdict: { $in: ['malicious', 'suspicious'] } }),
    SecurityIncident.countDocuments({ status: 'resolved' }),
    SecurityIncident.countDocuments({ status: { $in: ['open', 'in-progress'] } }),
    IncidentResponse.countDocuments({}),
    AIAnalysis.countDocuments({ status: 'completed' }),
  ]);

  const totalIncidents = resolved + open;
  const riskReduction = totalScans > 0 ? Math.round((1 - threats / Math.max(totalScans, 1)) * 100) : 0;
  const threatGrowth = totalScans > 0 ? Math.round((threats / Math.max(totalScans, 1)) * 100) : 0;
  const incidentResolution = totalIncidents > 0 ? Math.round((resolved / totalIncidents) * 100) : 0;
  const socEfficiency = totalIncidents > 0 ? Math.round((responses / Math.max(totalIncidents, 1)) * 100) : 0;
  const analystProductivity = Math.round(aiAnalyses / Math.max(Math.ceil(totalScans / 10), 1));

  return {
    riskReduction,
    threatGrowth,
    incidentResolution,
    socEfficiency,
    analystProductivity,
    monthlyTrend: await getRiskTrends('month'),
  };
}

async function getAiThreatScore() {
  const agg = await AIAnalysis.aggregate([
    { $match: { status: 'completed' } },
    { $group: { _id: null, avgThreatScore: { $avg: '$threatScore' }, count: { $sum: 1 } } },
  ]);
  return agg[0] || { avgThreatScore: 0, count: 0 };
}

async function getIntelReputation() {
  const agg = await ThreatIntel.aggregate([
    { $match: { classification: { $in: ['malicious', 'suspicious'] } } },
    { $group: { _id: null, avgReputation: { $avg: '$reputationScore' }, count: { $sum: 1 } } },
  ]);
  return agg[0] || { avgReputation: 0, count: 0 };
}

/**
 * Organization Security Score (0–100). See formula at top of file.
 */
export async function computeSecurityScore() {
  const [kpis, ai, intel, compliance] = await Promise.all([
    getKpis(),
    getAiThreatScore(),
    getIntelReputation(),
    getCompliance(),
  ]);

  const aiThreatPenalty = clamp((ai.avgThreatScore || 0) / 100);
  const incidentPenalty = clamp(kpis.openIncidents / 20);
  const intelReputationPenalty = clamp((intel.avgReputation || 0) / 100);
  const compliancePenalty = 1 - clamp(compliance.overallCompliance / 100);
  const criticalAlertPenalty = clamp(kpis.criticalAlerts / 10);
  const scanSuccessRate = kpis.totalScans > 0
    ? 1 - kpis.threatsDetected / Math.max(kpis.totalScans, 1)
    : 1;
  const scanFailurePenalty = 1 - clamp(scanSuccessRate);

  const weightedPenalty =
    0.25 * aiThreatPenalty +
    0.2 * incidentPenalty +
    0.15 * intelReputationPenalty +
    0.15 * compliancePenalty +
    0.15 * criticalAlertPenalty +
    0.1 * scanFailurePenalty;

  const score = Math.round(clamp(100 - weightedPenalty * 100));
  return {
    score,
    grade: gradeFor(score),
    components: {
      aiThreatScore: Math.round(ai.avgThreatScore || 0),
      activeIncidents: kpis.openIncidents,
      intelReputation: Math.round(intel.avgReputation || 0),
      complianceScore: compliance.overallCompliance,
      criticalAlerts: kpis.criticalAlerts,
      scanSuccessRate: Math.round(scanSuccessRate * 100),
    },
    weights: {
      aiThreatScore: 0.25,
      activeIncidents: 0.2,
      intelReputation: 0.15,
      complianceScore: 0.15,
      criticalAlerts: 0.15,
      scanSuccessRate: 0.1,
    },
  };
}

/**
 * Full executive summary aggregation with 60s cache + instrumentation.
 */
export async function getExecutiveSummary(period = 'month') {
  const key = cacheKey(period);
  const now = Date.now();
  const cached = cache.get(key);
  if (cached && cached.expiresAt > now) {
    perf.cacheHits += 1;
    logger.debug('[executiveAnalytics] Cache hit', { key });
    return { ...cached.data, _cache: 'hit' };
  }
  perf.cacheMisses += 1;

  const start = Date.now();
  const [kpis, riskTrends, threatCategories, countryThreats, attackTrends, compliance, businessMetrics, securityScore] = await Promise.all([
    getKpis(),
    getRiskTrends(period),
    getThreatCategories(),
    getCountryThreats(),
    getAttackTrends(period),
    getCompliance(),
    getBusinessMetrics(),
    computeSecurityScore(),
  ]);
  const aggregationMs = Date.now() - start;
  perf.lastAggregationMs = aggregationMs;
  perf.totalAggregations += 1;

  const data = {
    generatedAt: new Date().toISOString(),
    period,
    securityScore,
    kpis,
    riskTrends,
    threatCategories,
    countryThreats,
    attackTrends,
    compliance,
    businessMetrics,
  };

  cache.set(key, { expiresAt: now + CACHE_TTL_MS, data });
  logger.info('[executiveAnalytics] Summary aggregated', { period, aggregationMs, cacheSize: cache.size });
  return { ...data, _cache: 'miss' };
}

export default {
  getExecutiveSummary,
  computeSecurityScore,
  getPerfMetrics,
  clearCache,
};