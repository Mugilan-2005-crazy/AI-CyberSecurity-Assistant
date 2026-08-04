/**
 * socket/heartbeatService.js
 * ------------------------------------------------------------
 * Heartbeat monitoring: registers connections, tracks last-seen,
 * detects stale connections, and cleans up on disconnect.
 * Periodically scans for stale sockets and marks them offline.
 */
import logger from '../utils/logger.js';
import SocketConnection from '../models/SocketConnection.js';

const STALE_THRESHOLD_MS = 90 * 1000;
const HEARTBEAT_INTERVAL_MS = 30 * 1000;
const CONNECTION_CACHE = new Map();

export { CONNECTION_CACHE };

let scanInterval = null;

export async function registerConnection(socket, userId, userData) {
  try {
    const connection = await SocketConnection.create({
      user: userId,
      socketId: socket.id,
      connectionId: socket.conn?.id || socket.id,
      ip: socket.handshake.address || socket.handshake.headers['x-forwarded-for'] || '',
      userAgent: socket.handshake.headers['user-agent'] || '',
      status: 'connected',
      lastPing: new Date(),
    });

    CONNECTION_CACHE.set(socket.id, {
      userId,
      lastPong: Date.now(),
      connectionDoc: connection._id,
    });

    logger.debug('[heartbeatService] Connection registered', { socketId: socket.id, userId });
    return connection;
  } catch (err) {
    logger.warn('[heartbeatService] Register failed', { error: err.message, socketId: socket.id });
    return null;
  }
}

export async function unregisterConnection(socketId) {
  try {
    const cached = CONNECTION_CACHE.get(socketId);
    if (cached) {
      await SocketConnection.updateOne(
        { socketId },
        { status: 'disconnected', lastSeen: new Date() }
      );
      CONNECTION_CACHE.delete(socketId);
    }
    logger.debug('[heartbeatService] Connection unregistered', { socketId });
  } catch (err) {
    logger.warn('[heartbeatService] Unregister failed', { error: err.message, socketId });
  }
}

export function updateLastSeen(socketId) {
  const cached = CONNECTION_CACHE.get(socketId);
  if (cached) {
    cached.lastPong = Date.now();
  }
  // Also update the DB lastPing timestamp for persistence
  SocketConnection.updateOne(
    { socketId },
    { lastPing: new Date() }
  ).catch((err) => {
    logger.warn('[heartbeatService] lastPing update failed', { error: err.message, socketId });
  });
}

export async function detectStaleConnections(io) {
  try {
    const now = Date.now();
    const staleSocketIds = [];

    for (const [socketId, data] of CONNECTION_CACHE.entries()) {
      const timeSincePong = now - data.lastPong;
      if (timeSincePong > STALE_THRESHOLD_MS) {
        staleSocketIds.push(socketId);
        logger.warn('[heartbeatService] Stale connection detected', { socketId, userId: data.userId, msSincePong: timeSincePong });

        if (io) {
          const sockets = await io.sockets.allSockets();
          if (sockets.has(socketId)) {
            const socket = io.sockets.sockets.get(socketId);
            if (socket) {
              socket.emit('offline', { reason: 'stale', lastSeen: new Date(data.lastPong).toISOString() });
              socket.disconnect(true);
            }
          }
        }

        await SocketConnection.updateOne(
          { socketId },
          { status: 'stale', lastSeen: new Date() }
        );
        CONNECTION_CACHE.delete(socketId);
      }
    }

    if (staleSocketIds.length > 0) {
      logger.info('[heartbeatService] Stale connections cleaned', { count: staleSocketIds.length });
    }
  } catch (err) {
    logger.error('[heartbeatService] Stale detection failed', { error: err.message });
  }
}

export function startHeartbeat(io) {
  if (scanInterval) return;
  scanInterval = setInterval(() => {
    detectStaleConnections(io).catch((err) => {
      logger.error('[heartbeatService] Detection cycle error', { error: err.message });
    });
  }, HEARTBEAT_INTERVAL_MS);
  logger.info('[heartbeatService] Heartbeat monitoring started', { intervalMs: HEARTBEAT_INTERVAL_MS, staleThresholdMs: STALE_THRESHOLD_MS });
}

export function stopHeartbeat() {
  if (scanInterval) {
    clearInterval(scanInterval);
    scanInterval = null;
    logger.info('[heartbeatService] Heartbeat monitoring stopped');
  }
}

export async function cleanupDisconnectedSockets() {
  try {
    const cutoff = new Date(Date.now() - STALE_THRESHOLD_MS * 2);
    const result = await SocketConnection.updateMany(
      { status: 'connected', lastSeen: { $lt: cutoff } },
      { $set: { status: 'stale' } }
    );
    if (result.modifiedCount > 0) {
      logger.info('[heartbeatService] Cleaned up stale DB connections', { count: result.modifiedCount });
    }
  } catch (err) {
    logger.warn('[heartbeatService] DB cleanup failed', { error: err.message });
  }
}

export default {
  registerConnection,
  unregisterConnection,
  updateLastSeen,
  detectStaleConnections,
  startHeartbeat,
  stopHeartbeat,
  cleanupDisconnectedSockets,
};
