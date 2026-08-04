import { jest } from '@jest/globals';
import { io as Client } from 'socket.io-client';
import http from 'http';
import config from '../src/config/index.js';
import { initDB, cleanupDB, createTestUser } from './bootstrap.mjs';

const JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret';

let httpServer, clientSocket, authToken, testUser, socketServer;

beforeAll(async () => {
  await initDB();
  testUser = await createTestUser({ email: 'socket@test.com', password: 'testpass123' });
  const { default: app } = await import('../src/app.js');
  httpServer = http.createServer(app);
  socketServer = await import('../src/socket/socketServer.js');
  socketServer.initSocketServer(httpServer, config);

  const { default: jwt } = await import('jsonwebtoken');
  authToken = jwt.sign({ sub: testUser._id.toString(), email: 'socket@test.com', role: 'user' }, JWT_SECRET, { expiresIn: '1h' });

  await new Promise((resolve, reject) => {
    httpServer.listen(() => {
      const port = httpServer.address().port;
      clientSocket = Client(`http://localhost:${port}/security`, {
        auth: { token: authToken },
        transports: ['websocket'],
        path: '/api/socket.io',
      });
      clientSocket.on('connect', resolve);
      clientSocket.on('connect_error', reject);
    });
  });
});

afterAll(async () => {
  if (clientSocket) clientSocket.close();
  if (socketServer) await socketServer.closeSocketServer();
  if (httpServer) {
    await new Promise((resolve) => httpServer.close(resolve));
  }
  await cleanupDB();
});

describe('Socket.IO - Connection & Authentication', () => {
  test('should connect with valid JWT token', () => {
    expect(clientSocket.connected).toBe(true);
  });

  test('should reject invalid JWT token', (done) => {
    const port = httpServer.address().port;
    const badSocket = Client(`http://localhost:${port}/security`, {
      auth: { token: 'invalid_token' },
      transports: ['websocket'],
      path: '/api/socket.io',
    });
    badSocket.on('connect_error', (err) => {
      expect(err.message).toBeDefined();
      badSocket.close();
      done();
    });
  });
});

describe('Socket.IO - Heartbeat', () => {
  test('should respond to heartbeat.ping with heartbeat.pong', (done) => {
    clientSocket.on('heartbeat.pong', (payload) => {
      expect(payload).toBeDefined();
      expect(payload.ts).toBeDefined();
      done();
    });
    clientSocket.emit('heartbeat.ping', { ts: Date.now() });
  });
});

describe('Socket.IO - Unread Count Request', () => {
  test('should respond to notification:get_unread', (done) => {
    const timer = setTimeout(() => {
      done(new Error('Timed out waiting for notification.unread_count'));
    }, 5000);

    clientSocket.on('notification.unread_count', (payload) => {
      clearTimeout(timer);
      try {
        expect(payload).toBeDefined();
        expect(payload.count).toBeDefined();
        expect(typeof payload.count).toBe('number');
        done();
      } catch (err) {
        done(err);
      }
    });

    if (clientSocket.connected) {
      clientSocket.emit('notification:get_unread');
    } else {
      clientSocket.once('connect', () => {
        clientSocket.emit('notification:get_unread');
      });
    }
  });
});