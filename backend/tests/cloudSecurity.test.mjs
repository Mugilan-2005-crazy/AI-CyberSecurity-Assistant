import { jest } from '@jest/globals';
import mongoose from 'mongoose';
import request from 'supertest';
import { initDB, cleanupDB, createTestUser, seedAdmin } from './bootstrap.mjs';

import { runCloudScan, getCloudFindings, getCloudSecurityMetrics, addCloudProvider, getCloudProviders } from '../src/services/cloud/cloudScanner.js';
import { generateCloudRiskScore, generateCloudExecutiveSummary, generateFullCloudAnalysis } from '../src/services/cloud/aiCloudAnalysis.js';
import { discoverClusters, scanKubernetesCluster, isKubernetesAvailable, getKubernetesMetrics, getKubernetesResources } from '../src/services/cloud/kubernetesScanner.js';

let adminToken, adminUser, adminUserId;
let app;

const JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret';

beforeAll(async () => {
  await initDB();
  adminUser = await seedAdmin();
  adminUserId = adminUser._id.toString();
  const { default: jwt } = await import('jsonwebtoken');
  adminToken = jwt.sign({ sub: adminUserId, email: adminUser.email, role: adminUser.role }, JWT_SECRET, { expiresIn: '1h' });
  app = (await import('../src/app.js')).default;
});

afterAll(async () => {
  await cleanupDB();
});

describe('Cloud Connectors', () => {
  test('AWS connector runs scan and returns findings', async () => {
    const AWSConnector = (await import('../src/services/cloud/awsConnector.js')).default;
    const connector = new AWSConnector({
      provider: 'aws',
      accountId: 'test-account-123',
      accountName: 'Test AWS Account',
      region: 'us-east-1',
      credentials: { accessKeyId: 'test-key', secretAccessKey: 'test-secret' },
    });

    const result = await connector.connect();
    expect(result).toHaveProperty('connected');
    expect(result).toHaveProperty('mode');

    const findings = await connector.scan();
    expect(Array.isArray(findings)).toBe(true);
    expect(findings.length).toBeGreaterThan(0);

    const inventory = await connector.getInventory();
    expect(inventory).toHaveProperty('iamUsers');
    expect(inventory).toHaveProperty('s3Buckets');
    expect(inventory).toHaveProperty('securityGroups');
    expect(inventory).toHaveProperty('ec2Instances');
    expect(inventory).toHaveProperty('cloudTrails');
  });

  test('Azure connector runs scan and returns findings', async () => {
    const AzureConnector = (await import('../src/services/cloud/azureConnector.js')).default;
    const connector = new AzureConnector({
      provider: 'azure',
      accountId: 'test-subscription-123',
      accountName: 'Test Azure Subscription',
      region: 'global',
      credentials: { tenantId: 'test-tenant', clientId: 'test-client', clientSecret: 'test-secret', subscriptionId: 'test-sub' },
    });

    await connector.connect();
    const findings = await connector.scan();
    expect(Array.isArray(findings)).toBe(true);
    expect(findings.length).toBeGreaterThan(0);

    const inventory = await connector.getInventory();
    expect(inventory).toHaveProperty('iamUsers');
    expect(inventory).toHaveProperty('storageAccounts');
    expect(inventory).toHaveProperty('networkSecurityGroups');
    expect(inventory).toHaveProperty('defenderSettings');
  });

  test('GCP connector runs scan and returns findings', async () => {
    const GCPConnector = (await import('../src/services/cloud/gcpConnector.js')).default;
    const connector = new GCPConnector({
      provider: 'gcp',
      accountId: 'test-project-123',
      accountName: 'Test GCP Project',
      region: 'us-central1',
      credentials: { projectId: 'test-project', serviceAccountKey: '{}' },
    });

    await connector.connect();
    const findings = await connector.scan();
    expect(Array.isArray(findings)).toBe(true);
    expect(findings.length).toBeGreaterThan(0);

    const inventory = await connector.getInventory();
    expect(inventory).toHaveProperty('iamUsers');
    expect(inventory).toHaveProperty('serviceAccounts');
    expect(inventory).toHaveProperty('computeInstances');
    expect(inventory).toHaveProperty('storageBuckets');
    expect(inventory).toHaveProperty('firewallRules');
    expect(inventory).toHaveProperty('securityCommandCenter');
  });

  test('Cloud provider factory creates all three connectors', async () => {
    const factory = await import('../src/services/cloud/cloudProviderFactory.js');
    const awsConnector = factory.createConnector('aws', {}, 'acc1', 'AWS', 'us-east-1');
    const azureConnector = factory.createConnector('azure', {}, 'acc2', 'Azure', 'global');
    const gcpConnector = factory.createConnector('gcp', {}, 'acc3', 'GCP', 'us-central1');

    expect(awsConnector.provider).toBe('aws');
    expect(azureConnector.provider).toBe('azure');
    expect(gcpConnector.provider).toBe('gcp');

    expect(() => factory.createConnector('unknown', {}, 'x', 'x', 'x')).toThrow();
    expect(factory.getAvailableProviders()).toContain('aws');
    expect(factory.getAvailableProviders()).toContain('azure');
    expect(factory.getAvailableProviders()).toContain('gcp');
  });
});

