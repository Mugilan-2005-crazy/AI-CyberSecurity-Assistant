import { jest } from '@jest/globals';
import mongoose from 'mongoose';
import { registerConnection, detectStaleConnections, startHeartbeat, stopHeartbeat, CONNECTION_CACHE } from '../src/socket/heartbeatService.js';
import SocketConnection from '../src/models/SocketConnection.js';
import { initDB, cleanupDB, createTestUser } from './bootstrap.mjs';

describe('Heartbeat Service', () => {
  let testUserId;

  const makeMockSocket = (id) => ({
    id,
    conn: { id: `conn_${id}` },
    data: {
      user: { id: testUserId, email: 'heartbeat@test.com', role: 'user' },
    },
    handshake: {
      headers: {
        'x-forwarded-for': '127.0.0.1',
        'user-agent': 'test-agent',
      },
    },
  });

  beforeAll(async () => {
    await initDB();
    const user = await createTestUser({ email: 'heartbeat@test.com', password: 'testpass123' });
    testUserId = user._id;
  });

  afterAll(async () => {
    stopHeartbeat();
    await cleanupDB();
    await import('mongoose').then((m) => m.default.connection.close());
  });

  afterEach(async () => {
    await SocketConnection.deleteMany({});
    CONNECTION_CACHE.clear();
    jest.clearAllMocks();
  });

  describe('registerConnection', () => {
    test('should register a new active connection', async () => {
      const mockSocket = makeMockSocket('socket_abc123');
      const conn = await registerConnection(mockSocket, testUserId, mockSocket.data.user);
      expect(conn).toBeDefined();
      expect(conn.user.toString()).toBe(testUserId.toString());
      expect(conn.socketId).toBe('socket_abc123');
      expect(conn.status).toBe('connected');
      expect(conn.lastPing).toBeDefined();
    });
  });

  describe('detectStaleConnections', () => {
    test('should mark stale connections and remove from cache', async () => {
      const mockSocket = makeMockSocket('socket_stale123');
      await registerConnection(mockSocket, testUserId, mockSocket.data.user);

      // Backdate lastPing in DB and cache to simulate stale
      const staleTime = new Date(Date.now() - 5 * 60 * 1000);
      await SocketConnection.updateOne(
        { socketId: 'socket_stale123' },
        { $set: { lastPing: staleTime } }
      );

      const cached = CONNECTION_CACHE.get('socket_stale123');
      if (cached) {
        cached.lastPong = Date.now() - 5 * 60 * 1000;
      }

      const mockIo = {
        sockets: {
          allSockets: jest.fn().mockResolvedValue(new Set()),
          sockets: { get: jest.fn() },
        },
      };

      await detectStaleConnections(mockIo);

      const updated = await SocketConnection.findOne({ socketId: 'socket_stale123' });
      expect(updated).not.toBeNull();
      expect(updated.status).toBe('stale');
      expect(CONNECTION_CACHE.has('socket_stale123')).toBe(false);
    });

    test('should not flag active connections as stale', async () => {
      const mockSocket = makeMockSocket('socket_active123');
      await registerConnection(mockSocket, testUserId, mockSocket.data.user);

      const mockIo = {
        sockets: {
          allSockets: jest.fn().mockResolvedValue(new Set()),
          sockets: { get: jest.fn() },
        },
      };

      await detectStaleConnections(mockIo);

      const conn = await SocketConnection.findOne({ socketId: 'socket_active123' });
      expect(conn).not.toBeNull();
      expect(conn.status).toBe('connected');
      expect(CONNECTION_CACHE.has('socket_active123')).toBe(true);
    });
  });

  describe('startHeartbeat / stopHeartbeat', () => {
    test('should start and stop heartbeat interval without errors', () => {
      const mockIo = {
        sockets: {
          allSockets: jest.fn().mockResolvedValue(new Set()),
          sockets: { get: jest.fn() },
        },
      };

      startHeartbeat(mockIo);
      expect(startHeartbeat(mockIo)).toBeUndefined();
      stopHeartbeat();
    });
  });
});
