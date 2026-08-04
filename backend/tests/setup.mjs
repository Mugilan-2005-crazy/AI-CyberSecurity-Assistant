import { connectDB } from '../src/config/db.js';
import User from '../src/models/User.js';
import SecurityAlert from '../src/models/SecurityAlert.js';
import SecurityIncident from '../src/models/SecurityIncident.js';
import IncidentResponse from '../src/models/IncidentResponse.js';
import ScanHistory from '../src/models/ScanHistory.js';
import AgentMemory from '../src/models/AgentMemory.js';

export const initDB = async () => {
  await connectDB();
};

export const cleanupDB = async () => {
  const mongoose = (await import('mongoose')).default;
  if (mongoose.connection.readyState === 1) {
    await mongoose.connection.dropDatabase();
  }
};

export const seedAdmin = async () => {
  const existing = await User.findOne({ email: process.env.ADMIN_EMAIL || 'admin@test.com' });
  if (existing) return existing;

  return await User.create({
    name: process.env.ADMIN_NAME || 'Test Admin',
    email: process.env.ADMIN_EMAIL || 'admin@test.com',
    password: process.env.ADMIN_PASSWORD || 'test',
    role: 'admin',
    isEmailVerified: true,
  });
};

export const createTestUser = async (overrides = {}) => {
  const email = overrides.email || `user-${Date.now()}@test.com`;
  const existing = await User.findOne({ email });
  if (existing) return existing;

  return await User.create({
    name: overrides.name || 'Test User',
    email,
    password: overrides.password || 'password123',
    role: overrides.role || 'user',
    isEmailVerified: true,
    ...overrides,
  });
};

export const getAuthToken = async (email, password) => {
  const { default: app } = await import('../src/app.js');
  const response = await app.post('/api/auth/login').send({ email, password });
  if (response.body?.success && response.body?.accessToken) {
    return response.body.accessToken;
  }
  throw new Error(`Login failed: ${JSON.stringify(response.body)}`);
};

export const authHeaders = async (email, password) => {
  const token = await getAuthToken(email, password);
  return { Authorization: `Bearer ${token}` };
};

export const createAlert = async (userId, overrides = {}) => {
  return await SecurityAlert.create({
    userId,
    alertType: overrides.alertType || 'malware_detected',
    severity: overrides.severity || 'HIGH',
    title: overrides.title || 'Test Alert',
    message: overrides.message || 'Test alert message',
    source: overrides.source || 'test',
    status: overrides.status || 'unread',
    ...overrides,
  });
};

export const createIncident = async (userId, overrides = {}) => {
  return await SecurityIncident.create({
    userId,
    threatType: overrides.threatType || 'Malware',
    severity: overrides.severity || 'High',
    status: overrides.status || 'open',
    description: overrides.description || 'Test incident',
    ...overrides,
  });
};

export const createScan = async (userId, overrides = {}) => {
  return await ScanHistory.create({
    user: userId,
    type: overrides.type || 'url',
    input: overrides.input || 'http://test.com',
    riskScore: overrides.riskScore ?? 50,
    verdict: overrides.verdict || 'suspicious',
    details: overrides.details || {},
    ...overrides,
  });
};

export const createAgentMemory = async (userId, overrides = {}) => {
  return await AgentMemory.create({
    user: userId,
    device: overrides.device || 'test-device',
    location: overrides.location || 'test-location',
    overallRisk: overrides.overallRisk ?? 0,
    recentScans: overrides.recentScans || [],
    assessments: overrides.assessments || [],
    ...overrides,
  });
};

export const createResponse = async (userId, incidentId, overrides = {}) => {
  return await IncidentResponse.create({
    userId,
    incidentId,
    threatType: overrides.threatType || 'Malware',
    mitreTechnique: overrides.mitreTechnique || {},
    investigationSummary: overrides.investigationSummary || 'Test investigation',
    recommendedActions: overrides.recommendedActions || [],
    priority: overrides.priority || 'Medium',
    status: overrides.status || 'pending',
    confidenceScore: overrides.confidenceScore ?? 0.5,
    aiProvider: overrides.aiProvider || 'none',
    ...overrides,
  });
};
