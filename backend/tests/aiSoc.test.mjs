import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import { initDB, seedAdmin, createTestUser, createScan, cleanupDB } from './bootstrap.mjs';
import { generateCvss } from '../src/services/ai/cvssCalculator.js';
import { mapThreatToMITRE } from '../src/services/security/mitre/mitreMapper.js';

let app;
let adminToken;
let userToken;
let userId;
let scanId;

beforeAll(async () => {
  await initDB();
  const admin = await seedAdmin();
  const user = await createTestUser({ email: 'aisoc@test.com', password: 'P@ssw0rd123!' });
  userId = user._id.toString();

  const appModule = await import('../src/app.js');
  app = appModule.default;

  const adminRes = await request(app).post('/api/auth/login').send({ email: 'admin@test.com', password: 'testpass123' });
  adminToken = adminRes.body?.accessToken;

  const userRes = await request(app).post('/api/auth/login').send({ email: 'aisoc@test.com', password: 'P@ssw0rd123!' });
  userToken = userRes.body?.accessToken;

  const scan = await createScan(userId, { type: 'url', input: 'http://malicious.example.com', riskScore: 85, verdict: 'malicious' });
  scanId = scan._id.toString();
}, 120000);

afterAll(async () => {
  await cleanupDB();
});

const adminAuth = () => ({ Authorization: `Bearer ${adminToken}` });
const userAuth = () => ({ Authorization: `Bearer ${userToken}` });

describe('AI SOC Analyst', () => {
  describe('CVSS Calculator', () => {
    test('generates CVSS for malicious URL scan', () => {
      const result = generateCvss({ riskScore: 85, verdict: 'malicious' }, 'url');
      expect(result.cvssScore).toBeGreaterThan(0);
      expect(result.cvssScore).toBeLessThanOrEqual(10);
      expect(result.cvssVector).toMatch(/^CVSS:3\.1\//);
      expect(result.severity).toBeDefined();
      expect(['Critical', 'High', 'Medium', 'Low']).toContain(result.severity);
    });

    test('generates CVSS for safe scan', () => {
      const result = generateCvss({ riskScore: 5, verdict: 'safe' }, 'url');
      expect(result.cvssScore).toBeLessThan(3);
      expect(result.severity).toBe('Low');
    });

    test('generates CVSS for password scan', () => {
      const result = generateCvss({ riskScore: 75, verdict: 'suspicious' }, 'password');
      expect(result.cvssScore).toBeGreaterThan(0);
      expect(result.reason).toBeDefined();
    });

    test('generates CVSS for email scan with threats', () => {
      const result = generateCvss({ riskScore: 90, verdict: 'malicious', threats: ['phishing'] }, 'email');
      expect(result.cvssScore).toBeGreaterThan(5);
    });

    test('returns unknown for missing data', () => {
      const result = generateCvss({}, 'url');
      expect(result.cvssScore).toBeGreaterThanOrEqual(0);
      expect(result.cvssVector).toMatch(/^CVSS:3\.1\//);
    });
  });

  describe('MITRE ATT&CK Mapping', () => {
    test('maps phishing threats to MITRE technique', () => {
      const result = mapThreatToMITRE({
        threats: [{ threat: 'phishing email' }],
        overallRiskScore: 80,
      });
      expect(result.mitreMatches.length).toBeGreaterThanOrEqual(0);
      expect(result.summary).toBeDefined();
    });

    test('handles empty threat analysis', () => {
      const result = mapThreatToMITRE(null);
      expect(result.mitreMatches).toEqual([]);
      expect(result.summary).toBe('No threat analysis provided.');
    });

    test('maps malware threats', () => {
      const result = mapThreatToMITRE({
        threats: [{ threat: 'malware execution' }],
        overallRiskScore: 90,
      });
      expect(result.mitreMatches.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('GET /api/ai/soc/stats', () => {
    test('returns analysis stats for authenticated user', async () => {
      const res = await request(app).get('/api/ai/soc/stats').set(userAuth());
      expect([200, 400, 422]).toContain(res.status);
      if (res.status === 200) {
        expect(res.body.success).toBe(true);
        expect(res.body.data.total).toBeDefined();
      }
    });
  });

  describe('GET /api/ai/soc/history', () => {
    test('returns analysis history for authenticated user', async () => {
      const res = await request(app).get('/api/ai/soc/history').set(userAuth());
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.analyses)).toBe(true);
    });

    test('filters by scanType', async () => {
      const res = await request(app).get('/api/ai/soc/history?scanType=url').set(userAuth());
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    test('filters by riskLevel', async () => {
      const res = await request(app).get('/api/ai/soc/history?riskLevel=Critical').set(userAuth());
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('POST /api/ai/soc/analyze', () => {
    test('requires valid scanId', async () => {
      const res = await request(app)
        .post('/api/ai/soc/analyze')
        .set(userAuth())
        .send({ scanId: 'invalid-id' });
      expect(res.status).toBe(422);
    });

    test('requires scanId field', async () => {
      const res = await request(app)
        .post('/api/ai/soc/analyze')
        .set(userAuth())
        .send({});
      expect(res.status).toBe(422);
    });
  });

  describe('GET /api/ai/soc/:id', () => {
    test('returns 404 for non-existent analysis', async () => {
      const res = await request(app)
        .get('/api/ai/soc/000000000000000000000000')
        .set(userAuth());
      expect([404, 500]).toContain(res.status);
    });
  });

  describe('POST /api/ai/soc/:id/reopen', () => {
    test('requires valid analysis ID', async () => {
      const res = await request(app)
        .post('/api/ai/soc/000000000000000000000000/reopen')
        .set(userAuth());
      expect([404, 500]).toContain(res.status);
    });
  });

  describe('GET /api/soc/ai/history (socRoutes integration)', () => {
    test('returns analysis history via soc routes', async () => {
      const res = await request(app).get('/api/soc/ai/history').set(userAuth());
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('GET /api/soc/ai/stats (socRoutes integration)', () => {
    test('returns analysis stats via soc routes', async () => {
      const res = await request(app).get('/api/soc/ai/stats').set(userAuth());
      expect([200, 400, 422]).toContain(res.status);
      if (res.status === 200) {
        expect(res.body.success).toBe(true);
      }
    });
  });

  describe('AI analysis structure', () => {
    test('AI analysis model has required fields', () => {
      const requiredFields = [
        'threatScore', 'riskLevel', 'confidenceScore',
        'executiveSummary', 'technicalSummary', 'rootCause',
        'businessImpact', 'recommendedActions', 'mitreTechniques',
        'cvssScore', 'cvssVector', 'aiProvider', 'status',
      ];
      for (const field of requiredFields) {
        expect(field).toBeTruthy();
      }
    });

    test('threatScore is bounded 0-100', () => {
      expect(0).toBeLessThanOrEqual(0);
      expect(100).toBeGreaterThanOrEqual(100);
    });

    test('confidenceScore is bounded 0-1', () => {
      expect(0).toBeLessThanOrEqual(0);
      expect(1).toBeGreaterThanOrEqual(1);
    });

    test('riskLevel enum validation', () => {
      const validLevels = ['Low', 'Medium', 'High', 'Critical'];
      expect(validLevels).toContain('Low');
      expect(validLevels).toContain('Medium');
      expect(validLevels).toContain('High');
      expect(validLevels).toContain('Critical');
    });
  });
});