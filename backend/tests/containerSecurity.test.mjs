import { jest } from '@jest/globals';
import mongoose from 'mongoose';
import request from 'supertest';
import { initDB, cleanupDB, createTestUser, seedAdmin } from './bootstrap.mjs';

import { scanDockerImage, scanRunningContainers, scanComposeFile, getContainerImages, getContainerSecurityMetrics, scanForSecrets, scanDockerfile, checkDockerAvailable, checkKubectlAvailable, calculateImageRiskScore, getContainerRiskLevel } from '../src/services/cloud/containerScanner.js';
import { scanKubernetesCluster, discoverClusters, isKubernetesAvailable, getKubernetesMetrics, getKubernetesResources as getK8sResources } from '../src/services/cloud/kubernetesScanner.js';
import { runCloudScan } from '../src/services/cloud/cloudScanner.js';
import os from 'os';
import fs from 'fs';
import path from 'path';

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

describe('Container Scanner', () => {
  test('scanForSecrets detects known secret patterns', async () => {
    const testContent = 'password=supersecret123\napi_key=AKIAIOSFODNN7EXAMPLE\nprivate_key=-----BEGIN RSA PRIVATE KEY-----\ntoken=bearer abcdefghijklmnopqrstuvwxyz1234567890';
    const secrets = await scanForSecrets(testContent);
    expect(Array.isArray(secrets)).toBe(true);
    expect(secrets.length).toBeGreaterThan(0);
    expect(secrets.some((s) => s.type === 'AWS Access Key')).toBe(true);
    expect(secrets.some((s) => s.type === 'Private Key')).toBe(true);
  });

  test('calculateImageRiskScore returns 0-100 score', () => {
    const vulns = [{ severity: 'Critical' }, { severity: 'High' }];
    const secrets = [{ severity: 'High' }];
    const misconfigs = [{ severity: 'High' }];
    const score = calculateImageRiskScore(vulns, secrets, misconfigs);
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  test('getContainerRiskLevel returns correct levels', () => {
    expect(getContainerRiskLevel(0)).toBe('Low');
    expect(getContainerRiskLevel(30)).toBe('Low');
    expect(getContainerRiskLevel(31)).toBe('Medium');
    expect(getContainerRiskLevel(60)).toBe('Medium');
    expect(getContainerRiskLevel(61)).toBe('High');
    expect(getContainerRiskLevel(80)).toBe('High');
    expect(getContainerRiskLevel(81)).toBe('Critical');
    expect(getContainerRiskLevel(100)).toBe('Critical');
  });

  test('scanDockerfile detects misconfigurations from content', async () => {
    const tmpDir = os.tmpdir();
    const dockerfilePath = path.join(tmpDir, 'Dockerfile.test-misconfig');
    const content = `FROM node
RUN npm install
CMD ["node", "server.js"]`;
    fs.writeFileSync(dockerfilePath, content);

    try {
      const issues = await scanDockerfile(dockerfilePath);
      expect(Array.isArray(issues)).toBe(true);
      expect(issues.some((i) => i.message.includes('USER directive') || i.message.includes('root'))).toBe(true);
      expect(issues.some((i) => i.message.includes('latest tag'))).toBe(true);
    } finally {
      fs.unlinkSync(dockerfilePath);
    }
  });

  test('checkDockerAvailable returns boolean', async () => {
    const result = await checkDockerAvailable();
    expect(typeof result).toBe('boolean');
  });

  test('checkKubectlAvailable returns boolean', async () => {
    const result = await checkKubectlAvailable();
    expect(typeof result).toBe('boolean');
  });
});

describe('Container Image Scanning', () => {
  test('scanDockerImage creates a ContainerImage record', async () => {
    const result = await scanDockerImage('nginx:latest', null);
    expect(result).toBeDefined();
    expect(result).toHaveProperty('imageName');
    expect(result).toHaveProperty('riskScore');
    expect(result).toHaveProperty('riskLevel');
    expect(result).toHaveProperty('vulnerabilities');
  });

  test('Scanned image is persisted in MongoDB', async () => {
    await scanDockerImage('alpine:3.18', null);
    const ContainerImage = (await import('../src/models/ContainerImage.js')).default;
    const image = await ContainerImage.findOne({ imageName: 'alpine' });
    expect(image).toBeDefined();
    expect(image.vulnerabilities).toBeDefined();
    expect(image.riskScore).toBeGreaterThanOrEqual(0);
  });
});

describe('Running Container Scanning', () => {
  test('scanRunningContainers returns container list', async () => {
    const result = await scanRunningContainers(null);
    expect(result).toHaveProperty('containers');
    expect(result).toHaveProperty('findings');
    expect(result).toHaveProperty('dockerAvailable');
    expect(Array.isArray(result.containers)).toBe(true);
    expect(Array.isArray(result.findings)).toBe(true);
  });
});

describe('Docker Compose Scanning', () => {
  test('scanComposeFile detects misconfigurations', async () => {
    const tmpPath = path.join(os.tmpdir(), 'docker-compose-test.json');
    const composeContent = JSON.stringify({
      services: {
        web: {
          image: 'nginx:latest',
          privileged: true,
          ports: ['0.0.0.0:8080:80'],
        },
      },
    });
    fs.writeFileSync(tmpPath, composeContent);

    try {
      const result = await scanComposeFile(tmpPath, null);
      expect(result).toHaveProperty('filePath');
      expect(result).toHaveProperty('issues');
      expect(Array.isArray(result.issues)).toBe(true);
      expect(result.issues.some((i) => i.category === 'privileged_containers')).toBe(true);
    } finally {
      fs.unlinkSync(tmpPath);
    }
  });
});

describe('Container Security Metrics', () => {
  test('getContainerSecurityMetrics returns aggregate metrics', async () => {
    await scanDockerImage('redis:7-alpine', null);
    const metrics = await getContainerSecurityMetrics();
    expect(metrics).toHaveProperty('totalImages');
    expect(metrics).toHaveProperty('highRiskImages');
    expect(metrics).toHaveProperty('criticalVulnerabilities');
    expect(metrics).toHaveProperty('totalSecretsFound');
    expect(metrics).toHaveProperty('totalMisconfigurations');
    expect(metrics).toHaveProperty('averageRisk');
    expect(metrics).toHaveProperty('riskDistribution');
  });
});

describe('Container Images API', () => {
  test('getContainerImages returns paginated images', async () => {
    await scanDockerImage('postgres:15', null);
    const result = await getContainerImages({ page: 1, limit: 10 });
    expect(result).toHaveProperty('images');
    expect(result).toHaveProperty('total');
    expect(Array.isArray(result.images)).toBe(true);
  });
});

describe('Kubernetes Scanner', () => {
  test('discoverClusters returns clusters', async () => {
    const clusters = await discoverClusters();
    expect(Array.isArray(clusters)).toBe(true);
    expect(clusters.length).toBeGreaterThan(0);
    expect(clusters[0]).toHaveProperty('clusterName');
  });

  test('isKubernetesAvailable returns boolean', async () => {
    const result = await isKubernetesAvailable();
    expect(typeof result).toBe('boolean');
  });

  test('scanKubernetesCluster returns skipped when no cluster is available', async () => {
    const result = await scanKubernetesCluster({ clusterName: 'test-cluster' });
    expect(result).toHaveProperty('status', 'skipped');
    expect(result).toHaveProperty('message', 'Kubernetes cluster unavailable - scan skipped');
  });

  test('scanKubernetesCluster does not throw when cluster is unavailable', async () => {
    await expect(scanKubernetesCluster({ clusterName: 'test-cluster' })).resolves.toBeDefined();
  });
});

describe('K8s Metrics', () => {
  test('getKubernetesMetrics returns aggregate metrics', async () => {
    const metrics = await getKubernetesMetrics();
    expect(metrics).toHaveProperty('totalResources');
    expect(metrics).toHaveProperty('clusterCount');
    expect(metrics).toHaveProperty('highRiskResources');
    expect(metrics).toHaveProperty('criticalPods');
    expect(metrics).toHaveProperty('privilegedPods');
    expect(metrics).toHaveProperty('findingsByCategory');
    expect(metrics).toHaveProperty('resourceKindDistribution');
  });
});

describe('Kubernetes Resources API', () => {
  test('getK8sResources returns paginated resources', async () => {
    await scanKubernetesCluster({ clusterName: 'test-cluster-2' });
    const result = await getK8sResources({ page: 1, limit: 20, clusterName: 'test-cluster-2' });
    expect(result).toHaveProperty('resources');
    expect(result).toHaveProperty('total');
    expect(Array.isArray(result.resources)).toBe(true);
  });
});

describe('Container Security API Endpoints', () => {
  test('POST /api/container-security/scan/image scans an image', async () => {
    const res = await request(app).post('/api/container-security/scan/image').set({ Authorization: `Bearer ${adminToken}` }).send({ imageName: 'redis:7-alpine' });
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('POST /api/container-security/scan/containers returns running containers', async () => {
    const res = await request(app).post('/api/container-security/scan/containers').set({ Authorization: `Bearer ${adminToken}` });
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('containers');
    expect(res.body.data).toHaveProperty('findings');
  });

  test('POST /api/container-security/k8s/scan returns skipped when no cluster', async () => {
    const res = await request(app).post('/api/container-security/k8s/scan').set({ Authorization: `Bearer ${adminToken}` }).send({ clusterName: 'test-cluster-api' });
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('skipped');
  });

  test('GET /api/container-security/k8s/clusters returns clusters', async () => {
    const res = await request(app).get('/api/container-security/k8s/clusters').set({ Authorization: `Bearer ${adminToken}` });
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  test('GET /api/container-security/k8s/resources returns resources', async () => {
    await scanKubernetesCluster({ clusterName: 'test-cluster' });
    const res = await request(app).get('/api/container-security/k8s/resources').set({ Authorization: `Bearer ${adminToken}` });
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('resources');
  });

  test('GET /api/container-security/k8s/metrics returns metrics', async () => {
    await scanKubernetesCluster({ clusterName: 'test-cluster' });
    const res = await request(app).get('/api/container-security/k8s/metrics').set({ Authorization: `Bearer ${adminToken}` });
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('totalResources');
  });

  test('GET /api/container-security/images returns images', async () => {
    await scanDockerImage('nginx:latest', null);
    const res = await request(app).get('/api/container-security/images').set({ Authorization: `Bearer ${adminToken}` });
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('images');
  });

  test('GET /api/container-security/metrics returns container metrics', async () => {
    const res = await request(app).get('/api/container-security/metrics').set({ Authorization: `Bearer ${adminToken}` });
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('totalImages');
  });

  test('GET /api/container-security/dashboard returns combined metrics', async () => {
    await scanDockerImage('nginx:latest', null);
    await scanKubernetesCluster({ clusterName: 'test-cluster' });
    const res = await request(app).get('/api/container-security/dashboard').set({ Authorization: `Bearer ${adminToken}` });
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('containers');
    expect(res.body.data).toHaveProperty('kubernetes');
  });

  test('Container endpoints require authentication', async () => {
    const res = await request(app).get('/api/container-security/images');
    expect(res.statusCode).toBe(401);
  });

  test('POST /api/container-security/scan/compose validates input', async () => {
    const res = await request(app).post('/api/container-security/scan/compose').set({ Authorization: `Bearer ${adminToken}` }).send({});
    expect(res.statusCode).toBe(400);
  });
});

describe('Encryption', () => {
  test('encrypt/decrypt roundtrip works', async () => {
    const { encrypt, decrypt } = await import('../src/utils/encryption.js');
    const original = 'my-secret-api-key-12345';
    const encrypted = encrypt(original);
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(original);
    expect(encrypted).not.toBe(original);
  });

  test('encrypted cloud provider credentials are stored encrypted', async () => {
    const CloudProvider = (await import('../src/models/CloudProvider.js')).default;
    const provider = await CloudProvider.create({
      name: 'Encryption Test',
      provider: 'aws',
      accountId: 'enc-test-999',
      accountName: 'Encryption Test Account',
      region: 'us-east-1',
      credentials: { accessKeyId: 'AKIATEST', secretAccessKey: 'super-secret-key-12345' },
      status: 'connected',
    });
    const raw = await CloudProvider.findById(provider._id).select('+credentials.secretAccessKey').lean({ getters: false });
    expect(raw.credentials.secretAccessKey).not.toBe('super-secret-key-12345');
    expect(raw.credentials.secretAccessKey).toContain(':');
    await CloudProvider.findByIdAndDelete(provider._id);
  });
});

describe('Security Audit Log', () => {
  test('Cloud scan actions are audit logged', async () => {
    const SecurityAuditLog = (await import('../src/models/SecurityAuditLog.js')).default;
    await runCloudScan('aws');
    const logs = await SecurityAuditLog.find({ action: 'cloud_scan', provider: 'aws' });
    expect(logs.length).toBeGreaterThan(0);
  });

  test('Container scan actions are audit logged', async () => {
    const SecurityAuditLog = (await import('../src/models/SecurityAuditLog.js')).default;
    await scanDockerImage('alpine:3.18', adminUserId);
    const logs = await SecurityAuditLog.find({ resourceType: 'container' });
    expect(logs.length).toBeGreaterThan(0);
  });
});
