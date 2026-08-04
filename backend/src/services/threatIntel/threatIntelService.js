import ThreatIntel from '../../models/ThreatIntel.js';
import ThreatIntelAudit from './threatIntelAudit.js';
import { analyzeIoc, detectIocType, validateIoc, IOC_TYPES } from './iocAnalyzer.js';
import { buildCorrelation } from './reputationEngine.js';
import { routeAI } from '../ai/aiRouter.js';
import cacheManager from '../cache/cacheManager.js';
import logger from '../../utils/logger.js';
import { emitThreatAnalysisStarted, emitThreatAnalysisCompleted, createNotification } from '../../socket/realtimeNotificationService.js';

const IOC_CACHE = new Map();
const IOC_CACHE_TTL = 30 * 60 * 1000;
const REDIS_CACHE_TTL = 3600;

function getIocCacheKey(ioc) {
  return ioc.toLowerCase();
}

function getCachedIocResult(ioc) {
  const key = getIocCacheKey(ioc);
  const entry = IOC_CACHE.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > IOC_CACHE_TTL) {
    IOC_CACHE.delete(key);
    return null;
  }
  return entry.result;
}

function setCachedIocResult(ioc, result) {
  const key = getIocCacheKey(ioc);
  IOC_CACHE.set(key, { result, timestamp: Date.now() });
}

async function getCachedIocResultRedis(ioc) {
  const key = `ioc:${getIocCacheKey(ioc)}`;
  const cached = await cacheManager.get(key);
  return cached;
}

async function setCachedIocResultRedis(ioc, result) {
  const key = `ioc:${getIocCacheKey(ioc)}`;
  await cacheManager.set(key, result, REDIS_CACHE_TTL);
}

export async function clearIocRedisCache() {
  await cacheManager.delPattern('ioc:*');
}

export async function analyzeIocWithIntel(ioc, iocType, userId) {
  logger.info('[threatIntelService] Starting IOC analysis', { ioc: iocType === IOC_TYPES.EMAIL ? '[redacted]' : ioc, iocType, userId });

  emitThreatAnalysisStarted(userId, ioc, iocType).catch((err) => {
    logger.warn(`[threatIntelService] Failed to emit threat.analysis.started: ${err.message}`);
  });

  const validation = validateIoc(ioc, iocType);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

   const effectiveType = validation.effectiveType || detectIocType(ioc);

   const cached = getCachedIocResult(ioc);
  if (cached) {
    logger.info('[threatIntelService] Cache hit for IOC (memory)', { ioc });
    const cacheResult = { ...cached, cached: true };
    emitThreatAnalysisCompleted(userId, ioc, effectiveType, cacheResult).catch(() => {});
    return cacheResult;
  }

  const redisCached = await getCachedIocResultRedis(ioc);
  if (redisCached) {
    logger.info('[threatIntelService] Cache hit for IOC (redis)', { ioc });
    setCachedIocResult(ioc, redisCached);
    const cacheResult = { ...redisCached, cached: true };
    emitThreatAnalysisCompleted(userId, ioc, effectiveType, cacheResult).catch(() => {});
    return cacheResult;
  }

  try {
    const analysis = await analyzeIoc(ioc, effectiveType, userId);
    if (!analysis || analysis.success === false) {
      return analysis;
    }

    const correlation = buildCorrelation(analysis.providerResults || [], ioc, effectiveType);

    const aiSummary = await generateAISummary(ioc, effectiveType, correlation, userId);

    const result = {
      success: true,
      ioc,
      iocType: effectiveType,
      reputationScore: correlation.reputationScore,
      classification: correlation.classification,
      threatCategory: correlation.threatCategory,
      threatPriority: correlation.threatPriority,
      malwareInfo: correlation.malwareInfo,
      relatedCves: correlation.relatedCves,
      mitreTechniques: correlation.mitreTechniques,
      attackTimeline: correlation.attackTimeline,
      recommendedResponse: correlation.recommendedResponse,
      providers: analysis.providers,
      successCount: correlation.successCount,
      providerCount: correlation.providerCount,
      aiSummary,
      cached: false,
    };

    await saveIocHistory(result, userId);
    setCachedIocResult(ioc, result);
    await setCachedIocResultRedis(ioc, result);

    ThreatIntelAudit.logAnalysis(ioc, effectiveType, correlation.reputationScore, correlation.classification, correlation.threatPriority, userId)
      .catch((err) => logger.warn('[threatIntelService] Audit log failed', { error: err.message }));

    emitThreatAnalysisCompleted(userId, ioc, effectiveType, result).catch(() => {});

    if (correlation.classification === 'malicious' && correlation.reputationScore >= 80) {
      createNotification(userId, {
        title: 'Malicious IOC Detected',
        message: `IOC "${ioc}" classified as ${correlation.classification} (score: ${correlation.reputationScore}/100).`,
        type: 'danger',
        category: 'ioc_alert',
        severity: 'high',
        metadata: { ioc, iocType: effectiveType, reputationScore: correlation.reputationScore },
      }).catch(() => {});
    }

    return result;
  } catch (err) {
    logger.error('[threatIntelService] IOC analysis failed', { error: err.message, ioc });
    return {
      success: false,
      error: err.message,
      ioc,
      iocType: effectiveType,
    };
  }
}

