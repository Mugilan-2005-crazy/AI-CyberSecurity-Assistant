import ApiError from '../utils/ApiError.js';
import logger from '../utils/logger.js';
import { getUserRiskRanking as getRiskRankingService, getOverallRiskMetrics, calculateRiskScore, updateUserRiskScore } from '../services/ueba/riskScoring.js';
import { getUserRiskEvents, resolveRiskEvent, runDetectionOnUser, evaluateUserActivity } from '../services/ueba/uebaEngine.js';
import { getRecentActivity, recalculateBaseline } from '../services/ueba/behaviorService.js';
import UserBehaviorProfile from '../models/UserBehaviorProfile.js';
import UserRiskEvent from '../models/UserRiskEvent.js';
import User from '../models/User.js';

export const getUebaDashboard = async (req, res, next) => {
  try {
    const metrics = await getOverallRiskMetrics();
    const ranking = await getUserRiskRanking(20);

    res.json({ success: true, data: { metrics, riskRanking: ranking } });
  } catch (err) {
    logger.error('[uebaController] getUebaDashboard failed', { error: err.message });
    next(err);
  }
};

export const getUserRiskRanking = async (req, res, next) => {
  try {
    const { limit = 50 } = req.query;
    const ranking = await getRiskRankingService(Number(limit));
    res.json({ success: true, data: ranking });
  } catch (err) {
    logger.error('[uebaController] getUserRiskRanking failed', { error: err.message });
    next(err);
  }
};

export const getUserProfile = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const profile = await UserBehaviorProfile.findOne({ userId }).lean();
    if (!profile) {
      const user = await User.findById(userId).select('name email role createdAt');
      if (!user) throw new ApiError(404, 'User not found');
      return res.json({ success: true, data: { userId: user._id, userName: user.name, userEmail: user.email, userRole: user.role, createdAt: user.createdAt, riskScore: 0, riskLevel: 'Low', baseline: {}, knownLocations: [], knownDevices: [], activityHistory: [] } });
    }

    res.json({
      success: true,
      data: {
        userId: profile.userId,
        userName: profile.userId && typeof profile.userId === 'object' ? profile.userId.name : undefined,
        riskScore: profile.riskScore,
        riskLevel: profile.riskLevel,
        averageRisk: profile.averageRisk,
        anomalyCount: profile.anomalyCount,
        highRiskAnomalyCount: profile.highRiskAnomalyCount,
        knownLocations: profile.knownLocations,
        knownDevices: profile.knownDevices,
        knownIps: profile.knownIps,
        baseline: profile.baseline,
        lastUpdated: profile.lastUpdated,
        recentActivity: (profile.activityHistory || []).slice(-30),
      },
    });
  } catch (err) {
    logger.error('[uebaController] getUserProfile failed', { error: err.message });
    next(err);
  }
};

export const getUserTimeline = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { days = 7, limit = 100 } = req.query;

    const activity = await getRecentActivity(userId, Number(days), Number(limit));
    const timeline = activity.map((a) => ({
      id: a._id,
      eventType: a.eventType,
      category: a.category,
      description: a.description,
      details: a.details,
      riskScore: a.riskScore,
      anomalyMatched: a.anomalyMatched,
      timestamp: a.timestamp || a.createdAt,
    }));

    res.json({ success: true, data: timeline });
  } catch (err) {
    logger.error('[uebaController] getUserTimeline failed', { error: err.message });
    next(err);
  }
};

export const getUserAnomalies = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { status, severity, page = 1, limit = 50 } = req.query;

    const result = await getUserRiskEvents(userId, { status, severity, page: Number(page), limit: Number(limit) });
    res.json({ success: true, data: result });
  } catch (err) {
    logger.error('[uebaController] getUserAnomalies failed', { error: err.message });
    next(err);
  }
};

export const getAnomalyDetail = async (req, res, next) => {
  try {
    const { id } = req.params;
    const event = await UserRiskEvent.findById(id).populate('userId', 'name email role').populate('relatedAlert').lean();
    if (!event) throw new ApiError(404, 'Anomaly event not found');

    if (req.user.role === 'user' && event.userId._id.toString() !== req.user.id) {
      throw new ApiError(403, 'Not authorized to view this anomaly');
    }

    res.json({ success: true, data: serializeRiskEvent(event) });
  } catch (err) {
    logger.error('[uebaController] getAnomalyDetail failed', { error: err.message });
    next(err);
  }
};

export const getMyAnomalies = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { status, severity, page = 1, limit = 50 } = req.query;
    const result = await getUserRiskEvents(userId, { status, severity, page: Number(page), limit: Number(limit) });
    res.json({ success: true, data: result });
  } catch (err) {
    logger.error('[uebaController] getMyAnomalies failed', { error: err.message });
    next(err);
  }
};

