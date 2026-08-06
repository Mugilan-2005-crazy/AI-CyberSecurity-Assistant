import { jest } from '@jest/globals';
import mongoose from 'mongoose';
import { initDB, cleanupDB, createTestUser, createIncident, createTestUser as bootstrapCreateUser } from './bootstrap.mjs';
import {
  createOrUpdateEntity,
  createRelationship,
  buildGraphFromUserData,
  buildCloudSubgraph,
  getGraph,
  getEntityDetails,
  searchGraph,
  deleteEntity,
  clearUserGraph,
} from '../src/services/knowledgeGraphService.js';

const JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret';

let testUser, testIncident, authToken;

beforeAll(async () => {
  await initDB();
  testUser = await bootstrapCreateUser({ email: 'graph@test.com', password: 'testpass123', role: 'security_manager' });
  testIncident = await createIncident(testUser._id, { threatType: 'Malware', severity: 'High' });
  const { default: jwt } = await import('jsonwebtoken');
  authToken = jwt.sign({ sub: testUser._id.toString(), email: testUser.email, role: testUser.role }, JWT_SECRET, { expiresIn: '1h' });
});

afterAll(async () => {
  await cleanupDB();
});

describe('Knowledge Graph Service', () => {
  test('createOrUpdateEntity creates entity', async () => {
    const entity = await createOrUpdateEntity('IP', '192.168.1.1', 'Test IP', { country: 'US' }, testUser._id.toString(), 80, 'High');
    expect(entity).toBeDefined();
    expect(entity.entityId).toBe('192.168.1.1');
    expect(entity.entityType).toBe('IP');
  });

  test('createRelationship creates relationship', async () => {
    const source = await createOrUpdateEntity('IP', '10.0.0.1', 'Source IP', {}, testUser._id.toString());
    const target = await createOrUpdateEntity('Domain', 'evil.com', 'Evil Domain', {}, testUser._id.toString());
    
    const rel = await createRelationship(source.entityId, target.entityId, 'communicates_with', 80, 0.9, testUser._id.toString());
    expect(rel).toBeDefined();
    expect(rel.sourceEntityId).toBe(source.entityId);
    expect(rel.targetEntityId).toBe(target.entityId);
  });

  test('buildGraphFromUserData creates entities from user data', async () => {
    const result = await buildGraphFromUserData(testUser._id.toString());
    expect(result.success).toBe(true);
    expect(result.entityCount).toBeGreaterThan(0);
  });

  test('getGraph returns nodes and edges', async () => {
    const graph = await getGraph(testUser._id.toString());
    expect(graph.nodes).toBeDefined();
    expect(graph.edges).toBeDefined();
    expect(Array.isArray(graph.nodes)).toBe(true);
  });

  test('searchGraph finds entities by label', async () => {
    const results = await searchGraph(testUser._id.toString(), 'Malware');
    expect(results.entities).toBeDefined();
    expect(Array.isArray(results.entities)).toBe(true);
  });

  test('deleteEntity removes entity and relationships', async () => {
    const entity = await createOrUpdateEntity('Vulnerability', 'test-delete-1', 'Test Delete', {}, testUser._id.toString());
    const result = await deleteEntity(entity.entityId, testUser._id.toString());
    expect(result.success).toBe(true);
  });

  test('clearUserGraph removes all user graph data', async () => {
    await createOrUpdateEntity('Vulnerability', 'test-clear-1', 'Test Clear', {}, testUser._id.toString());
    const result = await clearUserGraph(testUser._id.toString());
    expect(result.success).toBe(true);
  });

  test('buildCloudSubgraph creates entities and relationships from cloud data', async () => {
    const CloudProvider = (await import('../src/models/CloudProvider.js')).default;
    const CloudResource = (await import('../src/models/CloudResource.js')).default;
    const CloudFinding = (await import('../src/models/CloudFinding.js')).default;
    const ThreatIntel = (await import('../src/models/ThreatIntel.js')).default;

    const provider = await CloudProvider.create({
      provider: 'aws',
      accountId: '123456789012',
      name: 'Test AWS Account',
      region: 'us-east-1',
      status: 'connected',
      riskScore: 30,
    });

    const resource = await CloudResource.create({
      cloudProvider: 'aws',
      providerAccountId: '123456789012',
      resourceId: 'i-1234567890abcdef0',
      name: 'Test EC2 Instance',
      resourceType: 'ec2_instance',
      region: 'us-east-1',
      riskScore: 85,
      isPublic: false,
      tags: {},
    });

    const finding = await CloudFinding.create({
      cloudProvider: 'aws',
      providerAccountId: '123456789012',
      resourceId: 'i-1234567890abcdef0',
      checkId: 'aws_ec2_public_ip',
      checkName: 'EC2 Instance has public IP',
      checkCategory: 'network_misconfiguration',
      severity: 'High',
      title: 'Public IP detected',
      description: 'Instance has a public IP address',
      recommendation: 'Remove public IP',
    });

    await ThreatIntel.create({
      ioc: '192.168.1.1',
      iocType: 'ip',
      classification: 'malicious',
      reputationScore: 90,
    });

    const result = await buildCloudSubgraph(testUser._id.toString());
    expect(result.success).toBe(true);
    expect(result.providers).toBeGreaterThanOrEqual(1);
    expect(result.resources).toBeGreaterThanOrEqual(1);
  });
});
