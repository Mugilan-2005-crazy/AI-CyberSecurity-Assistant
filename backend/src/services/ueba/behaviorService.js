import UserBehaviorProfile from '../../models/UserBehaviorProfile.js';
import BehaviorTimeline from '../../models/BehaviorTimeline.js';
import logger from '../../utils/logger.js';

const ACTIVITY_HISTORY_LIMIT = 200;

export async function recordActivity(userId, entry) {
  try {
    const { type, action, ip, location, device, riskScore, metadata } = entry;

    await BehaviorTimeline.create({
      userId,
      eventType: type,
      category: categorize(type),
      description: action,
      details: { ip, location, device, metadata },
      riskScore: riskScore || 0,
    });

    const profile = await UserBehaviorProfile.findOneAndUpdate(
      { userId: userId },
      {
        $push: {
          activityHistory: {
            $each: [{ type, action, timestamp: new Date(), ip, location, device, riskScore: riskScore || 0, metadata: metadata || {} }],
            $slice: ACTIVITY_HISTORY_LIMIT,
          },
        },
        $addToSet: {
          ...(location ? { knownLocations: location } : {}),
          ...(device ? { knownDevices: device } : {}),
          ...(ip ? { knownIps: ip } : {}),
        },
        $set: { lastUpdated: new Date() },
      },
      { upsert: true, new: true }
    );

    await updateBaseline(profile, type, entry);

    logger.info('[behaviorService] Activity recorded', { userId, type, action });
  } catch (err) {
    logger.warn('[behaviorService] Record activity failed', { error: err.message, userId, type: entry.type });
  }
}

export async function recordCloudActivity(userId, entry) {
  try {
    const { type, action, ip, location, device, riskScore, metadata } = entry;

    await BehaviorTimeline.create({
      userId,
      eventType: type,
      category: 'cloud_activity',
      description: action,
      details: { ip, location, device, provider: metadata?.provider, resourceId: metadata?.resourceId, cloudMetadata: metadata },
      riskScore: riskScore || 0,
    });

    const profile = await UserBehaviorProfile.findOneAndUpdate(
      { userId: userId },
      {
        $push: {
          activityHistory: {
            $each: [{ type, action, timestamp: new Date(), ip, location, device, riskScore: riskScore || 0, metadata: metadata || {} }],
            $slice: ACTIVITY_HISTORY_LIMIT,
          },
        },
        $set: { lastUpdated: new Date() },
      },
      { upsert: true, new: true }
    );

    await updateBaseline(profile, type, entry);
    logger.info('[behaviorService] Cloud activity recorded', { userId, type, action });
  } catch (err) {
    logger.warn('[behaviorService] Record cloud activity failed', { error: err.message, userId, type: entry.type });
  }
}

function categorize(type) {
  const mapping = {
    login: 'authentication',
    logout: 'authentication',
    password_change: 'authentication',
    scan: 'security_activity',
    threat_investigation: 'security_activity',
    export: 'user_action',
    report_generation: 'user_action',
    graph_search: 'security_activity',
    cloud_login: 'cloud_activity',
    cloud_api_call: 'cloud_activity',
    iam_abuse: 'cloud_activity',
    privilege_escalation: 'cloud_activity',
    container_abuse: 'cloud_activity',
    service_account_abuse: 'cloud_activity',
    kubernetes_activity: 'cloud_activity',
  };
  return mapping[type] || 'user_action';
}

