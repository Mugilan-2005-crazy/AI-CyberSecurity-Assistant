import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { initDB, seedAdmin, createTestUser, createAlert, cleanupDB } from './bootstrap.mjs';

let app;
let adminToken;
let userToken;
let userId;
let alertId;

beforeAll(async () => {
  await initDB();
  const admin = await seedAdmin();
  const user = await createTestUser({ email: 'alertuser@test.com', password: 'password123' });
  userId = user._id.toString();

  const appModule = await import('../src/app.js');
  app = appModule.default;

  // Get tokens once
  const adminRes = await request(app).post('/api/auth/login').send({ email: 'admin@test.com', password: 'testpass123' });
  adminToken = adminRes.body?.accessToken;

  const userRes = await request(app).post('/api/auth/login').send({ email: 'alertuser@test.com', password: 'password123' });
  userToken = userRes.body?.accessToken;

  const alert = await createAlert(userId, { title: 'Test Alert', message: 'Test message' });
  alertId = alert._id.toString();
}, 120000);

afterAll(async () => {
  await cleanupDB();
});

const adminAuth = () => ({ Authorization: `Bearer ${adminToken}` });
const userAuth = () => ({ Authorization: `Bearer ${userToken}` });

describe('Alerts', () => {
  describe('GET /api/alerts', () => {
    test('returns alerts for user', async () => {
      const res = await request(app).get('/api/alerts').set(userAuth());
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    test('returns all alerts for admin', async () => {
      const res = await request(app).get('/api/alerts').set(adminAuth());
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('GET /api/alerts/dashboard', () => {
    test('returns dashboard summary', async () => {
      const res = await request(app).get('/api/alerts/dashboard').set(adminAuth());
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
    });

    test('supports timeframes', async () => {
      const res = await request(app).get('/api/alerts/dashboard').set(adminAuth()).query({ timeframe: '24h' });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('GET /api/alerts/user', () => {
    test('returns current user alerts', async () => {
      const res = await request(app).get('/api/alerts/user').set(userAuth());
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  describe('GET /api/alerts/:id', () => {
    test('returns alert by id for owner', async () => {
      const res = await request(app).get(`/api/alerts/${alertId}`).set(userAuth());
      expect(res.status).toBe(200);
      expect(res.body.data.title).toBe('Test Alert');
    });

    test('returns error for non-existent alert', async () => {
      const res = await request(app).get('/api/alerts/000000000000000000000000').set(userAuth());
      expect([404, 500]).toContain(res.status);
    });

    test('forbids access to other user alert', async () => {
      const otherUser = await createTestUser({ email: 'other@test.com', password: 'password123' });
      const otherRes = await request(app).post('/api/auth/login').send({ email: 'other@test.com', password: 'password123' });
      const otherToken = otherRes.body?.accessToken;
      const res = await request(app).get(`/api/alerts/${alertId}`).set({ Authorization: `Bearer ${otherToken}` });
      expect([403, 404]).toContain(res.status);
    });
  });

  describe('PATCH /api/alerts/:id/acknowledge', () => {
    test('acknowledges alert', async () => {
      const res = await request(app).patch(`/api/alerts/${alertId}/acknowledge`).set(userAuth());
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('acknowledged');
    });

    test('returns error for non-existent alert', async () => {
      const res = await request(app).patch('/api/alerts/000000000000000000000000/acknowledge').set(userAuth());
      expect([404, 500]).toContain(res.status);
    });
  });

  describe('GET /api/alerts/admin/all', () => {
    test('returns all alerts for admin', async () => {
      const res = await request(app).get('/api/alerts/admin/all').set(adminAuth());
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    test('forbids access for regular user', async () => {
      const res = await request(app).get('/api/alerts/admin/all').set(userAuth());
      expect(res.status).toBe(403);
    });
  });
});