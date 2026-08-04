import UserBehaviorProfile from '../../models/UserBehaviorProfile.js';
import UserRiskEvent from '../../models/UserRiskEvent.js';
import BehaviorTimeline from '../../models/BehaviorTimeline.js';
import SecurityAlert from '../../models/SecurityAlert.js';
import { getRiskLevel } from './riskScoring.js';
import { generateAnomalyExplanation } from './anomalyExplanation.js';
import { dispatchUeberEvent, broadcastAnomalyToAdmins } from './uebaRealtimeService.js';
import logger from '../../utils/logger.js';

const GEOHASH_PRECISION = 2;
const SCAN_SPIKE_MULTIPLIER = 5;
const FAILED_LOGIN_WINDOW_MS = 15 * 60 * 1000;
const IMPOSSIBLE_TRAVEL_THRESHOLD_KMH = 1000;
const BASELINE_WINDOW_DAYS = 14;
const MIN_BASELINE_ACTIVITIES = 3;

export async function evaluateUserActivity(userId, activityType, activityData = {}) {
  try {
    const profile = await UserBehaviorProfile.findOne({ userId }).lean();
    if (!profile) return { anomalies: [] };

    const detectors = {
      login: () => detectLoginAnomalies(userId, activityData, profile),
      scan: () => detectScanAnomalies(userId, activityData, profile),
      threat_investigation: () => detectInvestigationAnomalies(userId, activityData, profile),
      export: () => detectExportAnomalies(userId, activityData, profile),
      password_change: () => detectPasswordChangeAnomalies(userId, activityData, profile),
    };

    const detector = detectors[activityType];
    if (!detector) return { anomalies: [] };

    const anomalies = await detector();
    return { anomalies };
  } catch (err) {
    logger.warn('[uebaEngine] evaluateUserActivity failed', { error: err.message, userId, activityType });
    return { anomalies: [] };
  }
}

async function detectLoginAnomalies(userId, loginData, profile) {
  const anomalies = [];
  const { ip, location, device } = loginData;

  const isNewDevice = device && profile.knownDevices.length > 0 && !profile.knownDevices.includes(device);
  const isNewLocation = location && profile.knownLocations.length > 0 && !profile.knownLocations.includes(location);
  const isNewIp = ip && profile.knownIps.length > 0 && !profile.knownIps.includes(ip);

  if ((isNewDevice || isNewLocation) && profile.activityHistory.filter((a) => a.type === 'login' && a.success !== false).length >= MIN_BASELINE_ACTIVITIES) {
    anomalies.push({
      eventType: 'device_anomaly',
      severity: isNewLocation ? 'High' : 'Medium',
      riskScore: isNewLocation ? 65 : 45,
      title: 'New device or location detected',
      description: `User logged in from ${isNewDevice ? 'an unknown device' : ''} ${isNewLocation ? `new location: ${location}` : ''}.`,
      details: { ip, location, device, knownDevices: profile.knownDevices, knownLocations: profile.knownLocations },
    });
  }

  const impossibleTravel = await detectImpossibleTravel(userId, ip, location);
  if (impossibleTravel) anomalies.push(impossibleTravel);

  const failedResult = await detectMultipleFailedLogins(userId);
  if (failedResult) anomalies.push(failedResult);

  return anomalies;
}

async function detectImpossibleTravel(userId, currentIp, currentLocation) {
  try {
    const recentLogins = await BehaviorTimeline.find({
      userId,
      eventType: 'login',
    })
      .sort({ timestamp: -1 })
      .limit(10)
      .lean();

    if (recentLogins.length < 2) return null;

    const prev = recentLogins.find((l) => l.details && l.details.ip && l.details.location && l !== recentLogins[0]);
    const latest = recentLogins[0];

    if (!prev || !latest) return null;
    if (!prev.details?.location || !latest.details?.location) return null;

    const timeDiff = (new Date(latest.timestamp) - new Date(prev.timestamp)) / 1000;
    if (timeDiff <= 0 || timeDiff > 3600) return null;

    const distance = geoDistance(prev.details.location, latest.details.location);
    const speed = distance / timeDiff;

    if (speed > IMPOSSIBLE_TRAVEL_THRESHOLD_KMH) {
      return {
        eventType: 'impossible_travel',
        severity: 'Critical',
        riskScore: 90,
        title: 'Impossible travel detected',
        description: `Login locations ${prev.details.location} and ${latest.details.location} are ${Math.round(distance)}km apart, travelled in ${Math.round(timeDiff / 60)} minutes (impossible).`,
        details: {
          fromLocation: prev.details.location,
          toLocation: latest.details.location,
          distanceKm: Math.round(distance),
          timeDiffSeconds: timeDiff,
          speedKmh: Math.round(speed),
        },
      };
    }
    return null;
  } catch (err) {
    logger.warn('[uebaEngine] Impossible travel detection failed', { error: err.message, userId });
    return null;
  }
}

