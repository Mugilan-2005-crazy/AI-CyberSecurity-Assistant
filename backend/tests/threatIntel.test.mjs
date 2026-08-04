import { describe, test, expect, beforeAll, afterAll, jest } from '@jest/globals';
import request from 'supertest';
import { initDB, seedAdmin, createTestUser, cleanupDB } from './bootstrap.mjs';
import { detectIocType, validateIoc, IOC_TYPES } from '../src/services/threatIntel/iocAnalyzer.js';
import { calculateReputation, classifyIoc, buildCorrelation } from '../src/services/threatIntel/reputationEngine.js';

jest.unstable_mockModule('../src/services/ai/ollamaService.js', () => ({
  askOllama: jest.fn().mockResolvedValue({ success: true, response: 'Mocked Ollama response' }),
  isOllamaAvailable: jest.fn().mockResolvedValue(true),
  default: {
    askOllama: jest.fn().mockResolvedValue({ success: true, response: 'Mocked Ollama response' }),
    isOllamaAvailable: jest.fn().mockResolvedValue(true),
  },
}));

jest.unstable_mockModule('../src/services/ai/aiRouter.js', () => ({
  routeAI: jest.fn().mockResolvedValue({ response: 'Mocked AI threat analysis', provider: 'mock' }),
  routeMultimodalAI: jest.fn().mockResolvedValue({ response: 'Mocked multimodal response', provider: 'mock' }),
  default: {
    routeAI: jest.fn().mockResolvedValue({ response: 'Mocked AI threat analysis', provider: 'mock' }),
    routeMultimodalAI: jest.fn().mockResolvedValue({ response: 'Mocked multimodal response', provider: 'mock' }),
  },
}));

let app;
let adminToken;
let userToken;
let userId;

beforeAll(async () => {
  await initDB();
  await seedAdmin();
  const user = await createTestUser({ email: 'threatintel@test.com', password: 'password123' });
  userId = user._id.toString();

  const appModule = await import('../src/app.js');
  app = appModule.default;

  const adminRes = await request(app).post('/api/auth/login').send({ email: 'admin@test.com', password: 'testpass123' });
  adminToken = adminRes.body?.accessToken;

  const userRes = await request(app).post('/api/auth/login').send({ email: 'threatintel@test.com', password: 'password123' });
  userToken = userRes.body?.accessToken;
}, 120000);

afterAll(async () => {
  await cleanupDB();
});

const adminAuth = () => ({ Authorization: `Bearer ${adminToken}` });
const userAuth = () => ({ Authorization: `Bearer ${userToken}` });

