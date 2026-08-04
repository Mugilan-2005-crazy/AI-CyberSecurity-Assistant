import { jest } from '@jest/globals';
import mongoose from 'mongoose';
import { initDB, cleanupDB, createTestUser, createIncident, createTestUser as bootstrapCreateUser } from './bootstrap.mjs';
import IncidentReport from '../src/models/IncidentReport.js';
import SecurityIncident from '../src/models/SecurityIncident.js';
import {
  generateIncidentReport,
  getIncidentReports,
  getIncidentReportById,
  shareIncidentReport,
  getSharedReport,
  emailIncidentReport,
} from '../src/services/incidentReportService.js';

const JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret';

let testUser, testIncident, authToken;

beforeAll(async () => {
  await initDB();
  testUser = await bootstrapCreateUser({ email: 'reports@test.com', password: 'testpass123', role: 'security_manager' });
  testIncident = await createIncident(testUser._id, { threatType: 'Malware', severity: 'High', description: 'Test incident for report generation' });
  const { default: jwt } = await import('jsonwebtoken');
  authToken = jwt.sign({ sub: testUser._id.toString(), email: testUser.email, role: testUser.role }, JWT_SECRET, { expiresIn: '1h' });
});

afterAll(async () => {
  await cleanupDB();
});

describe('Incident Report Service', () => {
  test('generateIncidentReport creates a report', async () => {
    const report = await generateIncidentReport(testIncident._id.toString(), testUser._id.toString());
    expect(report).toBeDefined();
    expect(report.incidentId.toString()).toBe(testIncident._id.toString());
    expect(report.severity).toBe('High');
    expect(report.status).toBe('completed');
    expect(report.executiveSummary).toBeTruthy();
    expect(report.technicalSummary).toBeTruthy();
    expect(report.timeline.length).toBeGreaterThan(0);
    expect(report.evidence.length).toBeGreaterThanOrEqual(0);
  });

  test('getIncidentReports returns user reports', async () => {
    const reports = await getIncidentReports(testUser._id.toString());
    expect(Array.isArray(reports)).toBe(true);
    expect(reports.length).toBeGreaterThan(0);
  });

  test('getIncidentReportById returns correct report', async () => {
    const reports = await getIncidentReports(testUser._id.toString());
    const first = reports[0];
    const report = await getIncidentReportById(first.id, testUser._id.toString());
    expect(report).toBeDefined();
    expect(report.incidentId.toString()).toBe(first.incidentId.toString());
  });

  test('getIncidentReportById returns null for wrong user', async () => {
    const otherUser = await bootstrapCreateUser({ email: 'other@test.com', password: 'testpass123' });
    const reports = await getIncidentReports(testUser._id.toString());
    const first = reports[0];
    const report = await getIncidentReportById(first.id, otherUser._id.toString());
    expect(report).toBeNull();
  });

  test('shareIncidentReport creates share token', async () => {
    const reports = await getIncidentReports(testUser._id.toString());
    const first = reports[0];
    const result = await shareIncidentReport(first.id, testUser._id.toString(), 24);
    expect(result.shareToken).toBeTruthy();
    expect(result.expiresAt).toBeInstanceOf(Date);
  });

  test('getSharedReport returns report for valid token', async () => {
    const reports = await getIncidentReports(testUser._id.toString());
    const first = reports[0];
    const { shareToken } = await shareIncidentReport(first.id, testUser._id.toString(), 24);
    const shared = await getSharedReport(shareToken);
    expect(shared).toBeDefined();
    expect(shared._id.toString()).toBe(first.id.toString());
  });

  test('getSharedReport returns null for expired token', async () => {
    const reports = await getIncidentReports(testUser._id.toString());
    const first = reports[0];
    const { shareToken } = await shareIncidentReport(first.id, testUser._id.toString(), -1);
    const shared = await getSharedReport(shareToken);
    expect(shared).toBeNull();
  });

  test('emailIncidentReport records recipient', async () => {
    const reports = await getIncidentReports(testUser._id.toString());
    const first = reports[0];
    const result = await emailIncidentReport(first.id, testUser._id.toString(), 'test@example.com');
    expect(result.success).toBe(true);
    expect(result.sentTo).toBe('test@example.com');
  });

  test('generateIncidentReport rejects unauthorized user', async () => {
    const otherUser = await bootstrapCreateUser({ email: 'unauth@test.com', password: 'testpass123' });
    await expect(generateIncidentReport(testIncident._id.toString(), otherUser._id.toString())).rejects.toThrow('Not authorized');
  });
});
