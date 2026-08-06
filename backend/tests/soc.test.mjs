import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { initDB, seedAdmin, createTestUser, createIncident, createScan, cleanupDB } from './bootstrap.mjs';

let app;
let adminToken;
let userToken;
let userId;
let incidentId;

beforeAll(async () => {
  await initDB();
  const admin = await seedAdmin();
  const user = await createTestUser({ email: 'socuser@test.com', password: 'P@ssw0rd123!' });
  userId = user._id.toString();

  const appModule = await import('../src/app.js');
  app = appModule.default;

  // Get tokens once
  const adminRes = await request(app).post('/api/auth/login').send({ email: 'admin@test.com', password: 'testpass123' });
  adminToken = adminRes.body?.accessToken;

  const userRes = await request(app).post('/api/auth/login').send({ email: 'socuser@test.com', password: 'P@ssw0rd123!' });
  userToken = userRes.body?.accessToken;

  const inc = await createIncident(userId, { threatType: 'Malware', severity: 'High' });
  incidentId = inc._id.toString();
}, 120000);

afterAll(async () => {
  await cleanupDB();
});

const adminAuth = () => ({ Authorization: `Bearer ${adminToken}` });
const userAuth = () => ({ Authorization: `Bearer ${userToken}` });

describe('SOC', () => {
  describe('GET /api/soc/dashboard', () => {
    test('returns dashboard data for admin', async () => {
      const res = await request(app).get('/api/soc/dashboard').set(adminAuth());
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.totalThreats).toBeDefined();
      expect(res.body.data.criticalAlerts).toBeDefined();
      expect(Array.isArray(res.body.data.topThreats)).toBe(true);
      expect(Array.isArray(res.body.data.recentIncidents)).toBe(true);
    });

    test('forbids access for regular user', async () => {
      const res = await request(app).get('/api/soc/dashboard').set(userAuth());
      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/soc/metrics', () => {
    test('returns metrics for admin', async () => {
      const res = await request(app).get('/api/soc/metrics').set(adminAuth());
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.totalScans).toBeDefined();
      expect(res.body.data.threatsDetected).toBeDefined();
    });

    test('forbids access for regular user', async () => {
      const res = await request(app).get('/api/soc/metrics').set(userAuth());
      expect(res.status).toBe(403);
    });
  });

  describe('POST /api/soc/incidents', () => {
    test('creates an incident for admin', async () => {
      const res = await request(app)
        .post('/api/soc/incidents')
        .set(adminAuth())
        .send({ userId, threatType: 'Phishing', severity: 'Critical', description: 'Test' });
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.threatType).toBe('Phishing');
    });

    test('rejects missing userId and threatType with validation error', async () => {
      const res = await request(app)
        .post('/api/soc/incidents')
        .set(adminAuth())
        .send({});
      expect(res.status).toBe(422);
    });
  });

  describe('GET /api/soc/incidents', () => {
    test('lists incidents with filters', async () => {
      const res = await request(app).get('/api/soc/incidents').set(adminAuth());
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.incidents)).toBe(true);
    });

    test('filters by status', async () => {
      const res = await request(app)
        .get('/api/soc/incidents')
        .set(adminAuth())
        .query({ status: 'open' });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('GET /api/soc/incidents/:id', () => {
    test('returns incident by id', async () => {
      const res = await request(app).get(`/api/soc/incidents/${incidentId}`).set(adminAuth());
      expect(res.status).toBe(200);
      expect(res.body.data.threatType).toBe('Malware');
    });

    test('returns error for non-existent incident', async () => {
      const res = await request(app).get('/api/soc/incidents/000000000000000000000000').set(adminAuth());
      expect([404, 500]).toContain(res.status);
    });
  });

  describe('PATCH /api/soc/incidents/:id/status', () => {
    test('updates incident status', async () => {
      const res = await request(app)
        .patch(`/api/soc/incidents/${incidentId}/status`)
        .set(adminAuth())
        .send({ status: 'resolved' });
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('resolved');
    });

    test('rejects missing status with validation error', async () => {
      const res = await request(app)
        .patch(`/api/soc/incidents/${incidentId}/status`)
        .set(adminAuth())
        .send({});
      expect(res.status).toBe(422);
    });
  });

  describe('GET /api/soc/user/incidents', () => {
    test('returns user incidents', async () => {
      const res = await request(app).get('/api/soc/user/incidents').set(userAuth());
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.incidents)).toBe(true);
    });
  });
});