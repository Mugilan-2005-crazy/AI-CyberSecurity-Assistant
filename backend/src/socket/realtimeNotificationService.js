/**
 * socket/realtimeNotificationService.js
 * ------------------------------------------------------------
 * Bridges existing business logic (scanService, socAnalyzer,
 * threatIntelService, incidentTracker) with real-time Socket.IO
 * event emission. Each function corresponds to a domain event.
 *
 * This service is the single entry point for emitting real-time
 * events — all other services call into it rather than touching
 * `globalThis.io` directly.
 */
import logger from '../utils/logger.js';
import { EVENTS } from './socketEvents.js';
import { getIoInstance } from './socketServer.js';
import { dispatchToUser } from './eventDispatcher.js';
import Notification from '../models/Notification.js';

export async function emitScanStarted(userId, scanId, scanType, input) {
  const io = getIoInstance();
  if (!io) return;
  dispatchToUser(io, userId, EVENTS.SCAN_STARTED, { scanId, scanType, input }, { dedupe: true });
  logger.debug('[realtimeNotificationService] Scan started', { userId, scanId, scanType });
}

export async function emitScanProgress(userId, scanId, percent, message) {
  const io = getIoInstance();
  if (!io) return;
  dispatchToUser(io, userId, EVENTS.SCAN_PROGRESS, { scanId, percent, message }, { debounce: true });
}

export async function emitScanCompleted(userId, scanId, result) {
  const io = getIoInstance();
  if (!io) return;
  dispatchToUser(io, userId, EVENTS.SCAN_COMPLETED, { scanId, result });
  logger.debug('[realtimeNotificationService] Scan completed', { userId, scanId });
}

export async function emitScanFailed(userId, scanId, error) {
  const io = getIoInstance();
  if (!io) return;
  dispatchToUser(io, userId, EVENTS.SCAN_FAILED, { scanId, error });
  logger.warn('[realtimeNotificationService] Scan failed', { userId, scanId, error: error?.message || error });
}

export async function emitAIStarted(userId, analysisId, scanId, scanType) {
  const io = getIoInstance();
  if (!io) return;
  dispatchToUser(io, userId, EVENTS.AI_STARTED, { analysisId, scanId, scanType });
  logger.debug('[realtimeNotificationService] AI analysis started', { userId, analysisId });
}

export async function emitAIProgress(userId, analysisId, percent, stage) {
  const io = getIoInstance();
  if (!io) return;
  dispatchToUser(io, userId, EVENTS.AI_PROGRESS, { analysisId, percent, stage }, { debounce: true });
}

export async function emitAICompleted(userId, analysisId, analysis) {
  const io = getIoInstance();
  if (!io) return;
  dispatchToUser(io, userId, EVENTS.AI_COMPLETED, { analysisId, analysis });
  logger.debug('[realtimeNotificationService] AI analysis completed', { userId, analysisId });
}

export async function emitAIFailed(userId, analysisId, error) {
  const io = getIoInstance();
  if (!io) return;
  dispatchToUser(io, userId, EVENTS.AI_FAILED, { analysisId, error });
  logger.warn('[realtimeNotificationService] AI analysis failed', { userId, analysisId, error: error?.message || error });
}

export async function emitThreatAnalysisStarted(userId, ioc, iocType) {
  const io = getIoInstance();
  if (!io) return;
  dispatchToUser(io, userId, EVENTS.THREAT_ANALYSIS_STARTED, { ioc, iocType });
  logger.debug('[realtimeNotificationService] Threat analysis started', { userId, ioc: iocType === 'email' ? '[redacted]' : ioc });
}

export async function emitThreatAnalysisCompleted(userId, ioc, iocType, result) {
  const io = getIoInstance();
  if (!io) return;
  dispatchToUser(io, userId, EVENTS.THREAT_ANALYSIS_COMPLETED, { ioc, iocType, result });
  logger.debug('[realtimeNotificationService] Threat analysis completed', { userId, ioc: iocType === 'email' ? '[redacted]' : ioc });
}

export async function emitThreatFeedUpdate(io, payload) {
  if (!io) return;
  io.of('/security').emit(EVENTS.THREAT_FEED_UPDATE, payload);
  logger.debug('[realtimeNotificationService] Threat feed update broadcast', { provider: payload?.provider });
}

export async function emitIncidentCreated(userId, incident) {
  const io = getIoInstance();
  if (!io) return;
  dispatchToUser(io, userId, EVENTS.INCIDENT_CREATED, { incident });
  logger.debug('[realtimeNotificationService] Incident created', { userId, incidentId: incident?._id });
}

export async function emitIncidentUpdated(userId, incident) {
  const io = getIoInstance();
  if (!io) return;
  dispatchToUser(io, userId, EVENTS.INCIDENT_UPDATED, { incident });
  logger.debug('[realtimeNotificationService] Incident updated', { userId, incidentId: incident?._id });
}

export async function emitIncidentClosed(userId, incident) {
  const io = getIoInstance();
  if (!io) return;
  dispatchToUser(io, userId, EVENTS.INCIDENT_CLOSED, { incident });
  logger.debug('[realtimeNotificationService] Incident closed', { userId, incidentId: incident?._id });
}

export async function emitDashboardUpdate(userId, update) {
  const io = getIoInstance();
  if (!io) return;
  dispatchToUser(io, userId, EVENTS.DASHBOARD_STATS_UPDATE, update, { debounce: true });
}

export async function createNotification(userId, { title, message, type = 'info', category = 'system', severity = 'low', metadata = {} }) {
  try {
    const notification = await Notification.create({
      user: userId,
      title,
      message,
      type,
      category,
      severity,
      read: false,
      metadata,
    });

    const io = getIoInstance();
    if (io) {
      dispatchToUser(io, userId, EVENTS.NOTIFICATION_CREATED, {
        id: notification._id,
        title: notification.title,
        message: notification.message,
        type: notification.type,
        category: notification.category,
        severity: notification.severity,
        read: notification.read,
        metadata: notification.metadata,
        createdAt: notification.createdAt,
        updatedAt: notification.updatedAt,
      });

      const unreadCount = await Notification.countDocuments({ user: userId, read: false });
      dispatchToUser(io, userId, EVENTS.NOTIFICATION_UNREAD_COUNT, { count: unreadCount });
    }

    logger.info('[realtimeNotificationService] Notification created', { userId, notificationId: notification._id, category, severity });
    return notification;
  } catch (err) {
    logger.error('[realtimeNotificationService] Create notification failed', { error: err.message, userId });
    return null;
  }
}

export default {
  emitScanStarted,
  emitScanProgress,
  emitScanCompleted,
  emitScanFailed,
  emitAIStarted,
  emitAIProgress,
  emitAICompleted,
  emitAIFailed,
  emitThreatAnalysisStarted,
  emitThreatAnalysisCompleted,
  emitThreatFeedUpdate,
  emitIncidentCreated,
  emitIncidentUpdated,
  emitIncidentClosed,
  emitDashboardUpdate,
  createNotification,
};
