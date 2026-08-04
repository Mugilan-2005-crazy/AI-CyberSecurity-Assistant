/**
 * socket/socketEvents.js
 * ------------------------------------------------------------
 * Registers all Socket.IO event handlers for the /security namespace.
 * Handles connection lifecycle, heartbeat, room management, and
 * client-initiated events (acknowledge, mark read, etc.).
 */
import { verifyAccessToken } from '../utils/jwt.js';
import logger from '../utils/logger.js';
import Notification from '../models/Notification.js';
import { joinUserRoom, joinOrgRoom, leaveAllRooms, userRoom } from './roomManager.js';
import { registerConnection, unregisterConnection, updateLastSeen } from './heartbeatService.js';

const EVENTS = {
  // Connection lifecycle
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  DISCONNECT_REASON: 'disconnect',

  // Client-initiated
  JOIN: 'join',
  LEAVE: 'leave',
  PING: 'heartbeat.ping',
  PONG: 'heartbeat.pong',
  GET_UNREAD: 'notification:get_unread',
  MARK_READ: 'notification:mark_read',
  MARK_ALL_READ: 'notification:mark_all_read',
  DELETE: 'notification:delete',
  FILTER: 'notification:filter',

  // Server→Client events
  HEARTBEAT_PING: 'heartbeat.ping',
  HEARTBEAT_PONG: 'heartbeat.pong',
  OFFLINE: 'offline',
  RECONNECT: 'reconnect',

  // Scan events
  SCAN_STARTED: 'scan.started',
  SCAN_PROGRESS: 'scan.progress',
  SCAN_COMPLETED: 'scan.completed',
  SCAN_FAILED: 'scan.failed',

  // AI analysis events
  AI_STARTED: 'ai.started',
  AI_PROGRESS: 'ai.progress',
  AI_COMPLETED: 'ai.completed',
  AI_FAILED: 'ai.failed',

  // Threat intelligence events
  THREAT_ANALYSIS_STARTED: 'threat.analysis.started',
  THREAT_ANALYSIS_COMPLETED: 'threat.analysis.completed',
  THREAT_FEED_UPDATE: 'threat.feed.update',

  // Incident events
  INCIDENT_CREATED: 'incident.created',
  INCIDENT_UPDATED: 'incident.updated',
  INCIDENT_CLOSED: 'incident.closed',
  INCIDENT_REPORT_CREATED: 'incident.report.created',
  INCIDENT_REPORT_COMPLETED: 'incident.report.completed',
  INCIDENT_REPORT_SHARED: 'incident.report.shared',

  // Knowledge Graph events
  GRAPH_ENTITY_CREATED: 'graph.entity.created',
  GRAPH_RELATIONSHIP_CREATED: 'graph.relationship.created',
  GRAPH_RISK_UPDATED: 'graph.risk.updated',

  // UEBA events
  UEBA_ANOMALY_DETECTED: 'ueba.anomaly.detected',
  UEBA_RISK_UPDATED: 'ueba.risk.updated',
  UEBA_PROFILE_UPDATED: 'ueba.profile.updated',

  // Cloud security events
  CLOUD_SCAN_STARTED: 'cloud.scan.started',
  CLOUD_SCAN_COMPLETED: 'cloud.scan.completed',
  CLOUD_RISK_UPDATED: 'cloud.risk.updated',
  CLOUD_FINDING_UPDATED: 'cloud.finding.updated',
  CLOUD_PROVIDER_ADDED: 'cloud.provider.added',
  CLOUD_PROVIDER_REMOVED: 'cloud.provider.removed',
  CLOUD_INCIDENT_CREATED: 'cloud.incident.created',
  CLOUD_COMPLIANCE_UPDATED: 'cloud.compliance.updated',

  // Container security events
  CONTAINER_SCAN_STARTED: 'container.scan.started',
  CONTAINER_SCAN_COMPLETED: 'container.scan.completed',
  CONTAINER_VULNERABILITY_DETECTED: 'container.vulnerability.detected',
  CONTAINER_SECRET_DETECTED: 'container.secret.detected',

  // Kubernetes security events
  K8S_SCAN_STARTED: 'k8s.scan.started',
  K8S_SCAN_COMPLETED: 'k8s.scan.completed',
  K8S_FINDING_DETECTED: 'k8s.finding.detected',

  // Notification events
  NOTIFICATION_CREATED: 'notification.created',
  NOTIFICATION_UNREAD_COUNT: 'notification.unread_count',
  NOTIFICATION_READ: 'notification.read',
  NOTIFICATION_DELETED: 'notification.deleted',

  // Dashboard events
  DASHBOARD_REFRESH: 'dashboard.refresh',
  DASHBOARD_STATS_UPDATE: 'dashboard.stats_update',
};

