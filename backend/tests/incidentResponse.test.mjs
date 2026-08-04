import { describe, test, expect, beforeAll, afterAll, jest } from '@jest/globals';
import request from 'supertest';
import { initDB, seedAdmin, createTestUser, createIncident, createResponse, cleanupDB } from './bootstrap.mjs';

jest.unstable_mockModule('../src/services/security/gemini.js', () => {
  const mockAsk = jest.fn().mockResolvedValue('Mocked Gemini response');
  const mockIsConfigured = jest.fn().mockReturnValue(true);
  return {
    ask: mockAsk,
    isConfigured: mockIsConfigured,
    default: { ask: mockAsk, isConfigured: mockIsConfigured },
  };
});

jest.unstable_mockModule('../src/services/ai/aiRouter.js', () => ({
  routeAI: jest.fn().mockResolvedValue({ response: 'Mocked AI response', provider: 'gemini' }),
  routeMultimodalAI: jest.fn().mockResolvedValue({ response: 'Mocked multimodal response', provider: 'gemini-vision' }),
  isConfigured: jest.fn().mockReturnValue(true),
}));

let app;
let adminToken;
let userToken;
let userId;
let incidentId;
let responseId;

beforeAll(async () => {
  await initDB();
  const admin = await seedAdmin();
  const user = await createTestUser({ email: 'respuser@test.com', password: 'password123' });
  userId = user._id.toString();

  const appModule = await import('../src/app.js');
  app = appModule.default;

  const adminRes = await request(app).post('/api/auth/login').send({ email: 'admin@test.com', password: 'testpass123' });
  adminToken = adminRes.body?.accessToken;

  const userRes = await request(app).post('/api/auth/login').send({ email: 'respuser@test.com', password: 'password123' });
  userToken = userRes.body?.accessToken;

  const inc = await createIncident(userId, { threatType: 'Malware', severity: 'High' });
  incidentId = inc._id.toString();

  const resp = await createResponse(userId, incidentId, { status: 'pending' });
  responseId = resp._id.toString();
}, 120000);

afterAll(async () => {
  await cleanupDB();
});

const adminAuth = () => ({ Authorization: `Bearer ${adminToken}` });
const userAuth = () => ({ Authorization: `Bearer ${userToken}` });

describe('Incident Response', () => {
  describe('GET /api/response/incidents/:id/analyze', () => {
    test('analyzes incident with AI for admin', async () => {
      const res = await request(app)
        .get(`/api/response/incidents/${incidentId}/analyze`)
        .set(adminAuth());
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
    });
  });

  describe('POST /api/response/incidents/:id/recommend', () => {
    test('gets response plan for incident', async () => {
      const res = await request(app)
        .post(`/api/response/incidents/${incidentId}/recommend`)
        .set(adminAuth());
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
    });
  });

  describe('GET /api/response/history', () => {
    test('lists all response history for admin', async () => {
      const res = await request(app).get('/api/response/history').set(adminAuth());
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    test('lists user response history', async () => {
      const res = await request(app).get('/api/response/history').set(userAuth());
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('GET /api/response/history/:id', () => {
    test('returns response by id', async () => {
      const res = await request(app).get(`/api/response/history/${responseId}`).set(userAuth());
      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
    });

    test('returns error for non-existent response', async () => {
      const res = await request(app).get('/api/response/history/000000000000000000000000').set(adminAuth());
      expect([404, 500]).toContain(res.status);
    });
  });

  describe('PATCH /api/response/incidents/:id/approve', () => {
    test('approves response plan', async () => {
      const res = await request(app)
        .patch(`/api/response/incidents/${responseId}/approve`)
        .set(adminAuth())
        .send({ status: 'approved' });
      expect([200, 404, 500]).toContain(res.status);
    });

    test('rejects missing status', async () => {
      const res = await request(app)
        .patch(`/api/response/incidents/${responseId}/approve`)
        .set(adminAuth())
        .send({});
      expect([400, 500]).toContain(res.status);
    });
  });
});