function geoDistance(loc1, loc2) {
  const coords1 = parseLocation(loc1);
  const coords2 = parseLocation(loc2);
  if (!coords1 || !coords2) return 0;

  const R = 6371;
  const dLat = deg2rad(coords2.lat - coords1.lat);
  const dLon = deg2rad(coords2.lon - coords1.lon);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(coords1.lat)) * Math.cos(deg2rad(coords2.lat)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function parseLocation(loc) {
  if (!loc || typeof loc !== 'string') return null;
  const coordMatch = loc.match(/(-?\d+\.\d+),\s*(-?\d+\.\d+)/);
  if (coordMatch) {
    return { lat: parseFloat(coordMatch[1]), lon: parseFloat(coordMatch[2]) };
  }
  const parts = loc.split(',').map((p) => parseFloat(p.trim()));
  if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
    return { lat: parts[0], lon: parts[1] };
  }
  return null;
}

function deg2rad(deg) {
  return deg * (Math.PI / 180);
}

async function detectMultipleFailedLogins(userId) {
  try {
    const cutoff = Date.now() - FAILED_LOGIN_WINDOW_MS;
    const failedLogins = await BehaviorTimeline.find({
      userId,
      eventType: 'login',
      'details.success': false,
      timestamp: { $gte: new Date(cutoff) },
    }).lean();

    if (failedLogins.length >= 5) {
      return {
        eventType: 'multiple_failed_logins',
        severity: failedLogins.length >= 10 ? 'Critical' : failedLogins.length >= 7 ? 'High' : 'Medium',
        riskScore: Math.min(100, 50 + failedLogins.length * 5),
        title: 'Multiple failed login attempts detected',
        description: `${failedLogins.length} failed login attempts from ${new Set(failedLogins.map((f) => f.details?.ip).filter(Boolean)).size} IP(s) in the last 15 minutes.`,
        details: {
          failedCount: failedLogins.length,
          ips: [...new Set(failedLogins.map((f) => f.details?.ip).filter(Boolean))],
          windowMs: FAILED_LOGIN_WINDOW_MS,
        },
      };
    }
    return null;
  } catch (err) {
    logger.warn('[uebaEngine] Failed login detection failed', { error: err.message, userId });
    return null;
  }
}

async function detectScanAnomalies(userId, scanData, profile) {
  const anomalies = [];
  const cutoff = Date.now() - 60 * 60 * 1000;

  try {
    const recentScans = await BehaviorTimeline.find({
      userId,
      eventType: 'scan',
      timestamp: { $gte: new Date(cutoff) },
    }).lean();

    const scansThisHour = recentScans.length;
    const baselineAvg = profile.baseline.averageActivityLevel || 5;
    const hourlyBaseline = baselineAvg * 4;

    if (scansThisHour >= baselineAvg * SCAN_SPIKE_MULTIPLIER && scansThisHour >= 10) {
      anomalies.push({
        eventType: 'abnormal_scan_activity',
        severity: scansThisHour >= 100 ? 'Critical' : scansThisHour >= 50 ? 'High' : 'Medium',
        riskScore: Math.min(100, 50 + Math.floor((scansThisHour / (hourlyBaseline || 20)) * 20)),
        title: 'Abnormal scan activity detected',
        description: `User performed ${scansThisHour} scans in the last hour (baseline: ~${Math.round(hourlyBaseline)}).`,
        details: { scansThisHour, baselineAvg, hourlyBaseline, scanType: scanData.type },
      });
    }
  } catch (err) {
    logger.warn('[uebaEngine] Scan anomaly detection failed', { error: err.message, userId });
  }

  return anomalies;
}

async function detectInvestigationAnomalies(userId, investigationData, profile) {
  const anomalies = [];
  const cutoff = Date.now() - 60 * 60 * 1000;

  try {
    const recentInvestigations = await BehaviorTimeline.find({
      userId,
      eventType: 'threat_investigation',
      timestamp: { $gte: new Date(cutoff) },
    }).lean();

    const count = recentInvestigations.length;
    if (count >= 20) {
      anomalies.push({
        eventType: 'abnormal_scan_activity',
        severity: count >= 50 ? 'High' : 'Medium',
        riskScore: Math.min(100, 45 + count * 2),
        title: 'Abnormal threat investigation activity',
        description: `${count} threat investigations in the last hour.`,
        details: { count, windowHours: 1 },
      });
    }
  } catch (err) {}

  return anomalies;
}