async function generateAISummary(ioc, iocType, correlation, userId) {
  try {
    const userLanguage = userId ? (await getUserLanguage(userId)) : 'en';
    const prompt = `You are a cybersecurity threat intelligence analyst. Analyze the following IOC and provide a structured response.

IOC: ${ioc}
Type: ${iocType}
Reputation Score: ${correlation.reputationScore}/100
Classification: ${correlation.classification}
Threat Category: ${correlation.threatCategory}
Threat Priority: ${correlation.threatPriority}
Malware Info: ${JSON.stringify(correlation.malwareInfo || {})}
Related CVEs: ${correlation.relatedCves?.map((c) => c.id).join(', ') || 'None'}
MITRE Techniques: ${correlation.mitreTechniques?.map((t) => t.techniqueId).join(', ') || 'None'}
Provider Results: ${correlation.providerCount} queried, ${correlation.successCount} successful

Provide:
1. Why this IOC is dangerous (2-3 sentences)
2. Attack possibility assessment (low/medium/high) with explanation
3. Immediate recommended response actions (3-5 bullet points)
4. Confidence in this assessment (0-100%)`;

    const aiResponse = await routeAI(prompt, [], userLanguage);
    return {
      response: aiResponse.response,
      provider: aiResponse.provider,
      dangerousReason: '',
      attackPossibility: '',
      recommendedResponse: '',
    };
  } catch (err) {
    logger.warn('[threatIntelService] AI summary generation failed', { error: err.message });
    return {
      response: `Analysis complete. This ${iocType} IOC (${ioc}) was checked against ${correlation.providerCount} threat intelligence providers. Reputation score: ${correlation.reputationScore}/100. Classification: ${correlation.classification}.`,
      provider: 'none',
      error: err.message,
    };
  }
}

async function getUserLanguage(userId) {
  try {
    const User = (await import('../../models/User.js')).default;
    const user = await User.findById(userId).select('language').lean();
    return user?.language || 'en';
  } catch {
    return 'en';
  }
}

async function saveIocHistory(result, userId) {
  if (!userId) return;
  try {
    await ThreatIntel.create({
      user: userId,
      ioc: result.ioc,
      iocType: result.iocType,
      reputationScore: result.reputationScore,
      classification: result.classification,
      threatCategory: result.threatCategory,
      threatPriority: result.threatPriority,
      recommendedResponse: result.recommendedResponse,
      malwareInfo: result.malwareInfo || {},
      relatedCves: result.relatedCves?.map((c) => c.id || c) || [],
      mitreTechniques: result.mitreTechniques || [],
      attackTimeline: result.attackTimeline || [],
      providers: result.providers || [],
      providerSuccess: result.providers?.reduce((acc, p) => {
        acc[p.provider] = p.success;
        return acc;
      }, {}) || {},
      aiSummary: result.aiSummary || {},
      cached: result.cached,
      cachedAt: result.cached ? new Date() : undefined,
    });
  } catch (err) {
    logger.warn('[threatIntelService] Failed to save IOC history', { error: err.message });
  }
}

export async function getIocHistory(userId, options = {}) {
  const { iocType, classification, page = 1, limit = 20, search } = options;
  const filter = { user: userId };
  if (iocType) filter.iocType = iocType;
  if (classification) filter.classification = classification;
  if (search) filter.ioc = { $regex: search, $options: 'i' };

  const [results, total] = await Promise.all([
    ThreatIntel.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * Number(limit))
      .limit(Number(limit)),
    ThreatIntel.countDocuments(filter),
  ]);

  return {
    iocs: results.map((doc) => ({
      id: doc._id,
      ioc: doc.ioc,
      iocType: doc.iocType,
      reputationScore: doc.reputationScore,
      classification: doc.classification,
      threatCategory: doc.threatCategory,
      threatPriority: doc.threatPriority,
      malwareInfo: doc.malwareInfo,
      relatedCves: doc.relatedCves,
      mitreTechniques: doc.mitreTechniques,
      attackTimeline: doc.attackTimeline,
      providers: doc.providers,
      aiSummary: doc.aiSummary,
      cached: doc.cached,
      createdAt: doc.createdAt,
    })),
    total,
    page: Number(page),
    totalPages: Math.ceil(total / Number(limit)),
  };
}