async function updateBaseline(profile, type, entry) {
  if (!profile) return;

  const now = new Date();
  const hour = now.getHours();
  const isBusinessHour = hour >= profile.baseline.normalLoginHours.start && hour <= profile.baseline.normalLoginHours.end;

  if (type === 'login' && entry.success !== false && entry.location) {
    const locations = new Set([...(profile.knownLocations || []), entry.location]);
    if (locations.size <= 5) {
      profile.baseline.commonLocations = Array.from(locations);
    }
  }

  if (type === 'login' && entry.device) {
    const devices = new Set([...(profile.knownDevices || []), entry.device]);
    if (devices.size <= 5) {
      profile.baseline.commonDevices = Array.from(devices);
    }
  }

  if (type === 'scan') {
    profile.baseline.typicalSecurityActions.scans = Math.round(
      (profile.baseline.typicalSecurityActions.scans * 0.9 + 1)
    );
  }

  if (type === 'graph_search') {
    profile.baseline.typicalSecurityActions.graphSearches += 1;
  }

  if (type === 'report_generation') {
    profile.baseline.typicalSecurityActions.reportGenerations += 1;
  }

  if (type === 'export') {
    profile.baseline.typicalSecurityActions.threatInvestigations = Math.min(
      profile.baseline.typicalSecurityActions.threatInvestigations + 1,
      1000
    );
  }

  if (!isBusinessHour && profile.baseline.normalLoginHours.start === 8 && profile.baseline.normalLoginHours.end === 18) {
    const recentLogins = (profile.activityHistory || []).filter((a) => a.type === 'login' && a.success !== false);
    const offHours = recentLogins.filter((l) => {
      const h = new Date(l.timestamp).getHours();
      return h < 8 || h > 18;
    });
    if (offHours.length > 0 && offHours.length / Math.max(recentLogins.length, 1) > 0.3) {
      profile.baseline.normalLoginHours.start = 6;
      profile.baseline.normalLoginHours.end = 20;
    }
  }

  await profile.save();
}

export async function getRecentActivity(userId, days = 7, limit = 100) {
  try {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    return await BehaviorTimeline.find({ userId, timestamp: { $gte: cutoff } })
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();
  } catch (err) {
    logger.warn('[behaviorService] getRecentActivity failed', { error: err.message, userId });
    return [];
  }
}

export async function getLoginHistory(userId, limit = 50) {
  try {
    return await BehaviorTimeline.find({ userId, eventType: 'login' })
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();
  } catch (err) {
    logger.warn('[behaviorService] getLoginHistory failed', { error: err.message, userId });
    return [];
  }
}

export async function getScanHistory(userId, days = 7) {
  try {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    return await BehaviorTimeline.find({ userId, eventType: 'scan', timestamp: { $gte: cutoff } })
      .sort({ timestamp: -1 })
      .lean();
  } catch (err) {
    logger.warn('[behaviorService] getScanHistory failed', { error: err.message, userId });
    return [];
  }
}

export async function recalculateBaseline(userId) {
  try {
    const profile = await UserBehaviorProfile.findOne({ userId });
    if (!profile) return null;

    const activity = profile.activityHistory || [];
    const logins = activity.filter((a) => a.type === 'login' && a.success !== false);

    const loginHours = logins.map((l) => new Date(l.timestamp).getHours());
    if (loginHours.length > 0) {
      const sorted = [...loginHours].sort((a, b) => a - b);
      const start = sorted[Math.floor(sorted.length * 0.1)] || 0;
      const end = sorted[Math.floor(sorted.length * 0.9)] || 23;
      profile.baseline.normalLoginHours = { start: Number(start), end: Number(end) };
    }

    const locations = {};
    const devices = {};
    logins.forEach((l) => {
      if (l.location) locations[l.location] = (locations[l.location] || 0) + 1;
      if (l.device) devices[l.device] = (devices[l.device] || 0) + 1;
    });

    profile.baseline.commonLocations = Object.entries(locations)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([loc]) => loc);

    profile.baseline.commonDevices = Object.entries(devices)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([dev]) => dev);

    const scans = activity.filter((a) => a.type === 'scan');
    profile.baseline.averageActivityLevel = Math.round(scans.length / Math.max(Math.ceil(activity.length / 14), 1));

    await profile.save();
    logger.info('[behaviorService] Baseline recalculated', { userId });
    return profile;
  } catch (err) {
    logger.warn('[behaviorService] Recalculate baseline failed', { error: err.message, userId });
    return null;
  }
}

export default {
  recordActivity,
  getRecentActivity,
  getLoginHistory,
  getScanHistory,
  recalculateBaseline,
};