export { EVENTS };

export function registerSocketHandlers(io, namespace) {
  namespace.use(async (socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token) {
      logger.warn('[socketEvents] No token provided', { socketId: socket.id });
      return next(new Error('UNAUTHORIZED'));
    }

    try {
      const decoded = verifyAccessToken(token);
      socket.data.user = {
        id: decoded.sub,
        role: decoded.role,
        email: decoded.email,
      };
      next();
    } catch (err) {
      logger.warn('[socketEvents] JWT verification failed', { error: err.message, socketId: socket.id });
      next(new Error('UNAUTHORIZED'));
    }
  });

  namespace.on('connection', (socket) => {
    const userId = socket.data.user?.id;
    const userRole = socket.data.user?.role;
    const orgId = null;

    logger.info('[socketEvents] Socket connected', { socketId: socket.id, userId, role: userRole });

    // Event handlers are attached synchronously so no client events are
    // dropped while async setup (room join / connection registration) runs.
    socket.on(EVENTS.PING, (payload) => {
      socket.data.lastPong = Date.now();
      updateLastSeen(socket.id);
      socket.emit(EVENTS.PONG, { ts: Date.now(), ...payload });
    });

    socket.on(EVENTS.GET_UNREAD, async () => {
      try {
        const count = await Notification.countDocuments({ user: userId, read: false });
        socket.emit(EVENTS.NOTIFICATION_UNREAD_COUNT, { count });
      } catch (err) {
        logger.warn('[socketEvents] Failed to get unread count', { error: err.message, socketId: socket.id });
      }
    });

    socket.on(EVENTS.MARK_READ, async ({ notificationId }) => {
      try {
        if (notificationId) {
          await Notification.updateOne(
            { _id: notificationId, user: userId },
            { read: true }
          );
          socket.emit(EVENTS.NOTIFICATION_READ, { notificationId, read: true });
        }
      } catch (err) {
        logger.warn('[socketEvents] Mark read failed', { error: err.message, socketId: socket.id });
      }
    });

    socket.on(EVENTS.MARK_ALL_READ, async () => {
      try {
        await Notification.updateMany(
          { user: userId, read: false },
          { read: true }
        );
        socket.emit(EVENTS.NOTIFICATION_UNREAD_COUNT, { count: 0 });
      } catch (err) {
        logger.warn('[socketEvents] Mark all read failed', { error: err.message, socketId: socket.id });
      }
    });

    socket.on(EVENTS.DELETE, async ({ notificationId }) => {
      try {
        await Notification.deleteOne({ _id: notificationId, user: userId });
        socket.emit(EVENTS.NOTIFICATION_DELETED, { notificationId });
      } catch (err) {
        logger.warn('[socketEvents] Delete notification failed', { error: err.message, socketId: socket.id });
      }
    });

    socket.on(EVENTS.FILTER, async ({ category, severity, read }) => {
      try {
        const filter = { user: userId };
        if (category) filter.category = category;
        if (severity) filter.severity = severity;
        if (typeof read === 'boolean') filter.read = read;
        const notifications = await Notification.find(filter)
          .sort({ createdAt: -1 })
          .limit(50);
        socket.emit('notification:filter_result', { notifications, count: notifications.length });
      } catch (err) {
        logger.warn('[socketEvents] Filter notifications failed', { error: err.message, socketId: socket.id });
      }
    });

    socket.on('ueba:get_risk_score', async () => {
      try {
        const UserBehaviorProfile = (await import('../models/UserBehaviorProfile.js')).default;
        const profile = await UserBehaviorProfile.findOne({ userId }).lean();
        const data = profile
          ? { riskScore: profile.riskScore, riskLevel: profile.riskLevel, averageRisk: profile.averageRisk, anomalyCount: profile.anomalyCount, highRiskAnomalyCount: profile.highRiskAnomalyCount, lastUpdated: profile.lastUpdated }
          : { riskScore: 0, riskLevel: 'Low', averageRisk: 0, anomalyCount: 0, highRiskAnomalyCount: 0 };
        socket.emit(EVENTS.UEBA_RISK_UPDATED, data);
      } catch (err) {
        logger.warn('[socketEvents] UEBA risk score request failed', { error: err.message, socketId: socket.id });
      }
    });

    socket.on('ueba:acknowledge_anomaly', async ({ eventId }) => {
      try {
        const UserRiskEvent = (await import('../models/UserRiskEvent.js')).default;
        await UserRiskEvent.updateOne({ _id: eventId, userId }, { status: 'acknowledged' });
        socket.emit('ueba:anomaly.acknowledged', { eventId, status: 'acknowledged' });
      } catch (err) {
        logger.warn('[socketEvents] UEBA acknowledge failed', { error: err.message, socketId: socket.id });
      }
    });

    socket.on('cloud:scan', async (payload) => {
      try {
        const { provider, type = 'all' } = payload || {};
        if (userRole !== 'admin' && userRole !== 'cloud_admin' && userRole !== 'security_manager' && userRole !== 'devops') {
          socket.emit('cloud:scan_error', { error: 'Unauthorized', message: 'Insufficient permissions' });
          return;
        }
        const { runCloudScan } = await import('../services/cloud/cloudScanner.js');
        runCloudScan(provider)
          .then((result) => {
            socket.emit('cloud.scan.completed', { provider, result: { totalFindings: result.totalFindings, averageRisk: result.averageRisk }, timestamp: new Date().toISOString() });
          })
          .catch((err) => {
            socket.emit('cloud:scan_error', { error: err.message, provider });
          });
        socket.emit('cloud.scan.started', { provider, timestamp: new Date().toISOString() });
      } catch (err) {
        logger.warn('[socketEvents] cloud:scan failed', { error: err.message, socketId: socket.id });
      }
    });

    socket.on('container:scan', async (payload) => {
      try {
        const { imageName } = payload || {};
        if (!imageName) {
          socket.emit('container:scan_error', { error: 'imageName is required' });
          return;
        }
        const { scanDockerImage } = await import('../services/cloud/containerScanner.js');
        scanDockerImage(imageName, userId)
          .then((result) => {
            socket.emit('container.scan.completed', { imageName, ...result, timestamp: new Date().toISOString() });
          })
          .catch((err) => {
            socket.emit('container:scan_error', { error: err.message, imageName });
          });
        socket.emit('container.scan.started', { imageName, timestamp: new Date().toISOString() });
      } catch (err) {
        logger.warn('[socketEvents] container:scan failed', { error: err.message, socketId: socket.id });
      }
    });

    socket.on('k8s:scan', async (payload) => {
      try {
        if (userRole !== 'admin' && userRole !== 'container_admin' && userRole !== 'security_manager' && userRole !== 'devops') {
          socket.emit('k8s:scan_error', { error: 'Unauthorized', message: 'Insufficient permissions' });
          return;
        }
        const { scanKubernetesCluster } = await import('../services/cloud/kubernetesScanner.js');
        scanKubernetesCluster({ ...(payload || {}) })
          .then((result) => {
            socket.emit('k8s.scan.completed', { ...result, timestamp: new Date().toISOString() });
          })
          .catch((err) => {
            socket.emit('k8s:scan_error', { error: err.message });
          });
        socket.emit('k8s.scan.started', { timestamp: new Date().toISOString() });
      } catch (err) {
        logger.warn('[socketEvents] k8s:scan failed', { error: err.message, socketId: socket.id });
      }
    });

    socket.on('disconnect', async (reason) => {
      logger.info('[socketEvents] Socket disconnected', { socketId: socket.id, userId, reason });
      await unregisterConnection(socket.id);
      leaveAllRooms(socket, userId, orgId);
    });

    socket.on('error', (err) => {
      logger.error('[socketEvents] Socket error', { error: err.message, socketId: socket.id, userId });
    });

    // Async setup (non-blocking): join user room and register the connection.
    joinUserRoom(socket, userId).catch((err) => {
      logger.warn('[socketEvents] Failed to join user room', { error: err.message, socketId: socket.id });
    });
    registerConnection(socket, userId, socket.data.user).catch((err) => {
      logger.warn('[socketEvents] Failed to register connection', { error: err.message, socketId: socket.id });
    });
  });

  logger.info('[socketEvents] Handlers registered', { namespace: namespace.name });
}

export default { registerSocketHandlers, EVENTS };
