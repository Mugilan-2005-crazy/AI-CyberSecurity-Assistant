import { getAllThreatFeeds, getCVEReferences, refreshCache } from '../services/threatIntel/threatFeedService.js';
import { searchCVE, getRecentCVEs, getCVEById, refreshCVECache } from '../services/threatIntel/cveService.js';
import {
  analyzeIocWithIntel,
  getIocHistory,
  getIocReport,
  getThreatIntelDashboardData,
  clearIocCache,
} from '../services/threatIntel/threatIntelService.js';
import { detectIocType, validateIoc, IOC_TYPES } from '../services/threatIntel/iocAnalyzer.js';
import { correlateThreats } from '../services/threatIntel/threatCorrelation.js';
import ApiError from '../utils/ApiError.js';
import logger from '../utils/logger.js';
import { recordActivity } from '../services/ueba/behaviorService.js';

export async function getThreatFeeds(req, res, next) {
  try {
    const feeds = await getAllThreatFeeds();
    const recentCves = await getRecentCVEs(5);
    res.json({
      success: true,
      data: {
        threats: [
          ...feeds.phishingDomains,
          ...feeds.malwareHashes,
          ...feeds.suspiciousIps,
        ],
        cves: recentCves,
      },
    });
  } catch (err) {
    logger.error('[threatIntelController] Failed to get feeds', { error: err.message });
    next(err);
  }
}

export async function searchCVEController(req, res, next) {
  try {
    const { q } = req.query;
    if (!q || typeof q !== 'string') {
      throw new ApiError(400, 'Query parameter q is required');
    }
    const results = await searchCVE(q);
    res.json({ success: true, data: results });
  } catch (err) {
    logger.error('[threatIntelController] CVE search failed', { error: err.message });
    next(err);
  }
}

export async function getCVEByIdController(req, res, next) {
  try {
    const { id } = req.params;
    const cve = await getCVEById(id);
    if (!cve) {
      throw new ApiError(404, `CVE ${id} not found`);
    }
    res.json({ success: true, data: cve });
  } catch (err) {
    logger.error('[threatIntelController] CVE lookup failed', { error: err.message });
    next(err);
  }
}

export async function analyzeIOC(req, res, next) {
  try {
    const { ioc, iocType } = req.body;
    if (!ioc || typeof ioc !== 'string') {
      throw new ApiError(400, 'IOC value is required');
    }

    const userId = req.user?.id;
    const result = await analyzeIocWithIntel(ioc, iocType, userId);

    if (!result.success) {
      throw new ApiError(400, result.error || 'IOC analysis failed');
    }

    if (userId) {
      recordActivity(userId, {
        type: 'threat_investigation',
        action: `IOC lookup: ${ioc}`,
        ip: req.ip || '',
        riskScore: result.reputationScore || 0,
        metadata: { ioc, iocType, classification: result.classification, reputationScore: result.reputationScore },
      }).catch((err) => logger.warn('[ueba] IOC activity recording failed', { error: err.message }));
    }

    res.json({ success: true, data: result });
  } catch (err) {
    logger.error('[threatIntelController] IOC analysis failed', { error: err.message, ioc: req.body?.ioc });
    next(err);
  }
}

export async function getIocHistoryController(req, res, next) {
  try {
    const userId = req.user?.id;
    const { iocType, classification, page, limit, search } = req.query;
    const result = await getIocHistory(userId, { iocType, classification, page, limit, search });
    res.json({ success: true, data: result });
  } catch (err) {
    logger.error('[threatIntelController] IOC history failed', { error: err.message });
    next(err);
  }
}

export async function getIocReportController(req, res, next) {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const report = await getIocReport(id, userId);
    if (!report) {
      throw new ApiError(404, 'IOC report not found');
    }
    res.json({ success: true, data: report });
  } catch (err) {
    logger.error('[threatIntelController] IOC report failed', { error: err.message });
    next(err);
  }
}

export async function getThreatIntelDashboard(req, res, next) {
  try {
    const userId = req.user?.id;
    const data = await getThreatIntelDashboardData(userId);
    res.json({ success: true, data });
  } catch (err) {
    logger.error('[threatIntelController] Dashboard failed', { error: err.message });
    next(err);
  }
}

export async function refreshThreatIntelCache(req, res, next) {
  try {
    await Promise.all([refreshCache(), refreshCVECache()]);
    clearIocCache();
    res.json({ success: true, message: 'Threat intelligence cache refreshed' });
  } catch (err) {
    logger.error('[threatIntelController] Cache refresh failed', { error: err.message });
    next(err);
  }
}

export async function getCorrelationReport(req, res, next) {
  try {
    const { iocs } = req.body;
    if (!Array.isArray(iocs) || iocs.length === 0) {
      throw new ApiError(400, 'Array of IOCs is required');
    }

    const results = [];
    for (const ioc of iocs) {
      try {
        const result = await analyzeIocWithIntel(ioc.value || ioc.ioc, ioc.type || undefined, req.user?.id);
        if (result.success) results.push(result);
      } catch (err) {
        logger.warn('[threatIntelController] Correlation IOC failed', { error: err.message, ioc });
      }
    }

    const correlation = await correlateThreats({
      scans: results.map((r) => ({ input: r.ioc, type: r.iocType, riskScore: r.reputationScore })),
      incidents: [],
      includeMitre: true,
    });

    res.json({ success: true, data: { results, correlation } });
  } catch (err) {
    logger.error('[threatIntelController] Correlation failed', { error: err.message });
    next(err);
  }
}

export default {
  getThreatFeeds,
  searchCVEController,
  getCVEByIdController,
  analyzeIOC,
  getIocHistoryController,
  getIocReportController,
  getThreatIntelDashboard,
  refreshThreatIntelCache,
  getCorrelationReport,
  detectIocType,
  validateIoc,
  IOC_TYPES,
};