describe('Threat Intelligence', () => {
  describe('IOC Type Detection', () => {
    test('detects IPv4 address', () => {
      expect(detectIocType('192.168.1.1')).toBe(IOC_TYPES.IP);
    });

    test('detects IPv6 address', () => {
      expect(detectIocType('2001:0db8:85a3::8a2e:0370:7334')).toBe(IOC_TYPES.IP);
    });

    test('detects domain', () => {
      expect(detectIocType('example.com')).toBe(IOC_TYPES.DOMAIN);
    });

    test('detects URL', () => {
      expect(detectIocType('https://malicious-site.com/path')).toBe(IOC_TYPES.URL);
    });

    test('detects MD5 hash', () => {
      expect(detectIocType('5d41402abc4b2a76b9719d911017c592')).toBe(IOC_TYPES.HASH);
    });

    test('detects SHA256 hash', () => {
      expect(detectIocType('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')).toBe(IOC_TYPES.HASH);
    });

    test('detects email', () => {
      expect(detectIocType('user@example.com')).toBe(IOC_TYPES.EMAIL);
    });

    test('detects CVE ID', () => {
      expect(detectIocType('CVE-2024-3400')).toBe(IOC_TYPES.CVE);
    });

    test('returns unknown for invalid input', () => {
      expect(detectIocType('!!!invalid!!!')).toBe('unknown');
    });
  });

  describe('IOC Validation', () => {
    test('validates valid IP', () => {
      const result = validateIoc('192.168.1.1', IOC_TYPES.IP);
      expect(result.valid).toBe(true);
      expect(result.effectiveType).toBe(IOC_TYPES.IP);
    });

    test('validates valid domain', () => {
      const result = validateIoc('example.com', IOC_TYPES.DOMAIN);
      expect(result.valid).toBe(true);
    });

    test('validates valid URL', () => {
      const result = validateIoc('https://example.com', IOC_TYPES.URL);
      expect(result.valid).toBe(true);
    });

    test('rejects empty IOC', () => {
      const result = validateIoc('', IOC_TYPES.DOMAIN);
      expect(result.valid).toBe(false);
    });

    test('rejects invalid email', () => {
      const result = validateIoc('not-an-email', IOC_TYPES.EMAIL);
      expect(result.valid).toBe(false);
    });

    test('handles auto-detection when type not specified', () => {
      const result = validateIoc('192.168.1.1');
      expect(result.valid).toBe(true);
      expect(result.effectiveType).toBe(IOC_TYPES.IP);
    });
  });

  describe('Reputation Engine', () => {
    test('calculates reputation from provider results', () => {
      const results = [
        { success: true, reputation: 90, classification: 'malicious', threatCategory: 'malware' },
        { success: true, reputation: 80, classification: 'suspicious', threatCategory: 'abuse' },
        { success: false, error: 'timeout' },
      ];
      const { score, classification, confidence } = calculateReputation(results);
      expect(score).toBeGreaterThan(0);
      expect(classification).toBeDefined();
      expect(confidence).toBeGreaterThan(0);
    });

    test('returns score 0 for empty results', () => {
      const result = calculateReputation([]);
      expect(result.score).toBe(0);
      expect(result.classification).toBe('unknown');
    });

    test('classifies score correctly', () => {
      expect(classifyIoc(90)).toBe('malicious');
      expect(classifyIoc(50)).toBe('suspicious');
      expect(classifyIoc(30)).toBe('clean');
      expect(classifyIoc(0)).toBe('unknown');
    });

    test('builds full correlation', () => {
      const results = [
        { success: true, reputation: 85, classification: 'malicious', threatCategory: 'malware', malwareInfo: null, cves: [], mitreTechniques: [], attackTimeline: [] },
        { success: true, reputation: 70, classification: 'suspicious', threatCategory: 'abuse', malwareInfo: null, cves: [], mitreTechniques: [], attackTimeline: [] },
      ];
      const corr = buildCorrelation(results, '1.2.3.4', 'ip');
      expect(corr.reputationScore).toBeGreaterThan(0);
      expect(corr.threatPriority).toBeDefined();
      expect(corr.recommendedResponse).toBeDefined();
      expect(corr.providerCount).toBe(2);
      expect(corr.successCount).toBe(2);
    });
  });

  describe('GET /api/threat-intel/feeds', () => {
    test('returns feeds for authenticated user', async () => {
      const res = await request(app).get('/api/threat-intel/feeds').set(userAuth());
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(Array.isArray(res.body.data.threats)).toBe(true);
      expect(Array.isArray(res.body.data.cves)).toBe(true);
    });

    test('blocks unauthenticated access', async () => {
      const res = await request(app).get('/api/threat-intel/feeds');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/threat-intel/cve/search', () => {
    test('searches CVEs', async () => {
      const res = await request(app).get('/api/threat-intel/cve/search?q=fortios').set(userAuth());
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    test('requires query parameter', async () => {
      const res = await request(app).get('/api/threat-intel/cve/search').set(userAuth());
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/threat-intel/cve/:id', () => {
    test('returns CVE by ID', async () => {
      const res = await request(app).get('/api/threat-intel/cve/CVE-2024-21762').set(userAuth());
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe('CVE-2024-21762');
    });

    test('returns 404 for non-existent CVE', async () => {
      const res = await request(app).get('/api/threat-intel/cve/CVE-9999-99999').set(userAuth());
      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/threat-intel/analyze', () => {
    test('analyzes a domain IOC', async () => {
      const res = await request(app)
        .post('/api/threat-intel/analyze')
        .set(userAuth())
        .send({ ioc: 'example.com', iocType: 'domain' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.ioc).toBe('example.com');
      expect(res.body.data.iocType).toBe('domain');
      expect(res.body.data.reputationScore).toBeGreaterThanOrEqual(0);
      expect(res.body.data.classification).toBeDefined();
      expect(res.body.data.threatCategory).toBeDefined();
    });

    test('analyzes an IP IOC', async () => {
      const res = await request(app)
        .post('/api/threat-intel/analyze')
        .set(userAuth())
        .send({ ioc: '192.168.1.1', iocType: 'ip' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.iocType).toBe('ip');
    });

    test('analyzes a hash IOC', async () => {
      const res = await request(app)
        .post('/api/threat-intel/analyze')
        .set(userAuth())
        .send({ ioc: '5d41402abc4b2a76b9719d911017c592', iocType: 'hash' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.iocType).toBe('hash');
    });

    test('analyzes a CVE IOC', async () => {
      const res = await request(app)
        .post('/api/threat-intel/analyze')
        .set(userAuth())
        .send({ ioc: 'CVE-2024-21762', iocType: 'cve' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.iocType).toBe('cve');
      expect(Array.isArray(res.body.data.relatedCves)).toBe(true);
    });

    test('rejects empty IOC', async () => {
      const res = await request(app)
        .post('/api/threat-intel/analyze')
        .set(userAuth())
        .send({ ioc: '', iocType: 'domain' });

      expect(res.status).toBe(422);
    });

    test('blocks unauthenticated access', async () => {
      const res = await request(app)
        .post('/api/threat-intel/analyze')
        .send({ ioc: 'example.com', iocType: 'domain' });

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/threat-intel/iocs', () => {
    test('returns IOC history for user', async () => {
      const res = await request(app).get('/api/threat-intel/iocs').set(userAuth());
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.iocs)).toBe(true);
      expect(res.body.data.total).toBeDefined();
    });
  });

  describe('GET /api/threat-intel/dashboard', () => {
    test('returns dashboard data', async () => {
      const res = await request(app).get('/api/threat-intel/dashboard').set(userAuth());
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.totalIocs).toBeDefined();
      expect(Array.isArray(res.body.data.classificationStats)).toBe(true);
      expect(Array.isArray(res.body.data.topThreatCategories)).toBe(true);
      expect(Array.isArray(res.body.data.activeProviders)).toBe(true);
    });
  });

  describe('POST /api/threat-intel/correlation', () => {
    test('correlates multiple IOCs', async () => {
      const res = await request(app)
        .post('/api/threat-intel/correlation')
        .set(userAuth())
        .send({
          iocs: [
            { value: '1.2.3.4', type: 'ip' },
            { value: 'malicious.com', type: 'domain' },
          ],
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.results).toBeDefined();
      expect(res.body.data.correlation).toBeDefined();
    });

    test('rejects empty IOC array', async () => {
      const res = await request(app)
        .post('/api/threat-intel/correlation')
        .set(userAuth())
        .send({ iocs: [] });

      expect(res.status).toBe(422);
    });
  });

  describe('POST /api/threat-intel/cache/refresh', () => {
    test('refreshes cache as admin', async () => {
      const res = await request(app)
        .post('/api/threat-intel/cache/refresh')
        .set(adminAuth());

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});
