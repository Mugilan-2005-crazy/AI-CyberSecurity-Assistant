/**
 * socket/roomManager.js
 * ------------------------------------------------------------
 * Manages Socket.IO room assignments for users and organizations.
 * Provides helpers to join/leave rooms and emit scoped events.
 */
import logger from '../utils/logger.js';

const USER_ROOM_PREFIX = 'user_';
const ORG_ROOM_PREFIX = 'org_';

export function userRoom(userId) {
  return `${USER_ROOM_PREFIX}${userId}`;
}

export function orgRoom(orgId) {
  return `${ORG_ROOM_PREFIX}${orgId}`;
}

export async function joinUserRoom(socket, userId) {
  const room = userRoom(userId);
  await socket.join(room);
  logger.debug('[roomManager] User joined room', { userId, room });
}

export async function joinOrgRoom(socket, orgId) {
  if (!orgId) return;
  const room = orgRoom(orgId);
  await socket.join(room);
  logger.debug('[roomManager] User joined org room', { orgId, room });
}

export function leaveAllRooms(socket, userId, orgId) {
  const rooms = [];
  if (userId) rooms.push(userRoom(userId));
  if (orgId) rooms.push(orgRoom(orgId));
  rooms.forEach((room) => {
    socket.leave(room);
    logger.debug('[roomManager] Socket left room', { socketId: socket.id, room });
  });
}

export function emitToUser(io, userId, event, payload) {
  const room = userRoom(userId);
  io.to(room).emit(event, payload);
}

export function emitToOrg(io, orgId, event, payload) {
  const room = orgRoom(orgId);
  io.to(room).emit(event, payload);
}

export default {
  userRoom,
  orgRoom,
  joinUserRoom,
  joinOrgRoom,
  leaveAllRooms,
  emitToUser,
  emitToOrg,
};
