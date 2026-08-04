import UserBehaviorProfile from '../../models/UserBehaviorProfile.js';
import UserRiskEvent from '../../models/UserRiskEvent.js';
import logger from '../../utils/logger.js';

export const RISK_LEVELS = {
  LOW: { min: 0, max: 30, label: 'Low' },
  MEDIUM: { min: 31, max: 60, label: 'Medium' },
  HIGH: { min: 61, max: 80, label: 'High' },
  CRITICAL: { min: 81, max: 100, label: 'Critical' },
};

export function getRiskLevel(score) {
  const s = Math.min(100, Math.max(0, Math.round(score)));
  if (s >= 81) return 'Critical';
  if (s >= 61) return 'High';
  if (s >= 31) return 'Medium';
  return 'Low';
}

export function getRiskColor(score) {
  const level = getRiskLevel(score);
  if (level === 'Critical') return '#ef4444';
  if (level === 'High') return '#f97316';
  if (level === 'Medium') return '#f59e0b';
  return '#10b981';
}

const RISK_WEIGHTS = {
  loginAnomaly: 0.15,
  deviceAnomaly: 0.12,
  locationAnomaly: 0.12,
  failedAttempts: 0.15,
  threatIntelMatch: 0.12,
  graphRisk: 0.10,
  pastIncidents: 0.10,
  abnormalActivity: 0.08,
  accountTakeover: 0.06,
};

export async function calculateRiskScore(userId, factors = {}) {
  try {
    const {
      loginAnomaly = 0,
      deviceAnomaly = 0,
      locationAnomaly = 0,
      failedAttempts = 0,
      threatIntelMatch = 0,
      graphRisk = 0,
      pastIncidents = 0,
      abnormalActivity = 0,
      accountTakeover = 0,
      profile,
    } = factors;

    let score = 0;

    score += (loginAnomaly / 100) * RISK_WEIGHTS.loginAnomaly * 100;
    score += (deviceAnomaly / 100) * RISK_WEIGHTS.deviceAnomaly * 100;
    score += (locationAnomaly / 100) * RISK_WEIGHTS.locationAnomaly * 100;

    const failedScore = Math.min(100, failedAttempts * 20);
    score += (failedScore / 100) * RISK_WEIGHTS.failedAttempts * 100;

    score += (threatIntelMatch / 100) * RISK_WEIGHTS.threatIntelMatch * 100;
    score += (graphRisk / 100) * RISK_WEIGHTS.graphRisk * 100;
    score += (pastIncidents / 100) * RISK_WEIGHTS.pastIncidents * 100;
    score += (abnormalActivity / 100) * RISK_WEIGHTS.abnormalActivity * 100;
    score += (accountTakeover / 100) * RISK_WEIGHTS.accountTakeover * 100;

    if (profile) {
      const avg = profile.averageRisk || 0;
      score = score * 0.7 + avg * 0.3;
    }

    score = Math.min(100, Math.max(0, Math.round(score)));
    const riskLevel = getRiskLevel(score);

    await UserBehaviorProfile.findOneAndUpdate(
      { userId: userId },
      { $set: { averageRisk: score, riskScore: score, riskLevel: riskLevel, lastUpdated: new Date() } },
      { upsert: true, new: true }
    );

    logger.info('[riskScoring] Risk score calculated', { userId, score, riskLevel });

    return { score, riskLevel };
  } catch (err) {
    logger.error('[riskScoring] Calculate risk score failed', { error: err.message, userId });
    return { score: 0, riskLevel: 'Low' };
  }
}

export async function updateUserRiskScore(userId, score, reason = '') {
  try {
    const riskLevel = getRiskLevel(score);
    const profile = await UserBehaviorProfile.findOneAndUpdate(
      { userId: userId },
      {
        $set: { riskScore: score, riskLevel, averageRisk: score, lastUpdated: new Date() },
        $inc: {
          ...(reason === 'anomaly' ? { anomalyCount: 1 } : {}),
          ...(reason === 'high_risk_anomaly' ? { highRiskAnomalyCount: 1 } : {}),
        },
      },
      { upsert: true, new: true }
    );

    const existingEvents = await UserRiskEvent.countDocuments({
      userId,
      severity: { $in: ['High', 'Critical'] },
      status: 'active',
    });

    return { profile, riskLevel, activeHighRiskEvents: existingEvents };
  } catch (err) {
    logger.error('[riskScoring] Update user risk score failed', { error: err.message, userId });
    return { profile: null, riskLevel: getRiskLevel(score), activeHighRiskEvents: 0 };
  }
}

export async function getUserRiskRanking(limit = 50) {
  try {
    const profiles = await UserBehaviorProfile.find({ isActive: true })
      .sort({ riskScore: -1 })
      .limit(limit)
      .populate('userId', 'name email role')
      .lean();

    return profiles.map((p) => ({
      userId: p.userId?._id,
      userName: p.userId?.name,
      userEmail: p.userId?.email,
      userRole: p.userId?.role,
      riskScore: p.riskScore,
      riskLevel: p.riskLevel,
      averageRisk: p.averageRisk,
      anomalyCount: p.anomalyCount,
      highRiskAnomalyCount: p.highRiskAnomalyCount,
      knownLocations: p.knownLocations,
      knownDevices: p.knownDevices,
      lastUpdated: p.lastUpdated,
    }));
  } catch (err) {
    logger.error('[riskScoring] Get user risk ranking failed', { error: err.message });
    return [];
  }
}

export async function getOverallRiskMetrics() {
  try {
    const profiles = await UserBehaviorProfile.find({}).select('riskScore riskLevel averageRisk anomalyCount highRiskAnomalyCount');
    const totalUsers = profiles.length;
    const avgRisk = totalUsers > 0 ? Math.round(profiles.reduce((s, p) => s + p.riskScore, 0) / totalUsers) : 0;
    const distribution = {
      Low: profiles.filter((p) => p.riskLevel === 'Low').length,
      Medium: profiles.filter((p) => p.riskLevel === 'Medium').length,
      High: profiles.filter((p) => p.riskLevel === 'High').length,
      Critical: profiles.filter((p) => p.riskLevel === 'Critical').length,
    };
    const totalActiveEvents = await UserRiskEvent.countDocuments({ status: 'active' });
    const totalCriticalEvents = await UserRiskEvent.countDocuments({ severity: 'Critical', status: 'active' });

    return {
      totalUsers,
      averageRisk: avgRisk,
      overallRiskLevel: getRiskLevel(avgRisk),
      distribution,
      totalActiveEvents,
      totalCriticalEvents,
      totalAnomalies: profiles.reduce((s, p) => s + (p.anomalyCount || 0), 0),
    };
  } catch (err) {
    logger.error('[riskScoring] Get overall risk metrics failed', { error: err.message });
    return { totalUsers: 0, averageRisk: 0, overallRiskLevel: 'Low', distribution: {}, totalActiveEvents: 0, totalCriticalEvents: 0, totalAnomalies: 0 };
  }
}

export function calculateCompositeRisk(details) {
  return details.reduce((sum, d) => sum + (d.score || 0) * (d.weight || 1), 0);
}

export { RISK_WEIGHTS };

export default {
  getRiskLevel,
  getRiskColor,
  calculateRiskScore,
  updateUserRiskScore,
  getUserRiskRanking,
  getOverallRiskMetrics,
  calculateCompositeRisk,
};