export async function getIocReport(id, userId) {
  const filter = { _id: id };
  if (userId) filter.user = userId;
  const doc = await ThreatIntel.findOne(filter);
  if (!doc) return null;
  return {
    id: doc._id,
    ioc: doc.ioc,
    iocType: doc.iocType,
    reputationScore: doc.reputationScore,
    classification: doc.classification,
    threatCategory: doc.threatCategory,
    threatPriority: doc.threatPriority,
    malwareInfo: doc.malwareInfo,
    relatedCves: doc.relatedCves,
    mitreTechniques: doc.mitreTechniques,
    attackTimeline: doc.attackTimeline,
    providers: doc.providers,
    providerSuccess: doc.providerSuccess,
    aiSummary: doc.aiSummary,
    recommendedResponse: doc.recommendedResponse,
    cached: doc.cached,
    cachedAt: doc.cachedAt,
    createdAt: doc.createdAt,
  };
}

export async function getThreatIntelDashboardData(userId) {
  const filter = userId ? { user: userId } : {};

  const [
    recentIocs,
    topThreatCategories,
    classificationStats,
    mitreDistribution,
    reputationTrend,
  ] = await Promise.all([
    ThreatIntel.find(filter).sort({ createdAt: -1 }).limit(50),
    ThreatIntel.aggregate([
      { $match: { ...filter, threatCategory: { $nin: ['unknown', 'benign', 'clean'] } } },
      { $group: { _id: '$threatCategory', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]),
    ThreatIntel.aggregate([
      { $match: filter },
      { $group: { _id: '$classification', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    ThreatIntel.aggregate([
      { $match: { ...filter, 'mitreTechniques.0': { $exists: true } } },
      { $unwind: '$mitreTechniques' },
      { $group: { _id: '$mitreTechniques.techniqueId', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]),
    ThreatIntel.aggregate([
      { $match: filter },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          total: { $sum: 1 },
          malicious: { $sum: { $cond: [{ $eq: ['$classification', 'malicious'] }, 1, 0] } },
          suspicious: { $sum: { $cond: [{ $eq: ['$classification', 'suspicious'] }, 1, 0] } },
          avgReputation: { $avg: '$reputationScore' },
        },
      },
      { $sort: { _id: 1 } },
      { $limit: 30 },
    ]),
  ]);

  const totalIocs = await ThreatIntel.countDocuments(filter);
  const avgReputation = recentIocs.length > 0
    ? Math.round(recentIocs.reduce((sum, doc) => sum + doc.reputationScore, 0) / recentIocs.length)
    : 0;

  return {
    totalIocs,
    recentIocs: recentIocs.slice(0, 10).map((doc) => ({
      id: doc._id,
      ioc: doc.ioc,
      iocType: doc.iocType,
      reputationScore: doc.reputationScore,
      classification: doc.classification,
      createdAt: doc.createdAt,
    })),
    topThreatCategories: topThreatCategories.map((t) => ({ category: t._id, count: t.count })),
    classificationStats: classificationStats.map((c) => ({ classification: c._id, count: c.count })),
    mitreDistribution: mitreDistribution.map((m) => ({ techniqueId: m._id, count: m.count })),
    reputationTrend: reputationTrend.map((t) => ({
      date: t._id,
      total: t.total,
      malicious: t.malicious,
      suspicious: t.suspicious,
      avgReputation: Math.round(t.avgReputation || 0),
    })),
    avgReputation,
    activeProviders: ['VirusTotal', 'AbuseIPDB', 'AlienVault OTX', 'NVD'],
  };
}

export function clearIocCache() {
  IOC_CACHE.clear();
  clearIocRedisCache().catch((err) => logger.warn('[threatIntelService] Redis cache clear failed', { error: err.message }));
}

export default { analyzeIocWithIntel, getIocHistory, getIocReport, getThreatIntelDashboardData, detectIocType, validateIoc, clearIocCache };
