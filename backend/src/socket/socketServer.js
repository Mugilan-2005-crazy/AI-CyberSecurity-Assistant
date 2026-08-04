/**
 * socket/socketServer.js
 * ------------------------------------------------------------
 * Initializes Socket.IO on the HTTP server with JWT authentication.
 * Sets up the /security namespace, registers event handlers,
 * starts heartbeat monitoring, and exposes a singleton `io`
 * instance via globalThis for backward compatibility with
 * existing code (notificationService.js).
 */
import { Server } from 'socket.io';
import { registerSocketHandlers } from './socketEvents.js';
import { startHeartbeat, stopHeartbeat, cleanupDisconnectedSockets } from './heartbeatService.js';
import logger from '../utils/logger.js';

let ioInstance = null;
const NAMESPACE_PATH = '/security';

export function initSocketServer(httpServer, config) {
  const allowedOrigins = Array.isArray(config.clientOrigin)
    ? config.clientOrigin
    : [config.clientOrigin];

  ioInstance = new Server(httpServer, {
    path: `${config.apiPrefix || '/api'}/socket.io`,
    cors: {
      origin: allowedOrigins,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
    allowEIO3: false,
    pingInterval: 25000,
    pingTimeout: 60000,
    connectionStateRecovery: {
      maxDisconnectionDuration: 2 * 60 * 1000,
      skipMiddlewares: true,
    },
    connectionTimeout: 10000,
  });

  const ns = ioInstance.of(NAMESPACE_PATH);
  registerSocketHandlers(ioInstance, ns);

  startHeartbeat(ioInstance);

  setInterval(() => {
    cleanupDisconnectedSockets().catch((err) => {
      logger.error('[socketServer] Cleanup cycle error', { error: err.message });
    });
  }, 5 * 60 * 1000);

  globalThis.io = ioInstance;

  ioInstance.on('connection_error', (err) => {
    logger.error('[socketServer] Connection error', { error: err.message, code: err.code, err });
  });

  logger.info('[socketServer] Socket.IO initialized', { namespace: NAMESPACE_PATH, path: ioInstance.path() });
  return ioInstance;
}

export function getIoInstance() {
  return ioInstance;
}

export function closeSocketServer() {
  if (ioInstance) {
    stopHeartbeat();
    return ioInstance.close();
  }
  return Promise.resolve();
}

export default { initSocketServer, getIoInstance, closeSocketServer };