export const getMyProfile = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const profile = await UserBehaviorProfile.findOne({ userId: userId }).lean();
    const user = await User.findById(userId).select('name email role');
    res.json({
      success: true,
      data: {
        userId,
        userName: user?.name,
        userEmail: user?.email,
        userRole: user?.role,
        riskScore: profile?.riskScore || 0,
        riskLevel: profile?.riskLevel || 'Low',
        averageRisk: profile?.averageRisk || 0,
        anomalyCount: profile?.anomalyCount || 0,
        highRiskAnomalyCount: profile?.highRiskAnomalyCount || 0,
        knownLocations: profile?.knownLocations || [],
        knownDevices: profile?.knownDevices || [],
        baseline: profile?.baseline || {},
        lastUpdated: profile?.lastUpdated,
      },
    });
  } catch (err) {
    logger.error('[uebaController] getMyProfile failed', { error: err.message });
    next(err);
  }
};

export const runDetection = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const result = await runDetectionOnUser(userId);
    res.json({ success: true, data: result });
  } catch (err) {
    logger.error('[uebaController] runDetection failed', { error: err.message });
    next(err);
  }
};

export const runMyDetection = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const result = await runDetectionOnUser(userId);
    res.json({ success: true, data: result });
  } catch (err) {
    logger.error('[uebaController] runMyDetection failed', { error: err.message });
    next(err);
  }
};

export const resolveAnomaly = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const userId = req.user.role === 'admin' || req.user.role === 'security_manager' ? undefined : req.user.id;

    const event = await resolveRiskEvent(id, userId, status || 'resolved');
    if (!event) throw new ApiError(404, 'Anomaly event not found');
    res.json({ success: true, data: serializeRiskEvent(event), message: 'Anomaly resolved' });
  } catch (err) {
    logger.error('[uebaController] resolveAnomaly failed', { error: err.message });
    next(err);
  }
};

export const getMyRiskScore = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const profile = await UserBehaviorProfile.findOne({ userId }).lean();
    res.json({ success: true, data: { riskScore: profile?.riskScore || 0, riskLevel: profile?.riskLevel || 'Low', averageRisk: profile?.averageRisk || 0, anomalyCount: profile?.anomalyCount || 0, highRiskAnomalyCount: profile?.highRiskAnomalyCount || 0, lastUpdated: profile?.lastUpdated } });
  } catch (err) {
    logger.error('[uebaController] getMyRiskScore failed', { error: err.message });
    next(err);
  }
};

export const getMyTimeline = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { days = 7, limit = 100 } = req.query;
    const activity = await getRecentActivity(userId, Number(days), Number(limit));
    const timeline = activity.map((a) => ({
      id: a._id,
      eventType: a.eventType,
      category: a.category,
      description: a.description,
      details: a.details,
      riskScore: a.riskScore,
      anomalyMatched: a.anomalyMatched,
      timestamp: a.timestamp || a.createdAt,
    }));
    res.json({ success: true, data: timeline });
  } catch (err) {
    logger.error('[uebaController] getMyTimeline failed', { error: err.message });
    next(err);
  }
};

export const getRiskTrend = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { days = 30 } = req.query;
    const cutoff = new Date(Date.now() - Number(days) * 24 * 60 * 60 * 1000);

    const events = await UserRiskEvent.find({ userId, createdAt: { $gte: cutoff } })
      .sort({ createdAt: 1 })
      .select('riskScore severity createdAt')
      .lean();

    const trend = events.map((e) => ({
      date: new Date(e.createdAt).toISOString().slice(0, 10),
      riskScore: e.riskScore,
      severity: e.severity,
    }));

    res.json({ success: true, data: trend });
  } catch (err) {
    logger.error('[uebaController] getRiskTrend failed', { error: err.message });
    next(err);
  }
};

function serializeRiskEvent(event) {
  return {
    id: event._id,
    userId: event.userId,
    eventType: event.eventType,
    detectionType: event.detectionType,
    severity: event.severity,
    riskScore: event.riskScore,
    title: event.title,
    description: event.description,
    details: event.details,
    detections: event.detections,
    aiExplanation: event.aiExplanation,
    status: event.status,
    createdAt: event.createdAt,
    resolvedAt: event.resolvedAt,
  };
}

export default {
  getUebaDashboard,
  getUserRiskRanking,
  getUserProfile,
  getUserTimeline,
  getUserAnomalies,
  getAnomalyDetail,
  getMyAnomalies,
  getMyProfile,
  runDetection,
  runMyDetection,
  resolveAnomaly,
  getMyRiskScore,
  getRiskTrend,
  getMyTimeline,
};
