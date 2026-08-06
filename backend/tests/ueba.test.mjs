import { jest } from '@jest/globals';
import mongoose from 'mongoose';
import request from 'supertest';
import { initDB, cleanupDB, createTestUser } from './bootstrap.mjs';

import { recordActivity, getRecentActivity, getLoginHistory, getScanHistory, recalculateBaseline } from '../src/services/ueba/behaviorService.js';
import { evaluateUserActivity, evaluateAllAnomalies, runDetectionOnUser, getUserRiskEvents, resolveRiskEvent } from '../src/services/ueba/uebaEngine.js';
import { getRiskLevel, calculateRiskScore, getUserRiskRanking, getOverallRiskMetrics, updateUserRiskScore } from '../src/services/ueba/riskScoring.js';
import UserBehaviorProfile from '../src/models/UserBehaviorProfile.js';
import UserRiskEvent from '../src/models/UserRiskEvent.js';
import BehaviorTimeline from '../src/models/BehaviorTimeline.js';

let testUser, authToken, testUserId;

const JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret';

beforeAll(async () => {
  await initDB();
  const { default: jwt } = await import('jsonwebtoken');
  testUser = await createTestUser({ email: 'ueba@test.com', password: 'P@ssw0rd123!', role: 'user' });
  testUserId = testUser._id.toString();
  authToken = jwt.sign({ sub: testUserId, email: testUser.email, role: testUser.role }, JWT_SECRET, { expiresIn: '1h' });
});

afterAll(async () => {
  await cleanupDB();
});

describe('UEBA Behavior Service', () => {
  test('recordActivity creates a behavior timeline entry', async () => {
    await recordActivity(testUserId, {
      type: 'login',
      action: 'User logged in',
      ip: '192.168.1.1',
      location: 'Chennai, India',
      device: 'Chrome/Windows',
      success: true,
      metadata: { source: 'test' },
    });

    const entries = await BehaviorTimeline.find({ userId: testUserId, eventType: 'login' }).lean();
    expect(entries.length).toBeGreaterThan(0);
    expect(entries[0].details.location).toBe('Chennai, India');
  });

  test('recordActivity creates a user behavior profile if none exists', async () => {
    let profile = await UserBehaviorProfile.findOne({ userId: testUserId });
    if (!profile) {
      await recordActivity(testUserId, { type: 'scan', action: 'URL scan', ip: '10.0.0.1', riskScore: 10 });
      profile = await UserBehaviorProfile.findOne({ userId: testUserId });
    }
    expect(profile).toBeDefined();
    expect(profile.activityHistory.length).toBeGreaterThan(0);
  });

  test('getRecentActivity returns timeline entries', async () => {
    const entries = await getRecentActivity(testUserId, 7, 10);
    expect(Array.isArray(entries)).toBe(true);
  });

  test('getLoginHistory returns login entries', async () => {
    const logins = await getLoginHistory(testUserId, 10);
    expect(Array.isArray(logins)).toBe(true);
  });

  test('getScanHistory returns scan entries', async () => {
    const scans = await getScanHistory(testUserId, 7);
    expect(Array.isArray(scans)).toBe(true);
  });

  test('recalculateBaseline updates login hours and common locations', async () => {
    await recordActivity(testUserId, { type: 'login', action: 'login', ip: '1.1.1.1', location: 'Mumbai, India', device: 'Chrome', success: true });
    await recordActivity(testUserId, { type: 'login', action: 'login', ip: '2.2.2.2', location: 'Delhi, India', device: 'Firefox', success: true });
    const profile = await recalculateBaseline(testUserId);
    expect(profile).toBeDefined();
    expect(profile.baseline.normalLoginHours).toBeDefined();
    expect(profile.baseline.commonLocations.length).toBeGreaterThan(0);
  });
});

describe('UEBA Risk Scoring', () => {
  test('getRiskLevel returns correct levels for boundary values', () => {
    expect(getRiskLevel(0)).toBe('Low');
    expect(getRiskLevel(30)).toBe('Low');
    expect(getRiskLevel(31)).toBe('Medium');
    expect(getRiskLevel(60)).toBe('Medium');
    expect(getRiskLevel(61)).toBe('High');
    expect(getRiskLevel(80)).toBe('High');
    expect(getRiskLevel(81)).toBe('Critical');
    expect(getRiskLevel(100)).toBe('Critical');
    expect(getRiskLevel(150)).toBe('Critical');
    expect(getRiskLevel(-5)).toBe('Low');
  });

  test('calculateRiskScore computes a valid 0-100 score', async () => {
    const result = await calculateRiskScore(testUserId, {
      loginAnomaly: 80,
      deviceAnomaly: 50,
      locationAnomaly: 60,
      failedAttempts: 3,
      threatIntelMatch: 0,
      graphRisk: 0,
      pastIncidents: 0,
      abnormalActivity: 0,
      accountTakeover: 0,
    });
    expect(result.score).toBeGreaterThan(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.riskLevel).toMatch(/^(Low|Medium|High|Critical)$/);
  });

  test('calculateRiskScore saves profile', async () => {
    await calculateRiskScore(testUserId, { loginAnomaly: 90 });
    const profile = await UserBehaviorProfile.findOne({ userId: testUserId }).lean();
    expect(profile).toBeDefined();
    expect(profile.riskScore).toBeGreaterThan(0);
    expect(profile.riskLevel).toBeDefined();
  });

  test('updateUserRiskScore updates profile', async () => {
    const result = await updateUserRiskScore(testUserId, 75, 'anomaly');
    expect(result.profile).toBeDefined();
    expect(result.riskLevel).toBe('High');
  });

  test('getUserRiskRanking returns ranked users', async () => {
    const ranking = await getUserRiskRanking(10);
    expect(Array.isArray(ranking)).toBe(true);
  });

  test('getOverallRiskMetrics returns aggregate metrics', async () => {
    const metrics = await getOverallRiskMetrics();
    expect(metrics).toHaveProperty('totalUsers');
    expect(metrics).toHaveProperty('averageRisk');
    expect(metrics).toHaveProperty('overallRiskLevel');
    expect(metrics).toHaveProperty('distribution');
  });
});

