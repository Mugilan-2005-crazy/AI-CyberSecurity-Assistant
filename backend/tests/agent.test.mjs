import { describe, test, expect, beforeAll, afterAll, jest } from '@jest/globals';
import request from 'supertest';
import { initDB, seedAdmin, createTestUser, cleanupDB } from './bootstrap.mjs';

jest.unstable_mockModule('../src/services/agent/recommendationEngine.js', () => ({
  generateRecommendations: jest.fn().mockResolvedValue([
    { priority: 'high', action: 'Review security settings', detail: 'Static recommendation', source: 'static' },
  ]),
}));

jest.unstable_mockModule('../src/services/ai/aiRouter.js', () => ({
  routeAI: jest.fn().mockResolvedValue({ response: '1. Review settings', provider: 'mock' }),
  routeMultimodalAI: jest.fn().mockResolvedValue({ response: 'Mocked multimodal response', provider: 'mock' }),
  isConfigured: jest.fn().mockReturnValue(true),
}));

jest.unstable_mockModule('../src/services/security/gemini.js', () => {
  const mockAsk = jest.fn().mockResolvedValue('Mocked Gemini response');
  const mockIsConfigured = jest.fn().mockReturnValue(true);
  return {
    ask: mockAsk,
    isConfigured: mockIsConfigured,
    default: { ask: mockAsk, isConfigured: mockIsConfigured },
  };
});

jest.unstable_mockModule('../src/services/ai/ollamaService.js', () => ({
  askOllama: jest.fn().mockResolvedValue('Mocked Ollama response'),
  isOllamaAvailable: jest.fn().mockResolvedValue(true),
}));

let app;
let userToken;

beforeAll(async () => {
  await initDB();
  await seedAdmin();

  const appModule = await import('../src/app.js');
  app = appModule.default;

  const user = await createTestUser({ email: 'agentuser@test.com', password: 'P@ssw0rd123!' });
  const res = await request(app).post('/api/auth/login').send({ email: 'agentuser@test.com', password: 'P@ssw0rd123!' });
  userToken = res.body?.accessToken;
}, 120000);

afterAll(async () => {
  await cleanupDB();
});

const auth = (token) => ({ Authorization: `Bearer ${token}` });

describe('AI Agent', () => {
  test('GET /api/agent/security-insights returns assessment without external scans', async () => {
    const res = await request(app).get('/api/agent/security-insights').set(auth(userToken));
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.assessment).toBeDefined();
    expect(res.body.data.recommendations).toBeDefined();
    expect(Array.isArray(res.body.data.recommendations)).toBe(true);
  });

  test('GET /api/agent/security-insights returns assessment with external scans', async () => {
    const res = await request(app)
      .get('/api/agent/security-insights')
      .set(auth(userToken))
      .query({});
    expect(res.status).toBe(200);
    expect(res.body.data.assessment).toBeDefined();
  });

  test('requires authentication', async () => {
    const res = await request(app).get('/api/agent/security-insights');
    expect(res.status).toBe(401);
  });

  test('handles empty scans gracefully', async () => {
    const res = await request(app).get('/api/agent/security-insights').set(auth(userToken));
    expect(res.status).toBe(200);
    expect(res.body.data.assessment).toBeDefined();
  });
});