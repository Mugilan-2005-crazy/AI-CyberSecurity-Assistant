process.env.NODE_ENV = 'test';
process.env.ADMIN_PASSWORD = 'testpass123';
process.env.ADMIN_EMAIL = 'admin@test.com';
process.env.ADMIN_NAME = 'Test Admin';
process.env.JWT_SECRET = 'test_jwt_secret';
process.env.JWT_REFRESH_SECRET = 'test_refresh_secret';
process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/cybersec_test';
process.env.CLIENT_ORIGIN = 'http://localhost';
process.env.PORT = '5001';
process.env.API_PREFIX = '/api';
process.env.VIRUSTOTAL_API_KEY = '';
process.env.ABUSEIPDB_API_KEY = '';
process.env.OTX_API_KEY = '';
process.env.NVD_API_KEY = '';
process.env.GEMINI_API_KEY = '';
process.env.OLLAMA_URL = 'http://localhost:11434';
process.env.OLLAMA_TIMEOUT = '1000';

process.env.AWS_ACCESS_KEY_ID = '';
process.env.AWS_SECRET_ACCESS_KEY = '';
process.env.AWS_DEFAULT_REGION = 'us-east-1';
process.env.AZURE_TENANT_ID = '';
process.env.AZURE_CLIENT_ID = '';
process.env.AZURE_CLIENT_SECRET = '';
process.env.AZURE_SUBSCRIPTION_ID = '';
process.env.GCP_PROJECT_ID = '';
process.env.CLOUD_SCAN_TIMEOUT = '60000';
process.env.KUBECONFIG = '';
process.env.K8S_IN_CLUSTER = 'false';
process.env.DOCKER_HOST = 'unix:///var/run/docker.sock';

import { connectDB } from '../src/config/db.js';
import User from '../src/models/User.js';
import Notification from '../src/models/Notification.js';
import SecurityAlert from '../src/models/SecurityAlert.js';
import SecurityIncident from '../src/models/SecurityIncident.js';
import IncidentResponse from '../src/models/IncidentResponse.js';
import ScanHistory from '../src/models/ScanHistory.js';
import AgentMemory from '../src/models/AgentMemory.js';

export const initDB = async () => {
  const mongoose = (await import('mongoose')).default;
  // If already connected, just drop the database for a fresh start
  if (mongoose.connection.readyState === 1) {
    try {
      await mongoose.connection.dropDatabase();
    } catch (e) {
      // ignore drop errors
    }
    return;
  }
  await connectDB();
};

export const cleanupDB = async () => {
  try {
    const mongoose = (await import('mongoose')).default;
    // Drop all data but keep the connection open for the next test file
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.dropDatabase();
    }
  } catch (e) {
    // ignore cleanup errors
  }
  // Only stop memory server on final cleanup (not between test files)
  // stopMemoryServer is called in globalTeardown if needed
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
    password: overrides.password || 'P@ssw0rd123!',
    role: overrides.role || 'user',
    isEmailVerified: true,
    ...overrides,
  });
};

export const getAuthToken = async (email, password) => {
  const { default: appModule } = await import('../src/app.js');
  const response = await appModule.post('/api/auth/login').send({ email, password });
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

export const createNotification = async (userId, overrides = {}) => {
  return await Notification.create({
    user: userId,
    title: overrides.title || 'Test Notification',
    message: overrides.message || 'Test notification message',
    type: overrides.type || 'info',
    category: overrides.category || 'system',
    severity: overrides.severity || 'low',
    read: overrides.read ?? false,
    metadata: overrides.metadata || {},
    ...overrides,
  });
};