async function detectExportAnomalies(userId, exportData, profile) {
  const anomalies = [];
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;

  try {
    const recentExports = await BehaviorTimeline.find({
      userId,
      eventType: 'export',
      timestamp: { $gte: new Date(cutoff) },
    }).lean();

    const count = recentExports.length;
    if (count >= 10) {
      anomalies.push({
        eventType: 'privilege_abuse',
        severity: count >= 30 ? 'Critical' : count >= 20 ? 'High' : 'Medium',
        riskScore: Math.min(100, 50 + count * 3),
        title: 'Excessive export activity detected',
        description: `${count} exports in the last 24 hours, which exceeds normal behavior.`,
        details: { count, windowHours: 24, exportType: exportData.exportType },
      });
    }
  } catch (err) {}

  return anomalies;
}

async function detectPasswordChangeAnomalies(userId, changeData, profile) {
  const anomalies = [];
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;

  try {
    const recentChanges = await BehaviorTimeline.find({
      userId,
      eventType: 'password_change',
      timestamp: { $gte: new Date(cutoff) },
    }).lean();

    if (recentChanges.length >= 2) {
      anomalies.push({
        eventType: 'account_takeover',
        severity: recentChanges.length >= 3 ? 'Critical' : 'High',
        riskScore: Math.min(100, 70 + recentChanges.length * 10),
        title: 'Multiple password changes detected',
        description: `${recentChanges.length} password changes in the last 24 hours.`,
        details: { count: recentChanges.length, windowHours: 24 },
      });
    }
  } catch (err) {}

  return anomalies;
}

export async function evaluateAllAnomalies(userId) {
  try {
    const profile = await UserBehaviorProfile.findOne({ userId }).lean();
    if (!profile) return { events: [], riskScore: 0, riskLevel: 'Low' };

    let allAnomalies = [];

    const loginAnomalies = await detectLoginAnomalies(userId, {}, profile);
    allAnomalies = [...allAnomalies, ...loginAnomalies];

    const impossibleTravel = await detectImpossibleTravel(userId);
    if (impossibleTravel) allAnomalies.push(impossibleTravel);

    const failedLogin = await detectMultipleFailedLogins(userId);
    if (failedLogin) allAnomalies.push(failedLogin);

    const scanAnomaly = await detectScanAnomalies(userId, {}, profile);
    allAnomalies = [...allAnomalies, ...scanAnomaly];

    const events = [];
    for (const anomaly of allAnomalies) {
      if (anomaly.eventType === 'impossible_travel' || anomaly.eventType === 'multiple_failed_logins' || anomaly.riskScore >= 60) {
        const event = await createUserRiskEvent(userId, anomaly);
        events.push(event);
      }
    }

    const { score, riskLevel } = await computeAggregateRisk(userId, profile, events);

    await dispatchUeberEvent(userId, 'ueba.risk.updated', { userId, riskScore: score, riskLevel, anomalyCount: events.length });

    return { events, riskScore: score, riskLevel, anomalyCount: allAnomalies.length };
  } catch (err) {
    logger.error('[uebaEngine] evaluateAllAnomalies failed', { error: err.message, userId });
    return { events: [], riskScore: 0, riskLevel: 'Low' };
  }
}