describe('Cloud Scanner Engine', () => {
  test('runCloudScan executes scan across providers', async () => {
    const result = await runCloudScan('aws');
    expect(result).toHaveProperty('providersScanned');
    expect(result).toHaveProperty('totalFindings');
    expect(result).toHaveProperty('averageRisk');
    expect(result).toHaveProperty('results');
    expect(Array.isArray(result.results)).toBe(true);
  });

  test('Cloud findings are persisted in MongoDB', async () => {
    await runCloudScan('gcp');
    const CloudFinding = (await import('../src/models/CloudFinding.js')).default;
    const findings = await CloudFinding.find({ cloudProvider: 'gcp' });
    expect(findings.length).toBeGreaterThan(0);

    const finding = findings[0];
    expect(finding).toHaveProperty('checkId');
    expect(finding).toHaveProperty('checkCategory');
    expect(finding).toHaveProperty('severity');
    expect(finding).toHaveProperty('riskScore');
    expect(finding).toHaveProperty('title');
    expect(finding).toHaveProperty('recommendation');
  });

  test('getCloudFindings returns paginated findings', async () => {
    await runCloudScan('aws');
    const result = await getCloudFindings({ page: 1, limit: 10 });
    expect(result).toHaveProperty('findings');
    expect(result).toHaveProperty('total');
    expect(result).toHaveProperty('page');
    expect(result).toHaveProperty('totalPages');
    expect(Array.isArray(result.findings)).toBe(true);
  });

  test('getCloudSecurityMetrics returns provider metrics', async () => {
    await runCloudScan('aws');
    await runCloudScan('azure');
    const metrics = await getCloudSecurityMetrics();
    expect(metrics).toHaveProperty('overallRiskScore');
    expect(metrics).toHaveProperty('totalFindings');
    expect(metrics).toHaveProperty('totalResources');
    expect(metrics).toHaveProperty('severityDistribution');
    expect(metrics).toHaveProperty('providerMetrics');
    expect(metrics).toHaveProperty('providers');
  });

  test('addCloudProvider creates provider in DB', async () => {
    const provider = await addCloudProvider({
      provider: 'aws',
      accountId: 'db-test-account-456',
      accountName: 'DB Test Account',
      region: 'us-west-2',
      credentials: { accessKeyId: 'test-key', secretAccessKey: 'test-secret' },
    }, adminUserId);

    expect(provider).toBeDefined();
    expect(provider.provider).toBe('aws');
    expect(provider.accountId).toBe('db-test-account-456');
    expect(provider.status).toBe('connected');

    const providers = await getCloudProviders();
    expect(providers.some((p) => p.accountId === 'db-test-account-456')).toBe(true);
  });
});

describe('CSPM Check Categories', () => {
  test('IAM misconfiguration findings are generated', async () => {
    await runCloudScan('aws');
    const CloudFinding = (await import('../src/models/CloudFinding.js')).default;
    const iamFindings = await CloudFinding.find({ checkCategory: 'iam_misconfiguration' });
    expect(iamFindings.length).toBeGreaterThan(0);
  });

  test('Inactive keys findings are generated', async () => {
    await runCloudScan('aws');
    const CloudFinding = (await import('../src/models/CloudFinding.js')).default;
    const keyFindings = await CloudFinding.find({ checkCategory: 'inactive_keys' });
    expect(keyFindings.length).toBeGreaterThan(0);
  });

  test('Open security groups findings are generated', async () => {
    await runCloudScan('aws');
    const CloudFinding = (await import('../src/models/CloudFinding.js')).default;
    const sgFindings = await CloudFinding.find({ checkCategory: 'open_security_groups' });
    expect(sgFindings.length).toBeGreaterThan(0);
  });

  test('Public storage findings are generated', async () => {
    await runCloudScan('aws');
    const CloudFinding = (await import('../src/models/CloudFinding.js')).default;
    const storageFindings = await CloudFinding.find({ checkCategory: 'public_storage' });
    expect(storageFindings.length).toBeGreaterThan(0);
  });

  test('Privilege escalation findings are generated', async () => {
    await runCloudScan('azure');
    const CloudFinding = (await import('../src/models/CloudFinding.js')).default;
    const privFindings = await CloudFinding.find({ checkCategory: 'privilege_escalation' });
    expect(privFindings.length).toBeGreaterThan(0);
  });

  test('Unused privileges findings are generated', async () => {
    await runCloudScan('aws');
    const CloudFinding = (await import('../src/models/CloudFinding.js')).default;
    const unusedFindings = await CloudFinding.find({ checkCategory: 'unused_privileges' });
    expect(unusedFindings.length).toBeGreaterThan(0);
  });

  test('Secrets exposure findings are generated', async () => {
    await runCloudScan('aws');
    const CloudFinding = (await import('../src/models/CloudFinding.js')).default;
    const secretFindings = await CloudFinding.find({ checkCategory: 'secrets_exposure' });
    expect(secretFindings.length).toBeGreaterThan(0);
  });

  test('Compliance violation findings are generated', async () => {
    await runCloudScan('azure');
    const CloudFinding = (await import('../src/models/CloudFinding.js')).default;
    const complianceFindings = await CloudFinding.find({ checkCategory: 'compliance_violations' });
    expect(complianceFindings.length).toBeGreaterThan(0);
  });
});

