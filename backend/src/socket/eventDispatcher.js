/**
 * socket/eventDispatcher.js
 * ------------------------------------------------------------
 * Central event dispatch for Socket.IO. Provides a single
 * `dispatch` function that emits typed events to user/org rooms
 * with optional batching and deduplication to prevent duplicate
 * events on reconnection.
 */
import logger from '../utils/logger.js';
import { userRoom, orgRoom } from './roomManager.js';

const pendingBatches = new Map();
const DEBOUNCE_MS = 300;
const EMITTER_EVENTS = new Set();

function getBatchKey(event, targetId) {
  return `${event}:${targetId}`;
}

function flushBatch(io, event, targetId) {
  const key = getBatchKey(event, targetId);
  const batch = pendingBatches.get(key);
  if (!batch) return;

  clearTimeout(batch.timer);
  pendingBatches.delete(key);

  const room = targetId.startsWith('org_') ? orgRoom(targetId.replace('org_', '')) : userRoom(targetId.replace('user_', ''));
  io.to(room).emit(event, batch.latest);
  logger.debug('[eventDispatcher] Batch flushed', { event, targetId, room });
}

export function dispatch(io, targetId, event, payload, options = {}) {
  if (!io) {
    logger.warn('[eventDispatcher] No io instance available', { event, targetId });
    return;
  }

  if (options.dedupe) {
    const eventKey = `${event}:${targetId}:${JSON.stringify(payload)}`;
    if (EMITTER_EVENTS.has(eventKey)) {
      logger.debug('[eventDispatcher] Duplicate event suppressed', { event, targetId });
      return;
    }
    EMITTER_EVENTS.add(eventKey);
    setTimeout(() => EMITTER_EVENTS.delete(eventKey), 5000);
  }

  if (options.debounce) {
    const key = getBatchKey(event, targetId);
    const existing = pendingBatches.get(key);
    if (existing) {
      clearTimeout(existing.timer);
      existing.latest = payload;
      existing.timer = setTimeout(() => flushBatch(io, event, targetId), DEBOUNCE_MS);
      return;
    }
    pendingBatches.set(key, {
      latest: payload,
      timer: setTimeout(() => flushBatch(io, event, targetId), DEBOUNCE_MS),
    });
    return;
  }

  const room = targetId.startsWith('org_')
    ? orgRoom(targetId.replace('org_', ''))
    : userRoom(targetId.replace('user_', ''));
  io.to(room).emit(event, payload);
  logger.debug('[eventDispatcher] Event dispatched', { event, room });
}

export function dispatchToUser(io, userId, event, payload, options) {
  dispatch(io, `user_${userId}`, event, payload, options);
}

export function dispatchToOrg(io, orgId, event, payload, options) {
  dispatch(io, `org_${orgId}`, event, payload, options);
}

export default { dispatch, dispatchToUser, dispatchToOrg, flushBatch };