async function createUserRiskEvent(userId, anomaly) {
  try {
    let existing = await UserRiskEvent.findOne({
      userId,
      eventType: anomaly.eventType,
      status: { $in: ['active', 'investigating'] },
    }).sort({ createdAt: -1 });

    const explanation = await generateAnomalyExplanation({ ...anomaly, userId });

    if (existing) {
      existing.riskScore = Math.max(existing.riskScore, anomaly.riskScore);
      existing.severity = anomaly.severity;
      existing.title = anomaly.title;
      existing.description = anomaly.description;
      existing.details = { ...existing.details, ...anomaly.details };
      existing.detections = [...(existing.detections || []), { type: anomaly.eventType, description: anomaly.description, confidence: anomaly.details?.confidence || 0.8, evidence: anomaly.details }];
      existing.aiExplanation = explanation;
      await existing.save();
      await dispatchUeberEvent(userId, 'ueba.anomaly.detected', serializeEvent(existing));
      return existing;
    }

    const event = await UserRiskEvent.create({
      userId,
      eventType: anomaly.eventType,
      severity: anomaly.severity,
      riskScore: anomaly.riskScore,
      title: anomaly.title,
      description: anomaly.description,
      details: anomaly.details,
      detections: [{ type: anomaly.eventType, description: anomaly.description, confidence: anomaly.details?.confidence || 0.8, evidence: anomaly.details }],
      aiExplanation: explanation,
      status: 'active',
      profileSnapshot: {},
    });

    const existingProfile = await UserBehaviorProfile.findOne({ userId });
    const currentRisk = existingProfile?.riskScore || 0;
    const newRiskScore = Math.max(currentRisk, anomaly.riskScore);

    const profile = await UserBehaviorProfile.findOneAndUpdate(
      { userId },
      {
        $set: { riskScore: newRiskScore, riskLevel: getRiskLevel(newRiskScore), lastUpdated: new Date() },
        $inc: { anomalyCount: 1, ...(anomaly.riskScore >= 60 ? { highRiskAnomalyCount: 1 } : {}) },
        $push: {
          anomalyHistory: {
            eventType: anomaly.eventType,
            severity: anomaly.severity,
            description: anomaly.description,
            detectedAt: new Date(),
            riskEventId: event._id,
          },
          $slice: 50,
        },
      },
      { new: true }
    );

    await dispatchUeberEvent(userId, 'ueba.anomaly.detected', serializeEvent(event));
    await dispatchUeberEvent(userId, 'ueba.profile.updated', { userId, riskScore: profile?.riskScore, riskLevel: profile?.riskLevel, anomalyCount: profile?.anomalyCount });

    if (['Critical', 'High'].includes(anomaly.severity)) {
      broadcastAnomalyToAdmins(userId.toString(), serializeEvent(event)).catch((err) => logger.warn('[uebaEngine] Admin broadcast failed', { error: err.message }));
    }

    try {
      await SecurityAlert.create({
        userId,
        alertType: 'suspicious_login',
        severity: mapSeverity(anomaly.severity),
        title: `UEBA: ${anomaly.title}`,
        message: `${anomaly.description} AI explanation: ${explanation.explanation || explanation.recommendedAction || 'Investigate immediately.'}`,
        source: 'uebaEngine',
        status: 'unread',
        metadata: { riskEventId: event._id, eventType: anomaly.eventType },
      });
    } catch (alertErr) {
      logger.warn('[uebaEngine] Failed to create SecurityAlert for UEBA event', { error: alertErr.message });
    }

    logger.info('[uebaEngine] Risk event created', { userId, eventType: anomaly.eventType, riskScore: anomaly.riskScore });
    return event;
  } catch (err) {
    logger.error('[uebaEngine] createUserRiskEvent failed', { error: err.message });
    return null;
  }
}

function mapSeverity(level) {
  const map = { Critical: 'CRITICAL', High: 'HIGH', Medium: 'MEDIUM', Low: 'LOW' };
  return map[level] || 'MEDIUM';
}

function serializeEvent(event) {
  return {
    id: event._id,
    userId: event.userId,
    eventType: event.eventType,
    severity: event.severity,
    riskScore: event.riskScore,
    title: event.title,
    description: event.description,
    details: event.details,
    aiExplanation: event.aiExplanation,
    status: event.status,
    createdAt: event.createdAt,
  };
}

async function computeAggregateRisk(userId, profile, events) {
  let score = profile?.averageRisk || 0;

  for (const event of events) {
    const contribution = (event.riskScore || 0) * 0.1;
    score += contribution;
  }

  score = Math.min(100, Math.round(score));
  const riskLevel = getRiskLevel(score);

  await UserBehaviorProfile.findOneAndUpdate(
    { userId },
    { $set: { riskScore: score, riskLevel, lastUpdated: new Date() } },
    { upsert: true }
  );

  return { score, riskLevel };
}

export async function runDetectionOnUser(userId) {
  return evaluateAllAnomalies(userId);
}

export async function getUserRiskEvents(userId, options = {}) {
  try {
    const { status, severity, limit = 50, page = 1 } = options;
    const filter = { userId };
    if (status) filter.status = status;
    if (severity) filter.severity = severity;

    const events = await UserRiskEvent.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const total = await UserRiskEvent.countDocuments(filter);

    return {
      events: events.map((e) => ({
        id: e._id,
        eventType: e.eventType,
        detectionType: e.detectionType,
        severity: e.severity,
        riskScore: e.riskScore,
        title: e.title,
        description: e.description,
        details: e.details,
        detections: e.detections,
        aiExplanation: e.aiExplanation,
        status: e.status,
        createdAt: e.createdAt,
        resolvedAt: e.resolvedAt,
      })),
      total,
      page: Number(page),
      totalPages: Math.ceil(total / limit),
    };
  } catch (err) {
    logger.error('[uebaEngine] getUserRiskEvents failed', { error: err.message, userId });
    return { events: [], total: 0, page: 1, totalPages: 0 };
  }
}

export async function resolveRiskEvent(eventId, userId, status) {
  try {
    const event = await UserRiskEvent.findOne({ _id: eventId, userId });
    if (!event) return null;
    event.status = status;
    if (status === 'resolved' || status === 'dismissed') {
      event.resolvedAt = new Date();
    }
    await event.save();
    return event;
  } catch (err) {
    logger.error('[uebaEngine] resolveRiskEvent failed', { error: err.message });
    return null;
  }
}

export default {
  evaluateUserActivity,
  evaluateAllAnomalies,
  runDetectionOnUser,
  getUserRiskEvents,
  resolveRiskEvent,
};