describe('UEBA Anomaly Detection Engine', () => {
  test('evaluateUserActivity returns anomalies array for scan type', async () => {
    for (let i = 0; i < 30; i++) {
      await recordActivity(testUserId, { type: 'scan', action: `scan ${i}`, ip: '1.2.3.4', riskScore: 10 });
    }
    const result = await evaluateUserActivity(testUserId, 'scan', { type: 'url' });
    expect(Array.isArray(result.anomalies)).toBe(true);
  });

  test('evaluateAllAnomalies runs all detectors', async () => {
    await recordActivity(testUserId, { type: 'login', action: 'login', ip: '5.6.7.8', location: 'Tokyo, Japan', device: 'UnknownDevice', success: true });
    const result = await evaluateAllAnomalies(testUserId);
    expect(result).toHaveProperty('events');
    expect(result).toHaveProperty('riskScore');
    expect(result).toHaveProperty('riskLevel');
    expect(Array.isArray(result.events)).toBe(true);
  });

  test('runDetectionOnUser triggers full evaluation', async () => {
    const result = await runDetectionOnUser(testUserId);
    expect(result).toHaveProperty('events');
    expect(result).toHaveProperty('riskScore');
    expect(result).toHaveProperty('riskLevel');
  });

  test('getUserRiskEvents returns paginated events', async () => {
    await UserRiskEvent.create({
      userId: testUserId,
      eventType: 'login_anomaly',
      severity: 'Medium',
      riskScore: 45,
      title: 'Test anomaly',
      description: 'Test description',
      status: 'active',
    });
    const result = await getUserRiskEvents(testUserId, { page: 1, limit: 10 });
    expect(result).toHaveProperty('events');
    expect(result).toHaveProperty('total');
    expect(Array.isArray(result.events)).toBe(true);
  });

  test('resolveRiskEvent sets status and resolvedAt', async () => {
    const event = await UserRiskEvent.create({
      userId: testUserId,
      eventType: 'login_anomaly',
      severity: 'Low',
      riskScore: 20,
      title: 'Test resolve',
      description: 'Test',
      status: 'active',
    });
    const resolved = await resolveRiskEvent(event._id, testUserId, 'resolved');
    expect(resolved).toBeDefined();
    expect(resolved.status).toBe('resolved');
    expect(resolved.resolvedAt).toBeDefined();
  });
});

describe('UEBA API Endpoints', () => {
  let app;

  beforeAll(async () => {
    const appModule = await import('../src/app.js');
    app = appModule.default;
  });

  test('GET /api/ueba/me/risk-score returns risk data', async () => {
    const res = await request(app).get('/api/ueba/me/risk-score').set({ Authorization: `Bearer ${authToken}` });
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('riskScore');
    expect(res.body.data).toHaveProperty('riskLevel');
  });

  test('GET /api/ueba/me/profile returns profile', async () => {
    const res = await request(app).get('/api/ueba/me/profile').set({ Authorization: `Bearer ${authToken}` });
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('riskScore');
  });

  test('GET /api/ueba/me/anomalies returns anomalies', async () => {
    const res = await request(app).get('/api/ueba/me/anomalies').set({ Authorization: `Bearer ${authToken}` });
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.events)).toBe(true);
  });

  test('GET /api/ueba/me/timeline returns timeline', async () => {
    const res = await request(app).get('/api/ueba/me/timeline').set({ Authorization: `Bearer ${authToken}` });
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  test('POST /api/ueba/me/detect triggers detection', async () => {
    const res = await request(app).post('/api/ueba/me/detect').set({ Authorization: `Bearer ${authToken}` });
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('riskLevel');
  });

  test('GET /api/ueba/dashboard requires admin role', async () => {
    const res = await request(app).get('/api/ueba/dashboard').set({ Authorization: `Bearer ${authToken}` });
    expect(res.statusCode).toBe(403);
  });

  test('GET /api/ueba/anomaly/:nonexistent returns 404', async () => {
    const res = await request(app).get('/api/ueba/anomaly/000000000000000000000000').set({ Authorization: `Bearer ${authToken}` });
    expect(res.statusCode).toBe(404);
  });
});
