import logger from '../../utils/logger.js';
import { getIoInstance } from '../../socket/socketServer.js';
import { dispatchToUser } from '../../socket/eventDispatcher.js';

const EVENTS = {
  ANOMALY_DETECTED: 'ueba.anomaly.detected',
  RISK_UPDATED: 'ueba.risk.updated',
  PROFILE_UPDATED: 'ueba.profile.updated',
};

export { EVENTS };

export async function emitAnomalyDetected(userId, anomaly) {
  const io = getIoInstance();
  if (!io) return;
  dispatchToUser(io, userId, EVENTS.ANOMALY_DETECTED, anomaly);
  logger.info('[uebaRealtime] Anomaly detected event emitted', { userId, eventType: anomaly?.eventType });
}

export async function emitRiskUpdated(userId, riskData) {
  const io = getIoInstance();
  if (!io) return;
  dispatchToUser(io, userId, EVENTS.RISK_UPDATED, riskData, { debounce: true });
  logger.debug('[uebaRealtime] Risk updated event emitted', { userId, riskScore: riskData?.riskScore });
}

export async function emitProfileUpdated(userId, profileData) {
  const io = getIoInstance();
  if (!io) return;
  dispatchToUser(io, userId, EVENTS.PROFILE_UPDATED, profileData);
  logger.debug('[uebaRealtime] Profile updated event emitted', { userId });
}

export async function dispatchUeberEvent(userId, event, payload) {
  const io = getIoInstance();
  if (!io) return;
  dispatchToUser(io, userId, event, payload);
}

export async function broadcastAnomalyToAdmins(userId, anomaly) {
  const io = getIoInstance();
  if (!io) return;
  try {
    const User = (await import('../../models/User.js')).default;
    const admins = await User.find({ role: { $in: ['admin', 'security_manager'] } }).select('_id').lean();
    for (const admin of admins) {
      dispatchToUser(io, admin._id, 'ueba.admin.anomaly.detected', { userId, ...anomaly });
    }
  } catch (err) {
    logger.warn('[uebaRealtime] Admin broadcast failed', { error: err.message });
  }
}

export default { emitAnomalyDetected, emitRiskUpdated, emitProfileUpdated, dispatchUeberEvent, EVENTS };
