import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { initDB, seedAdmin, cleanupDB } from './bootstrap.mjs';

let app;

beforeAll(async () => {
  await initDB();
  await seedAdmin();
  const appModule = await import('../src/app.js');
  app = appModule.default;
}, 120000);

afterAll(async () => {
  await cleanupDB();
});

describe('Health', () => {
  test('GET /api/health returns 200', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toContain('Enterprise Cyber Security Platform API running');
  });

  test('GET /health returns 200', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});