describe('Cloud Security API Endpoints', () => {
  test('GET /api/cloud-security/providers returns providers', async () => {
    const res = await request(app).get('/api/cloud-security/providers').set({ Authorization: `Bearer ${adminToken}` });
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  test('POST /api/cloud-security/scan triggers scan', async () => {
    const res = await request(app).post('/api/cloud-security/scan').set({ Authorization: `Bearer ${adminToken}` }).send({ provider: 'aws' });
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('GET /api/cloud-security/findings returns findings', async () => {
    await runCloudScan('aws');
    await runCloudScan('gcp');
    const res = await request(app).get('/api/cloud-security/findings').set({ Authorization: `Bearer ${adminToken}` });
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('findings');
    expect(res.body.data).toHaveProperty('total');
  });

  test('GET /api/cloud-security/metrics returns metrics', async () => {
    await runCloudScan('aws');
    const res = await request(app).get('/api/cloud-security/metrics').set({ Authorization: `Bearer ${adminToken}` });
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('overallRiskScore');
    expect(res.body.data).toHaveProperty('severityDistribution');
  });

  test('GET /api/cloud-security/risk-score returns risk score', async () => {
    const res = await request(app).get('/api/cloud-security/risk-score').set({ Authorization: `Bearer ${adminToken}` });
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('score');
  });

  test('GET /api/cloud-security/resources returns resources', async () => {
    const res = await request(app).get('/api/cloud-security/resources').set({ Authorization: `Bearer ${adminToken}` });
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('resources');
  });

  test('GET /api/cloud-security/providers/:provider/dashboard returns dashboard', async () => {
    await runCloudScan('aws');
    const res = await request(app).get('/api/cloud-security/providers/aws/dashboard').set({ Authorization: `Bearer ${adminToken}` });
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('summary');
  });

  test('GET /api/cloud-security/findings/:nonexistent returns 404', async () => {
    const res = await request(app).get('/api/cloud-security/findings/000000000000000000000000').set({ Authorization: `Bearer ${adminToken}` });
    expect(res.statusCode).toBe(404);
  });

  test('GET /api/cloud-security/providers requires authentication', async () => {
    const res = await request(app).get('/api/cloud-security/providers');
    expect(res.statusCode).toBe(401);
  });

  test('POST /api/cloud-security/providers creates provider', async () => {
    const res = await request(app).post('/api/cloud-security/providers').set({ Authorization: `Bearer ${adminToken}` }).send({
      provider: 'gcp',
      accountId: 'api-test-gcp-789',
      accountName: 'API Test GCP',
      region: 'us-central1',
      credentials: { projectId: 'test-project', serviceAccountKey: '{}' },
    });
    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
  });
});

describe('AI Cloud Analysis', () => {
  test('generateCloudRiskScore returns score and level', async () => {
    await runCloudScan('aws');
    const result = await generateCloudRiskScore();
    expect(result).toHaveProperty('score');
    expect(result).toHaveProperty('level');
    expect(result).toHaveProperty('breakdown');
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  test('generateFullCloudAnalysis returns structured analysis', async () => {
    await runCloudScan('aws');
    const result = await generateFullCloudAnalysis();
    expect(result).toHaveProperty('provider');
    expect(result).toHaveProperty('analysis');
    expect(result.analysis).toHaveProperty('executiveSummary');
    expect(result.analysis).toHaveProperty('riskScore');
    expect(result.analysis).toHaveProperty('confidenceScore');
    expect(result.analysis).toHaveProperty('remediationPlan');
  });

  test('generateCloudExecutiveSummary returns provider and summary', async () => {
    await runCloudScan('aws');
    const result = await generateCloudExecutiveSummary();
    expect(result).toHaveProperty('provider');
    expect(result).toHaveProperty('summary');
  });
});
