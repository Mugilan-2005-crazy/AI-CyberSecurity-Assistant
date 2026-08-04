import ScanHistory from '../../models/ScanHistory.js';
import SecurityIncident from '../../models/SecurityIncident.js';
import logger from '../../utils/logger.js';

export async function getSocMetrics(userId) {
  try {
    const totalScans = await ScanHistory.countDocuments(userId ? { user: userId } : {});
    const threatsDetected = await ScanHistory.countDocuments({
      ...(userId ? { user: userId } : {}),
      verdict: { $in: ['malicious', 'suspicious'] },
    });
    const criticalIncidents = await SecurityIncident.countDocuments({
      severity: 'Critical',
      status: { $ne: 'closed' },
    });
    const openIncidents = await SecurityIncident.countDocuments({ status: 'open' });
    const resolvedIncidents = await SecurityIncident.countDocuments({ status: 'resolved' });

    const riskTrend = await ScanHistory.aggregate([
      ...(userId ? [{ $match: { user: userId } }] : []),
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          totalScans: { $sum: 1 },
          threats: { $sum: { $cond: [{ $in: ['$verdict', ['malicious', 'suspicious']] }, 1, 0] } },
          avgRiskScore: { $avg: '$riskScore' },
        },
      },
      { $sort: { _id: 1 } },
      { $limit: 30 },
    ]);

    const threatCategories = await ScanHistory.aggregate([
      ...(userId ? [{ $match: { user: userId } }] : []),
      { $group: { _id: '$type', count: { $sum: 1 } } },
    ]);

    const verdictDistribution = await ScanHistory.aggregate([
      ...(userId ? [{ $match: { user: userId } }] : []),
      { $group: { _id: '$verdict', count: { $sum: 1 } } },
    ]);

    const result = {
      totalScans,
      threatsDetected,
      criticalIncidents,
      openIncidents,
      resolvedIncidents,
      riskTrend,
      threatCategories,
      verdictDistribution,
    };

    logger.info('[socAnalytics] Metrics calculated', { userId: userId || 'global', totalScans });

    return result;
  } catch (err) {
    logger.error('[socAnalytics] Failed to calculate metrics', { error: err.message });
    return {
      totalScans: 0,
      threatsDetected: 0,
      criticalIncidents: 0,
      openIncidents: 0,
      resolvedIncidents: 0,
      riskTrend: [],
      threatCategories: [],
      verdictDistribution: [],
    };
  }
}

export async function getTopThreats(limit = 10) {
  try {
    const topThreats = await ScanHistory.aggregate([
      { $match: { verdict: { $in: ['malicious', 'suspicious'] } } },
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
          avgRiskScore: { $avg: '$riskScore' },
          maxRiskScore: { $max: '$riskScore' },
        },
      },
      { $sort: { count: -1, avgRiskScore: -1 } },
      { $limit: limit },
    ]);

    return topThreats.map((t) => ({
      type: t._id,
      count: t.count,
      avgRiskScore: Math.round(t.avgRiskScore || 0),
      maxRiskScore: t.maxRiskScore || 0,
    }));
  } catch (err) {
    logger.error('[socAnalytics] Failed to get top threats', { error: err.message });
    return [];
  }
}

export async function getRecentIncidents(limit = 10) {
  try {
    const incidents = await SecurityIncident.find()
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('userId', 'name email');

    return incidents.map((inc) => ({
      id: inc._id,
      userId: inc.userId,
      threatType: inc.threatType,
      mitreTechnique: inc.mitreTechnique,
      severity: inc.severity,
      status: inc.status,
      createdAt: inc.createdAt,
      resolvedAt: inc.resolvedAt,
    }));
  } catch (err) {
    logger.error('[socAnalytics] Failed to get recent incidents', { error: err.message });
    return [];
  }
}

export async function getRiskTrend(userId, days = 30) {
  try {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const trend = await ScanHistory.aggregate([
      ...(userId ? [{ $match: { user: userId } }] : []),
      { $match: { createdAt: { $gte: cutoff } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
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
  } catch (err) {
    logger.error('[socAnalytics] Failed to get risk trend', { error: err.message });
    return [];
  }
}

export default { getSocMetrics, getTopThreats, getRecentIncidents, getRiskTrend };