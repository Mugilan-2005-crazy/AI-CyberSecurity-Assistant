import { getAllConnectors, createConnector } from './cloudProviderFactory.js';
import mongoose from 'mongoose';
import CloudProvider from '../../models/CloudProvider.js';
import CloudFinding from '../../models/CloudFinding.js';
import CloudResource from '../../models/CloudResource.js';
import config from '../../config/index.js';
import logger from '../../utils/logger.js';
import { getIoInstance } from '../../socket/socketServer.js';

const CHECK_CATEGORIES = [
  'iam_misconfiguration',
  'privilege_escalation',
  'inactive_keys',
  'unused_privileges',
  'weak_policies',
  'secrets_exposure',
  'public_storage',
  'network_misconfiguration',
  'open_security_groups',
  'firewall_issues',
  'compliance_violations',
];

const SEVERITY_RISK_SCORES = {
  Low: 25,
  Medium: 50,
  High: 75,
  Critical: 95,
};

const emitSocketEvent = (event, data) => {
  try {
    const io = getIoInstance();
    if (io) {
      io.to('admin-room').emit(event, data);
    }
  } catch (err) {
    logger.warn('[cloudScanner] Socket emit failed', { error: err.message });
  }
};

async function getProviders() {
  const dbProviders = await CloudProvider.find({ isEnabled: true }).lean();

  const providers = [...dbProviders];

  const envProviders = [
    { provider: 'aws', accountId: 'env-aws', accountName: 'AWS (Simulated)', region: config.cloud.aws.region, credentials: { accessKeyId: config.cloud.aws.accessKeyId, secretAccessKey: config.cloud.aws.secretAccessKey }, fromEnv: true },
    { provider: 'azure', accountId: 'env-azure', accountName: 'Azure (Simulated)', region: 'global', credentials: { tenantId: config.cloud.azure.tenantId, clientId: config.cloud.azure.clientId, clientSecret: config.cloud.azure.clientSecret, subscriptionId: config.cloud.azure.subscriptionId }, fromEnv: true },
    { provider: 'gcp', accountId: 'env-gcp', accountName: 'GCP (Simulated)', region: 'us-central1', credentials: { projectId: config.cloud.gcp.projectId, serviceAccountKey: config.cloud.gcp.keyFile }, fromEnv: true },
  ];

  const dbAccountIds = new Set(dbProviders.map((p) => `${p.provider}:${p.accountId}`));
  for (const envProvider of envProviders) {
    const key = `${envProvider.provider}:${envProvider.accountId}`;
    if (!dbAccountIds.has(key)) {
      providers.push(envProvider);
    }
  }

  return providers;
}

async function runScanOnProvider(providerConfig) {
  logger.info('[cloudScanner] Starting scan on provider', { provider: providerConfig.provider, accountId: providerConfig.accountId });
  emitSocketEvent('cloud.scan.started', { provider: providerConfig.provider, accountId: providerConfig.accountId, accountName: providerConfig.accountName, timestamp: new Date().toISOString() });
  await auditLog('cloud_scan', { provider: providerConfig.provider, accountId: providerConfig.accountId, status: true });

  try {
    const connector = createConnector(
      providerConfig.provider,
      providerConfig.credentials,
      providerConfig.accountId,
      providerConfig.accountName,
      providerConfig.region
    );

    await connector.connect();
    const findings = await connector.scan();

    const savedFindings = [];
    for (const finding of findings) {
      const saved = await CloudFinding.findOneAndUpdate(
        { cloudProvider: providerConfig.provider, checkId: finding.checkId, resourceId: finding.resourceId, status: { $in: ['open', 'in_progress'] } },
        {
          $set: {
            cloudProvider: providerConfig.provider,
            providerAccountId: providerConfig.accountId,
            resourceId: finding.resourceId,
            resourceType: finding.resourceType,
            checkId: finding.checkId,
            checkName: finding.checkName,
            checkCategory: finding.checkCategory,
            severity: finding.severity,
            riskScore: finding.riskScore,
            title: finding.title,
            description: finding.description,
            recommendation: finding.recommendation,
            evidence: finding.evidence,
            status: 'open',
            ...(finding.aiExplanation ? { aiExplanation: finding.aiExplanation } : {}),
          },
          $setOnInsert: { createdAt: new Date() },
        },
        { upsert: true, new: true }
      );
      savedFindings.push(saved);
    }

    const inventory = await connector.getInventory();
    await persistInventory(providerConfig, inventory);

    const riskScore = findings.length > 0 ? Math.min(100, Math.round(findings.reduce((sum, f) => sum + f.riskScore, 0) / findings.length)) : 0;

    if (providerConfig._id) {
      await CloudProvider.findByIdAndUpdate(providerConfig._id, {
        lastScanAt: new Date(),
        lastScanStatus: 'completed',
        riskScore,
        status: 'connected',
      });
    }

    emitSocketEvent('cloud.scan.completed', { provider: providerConfig.provider, accountId: providerConfig.accountId, findingCount: findings.length, riskScore, timestamp: new Date().toISOString() });
    emitSocketEvent('cloud.risk.updated', { provider: providerConfig.provider, accountId: providerConfig.accountId, riskScore, timestamp: new Date().toISOString() });

    await auditLog('cloud_scan', { provider: providerConfig.provider, accountId: providerConfig.accountId, status: true, findings: findings.length, riskScore });

    return { provider: providerConfig.provider, accountId: providerConfig.accountId, findings, riskScore, inventory };
  } catch (err) {
    logger.error('[cloudScanner] Scan failed on provider', { provider: providerConfig.provider, error: err.message });
    emitSocketEvent('cloud.scan.completed', { provider: providerConfig.provider, accountId: providerConfig.accountId, error: err.message, timestamp: new Date().toISOString() });
    await auditLog('cloud_scan', { provider: providerConfig.provider, accountId: providerConfig.accountId, status: false, error: err.message });
    throw err;
  }
}

async function persistInventory(providerConfig, inventory) {
  try {
    if (inventory.iamUsers) {
      for (const user of inventory.iamUsers) {
        await CloudResource.findOneAndUpdate(
          { cloudProvider: providerConfig.provider, resourceType: 'iam_user', resourceId: user.userId || user.id || user.name },
          {
            $set: {
              cloudProvider: providerConfig.provider,
              providerAccountId: providerConfig.accountId,
              resourceType: 'iam_user',
              resourceId: user.userId || user.id || user.name,
              name: user.userName || user.userPrincipalName || user.email,
              region: providerConfig.region,
              properties: user,
              lastScanned: new Date(),
            },
          },
          { upsert: true, new: true }
        );
      }
    }

    if (inventory.s3Buckets) {
      for (const bucket of inventory.s3Buckets) {
        await CloudResource.findOneAndUpdate(
          { cloudProvider: 'aws', resourceType: 's3_bucket', resourceId: bucket.name },
          {
            $set: {
              cloudProvider: 'aws',
              providerAccountId: providerConfig.accountId,
              resourceType: 's3_bucket',
              resourceId: bucket.name,
              name: bucket.name,
              region: bucket.region || providerConfig.region,
              properties: bucket,
              isPublic: bucket.isPublic || false,
              lastScanned: new Date(),
            },
          },
          { upsert: true, new: true }
        );
      }
    }

    if (inventory.storageAccounts) {
      for (const sa of inventory.storageAccounts) {
        await CloudResource.findOneAndUpdate(
          { cloudProvider: 'azure', resourceType: 'storage_account', resourceId: sa.id || sa.name },
          {
            $set: {
              cloudProvider: 'azure',
              providerAccountId: providerConfig.accountId,
              resourceType: 'storage_account',
              resourceId: sa.id || sa.name,
              name: sa.name,
              region: sa.location,
              properties: sa,
              isPublic: sa.properties?.allowBlobPublicAccess || false,
              lastScanned: new Date(),
            },
          },
          { upsert: true, new: true }
        );
      }
    }

    if (inventory.securityGroups) {
      for (const sg of inventory.securityGroups) {
        await CloudResource.findOneAndUpdate(
          { cloudProvider: 'aws', resourceType: 'security_group', resourceId: sg.groupId },
          {
            $set: {
              cloudProvider: 'aws',
              providerAccountId: providerConfig.accountId,
              resourceType: 'security_group',
              resourceId: sg.groupId,
              name: sg.groupName,
              region: providerConfig.region,
              properties: sg,
              lastScanned: new Date(),
            },
          },
          { upsert: true, new: true }
        );
      }
    }

    if (inventory.virtualMachines) {
      for (const vm of inventory.virtualMachines) {
        await CloudResource.findOneAndUpdate(
          { cloudProvider: 'azure', resourceType: 'virtual_machine', resourceId: vm.id || vm.name },
          {
            $set: {
              cloudProvider: 'azure',
              providerAccountId: providerConfig.accountId,
              resourceType: 'virtual_machine',
              resourceId: vm.id || vm.name,
              name: vm.name,
              region: vm.location,
              properties: vm,
              lastScanned: new Date(),
              isPublic: vm.accessConfigs?.some((a) => a.natIP !== '0.0.0.0'),
            },
          },
          { upsert: true, new: true }
        );
      }
    }

    if (inventory.computeInstances) {
      for (const instance of inventory.computeInstances) {
        await CloudResource.findOneAndUpdate(
          { cloudProvider: 'gcp', resourceType: 'compute_instance', resourceId: instance.name },
          {
            $set: {
              cloudProvider: 'gcp',
              providerAccountId: providerConfig.accountId,
              resourceType: 'compute_instance',
              resourceId: instance.name,
              name: instance.name,
              region: instance.zone,
              properties: instance,
              lastScanned: new Date(),
            },
          },
          { upsert: true, new: true }
        );
      }
    }

    if (inventory.storageBuckets) {
      for (const bucket of inventory.storageBuckets) {
        await CloudResource.findOneAndUpdate(
          { cloudProvider: 'gcp', resourceType: 'cloud_storage_bucket', resourceId: bucket.name },
          {
            $set: {
              cloudProvider: 'gcp',
              providerAccountId: providerConfig.accountId,
              resourceType: 'cloud_storage_bucket',
              resourceId: bucket.name,
              name: bucket.name,
              region: bucket.location,
              properties: bucket,
              isPublic: bucket.bindings?.some((b) => b.members?.includes('allUsers')),
              lastScanned: new Date(),
            },
          },
          { upsert: true, new: true }
        );
      }
    }

    if (inventory.networkSecurityGroups) {
      for (const nsg of inventory.networkSecurityGroups) {
        await CloudResource.findOneAndUpdate(
          { cloudProvider: 'azure', resourceType: 'network_security_group', resourceId: nsg.id || nsg.name },
          {
            $set: {
              cloudProvider: 'azure',
              providerAccountId: providerConfig.accountId,
              resourceType: 'network_security_group',
              resourceId: nsg.id || nsg.name,
              name: nsg.name,
              region: providerConfig.region,
              properties: nsg,
              lastScanned: new Date(),
            },
          },
          { upsert: true, new: true }
        );
      }
    }

    if (inventory.firewallRules) {
      for (const rule of inventory.firewallRules) {
        await CloudResource.findOneAndUpdate(
          { cloudProvider: 'gcp', resourceType: 'firewall_rule', resourceId: rule.name },
          {
            $set: {
              cloudProvider: 'gcp',
              providerAccountId: providerConfig.accountId,
              resourceType: 'firewall_rule',
              resourceId: rule.name,
              name: rule.name,
              region: 'global',
              properties: rule,
              lastScanned: new Date(),
            },
          },
          { upsert: true, new: true }
        );
      }
    }
  } catch (err) {
    logger.error('[cloudScanner] Failed to persist inventory', { error: err.message });
  }
}

async function auditLog(action, details) {
  const { default: SecurityAuditLog } = await import('../../models/SecurityAuditLog.js');
  try {
    await SecurityAuditLog.create({
      action,
      resourceType: 'cloud',
      provider: details.provider,
      resourceId: details.accountId,
      status: details.status !== false ? 'success' : 'failure',
      details,
      severity: details.severity || 'Low',
    });
  } catch (err) {
    logger.warn('[cloudScanner] Audit log write failed', { error: err.message });
  }
}

export const runCloudScan = async (providerFilter = null) => {
  logger.info('[cloudScanner] Starting cloud security scan');
  const providers = await getProviders();

  const targets = providerFilter ? providers.filter((p) => p.provider === providerFilter) : providers;

  if (targets.length === 0) {
    logger.warn('[cloudScanner] No cloud providers configured');
    return { providersScanned: 0, totalFindings: 0, results: [] };
  }

  const results = [];
  for (const target of targets) {
    try {
      const result = await runScanOnProvider(target);
      results.push(result);
    } catch (err) {
      logger.error('[cloudScanner] Provider scan failed', { provider: target.provider, error: err.message });
      results.push({ provider: target.provider, accountId: target.accountId, error: err.message, findings: [] });
    }
  }

  const totalFindings = results.reduce((sum, r) => sum + (r.findings?.length || 0), 0);
  const averageRisk = results.reduce((sum, r) => sum + (r.riskScore || 0), 0) / results.length || 0;

  try {
    const { recordCloudActivity } = await import('../ueba/behaviorService.js');
    const systemUserId = new mongoose.Types.ObjectId();
    for (const r of results) {
      if (r.findings && r.findings.length > 0) {
        for (const finding of r.findings) {
          await recordCloudActivity(systemUserId, {
            type: mapFindingTypeToActivity(finding.checkCategory),
            action: finding.title,
            riskScore: finding.riskScore,
            metadata: { provider: r.provider, accountId: r.accountId, checkId: finding.checkId, checkCategory: finding.checkCategory, resourceId: finding.resourceId },
          }).catch((err) => logger.warn('[cloudScanner] UEBA record failed', { error: err.message }));
        }
      }
    }
  } catch (err) {
    logger.warn('[cloudScanner] UEBA integration failed', { error: err.message });
  }

  return {
    providersScanned: results.length,
    totalFindings,
    averageRisk: Math.round(averageRisk),
    results,
  };
};

function mapFindingTypeToActivity(category) {
  switch (category) {
    case 'iam_misconfiguration': return 'iam_abuse';
    case 'privilege_escalation': return 'privilege_escalation';
    case 'inactive_keys': return 'iam_abuse';
    case 'unused_privileges': return 'iam_abuse';
    case 'weak_policies': return 'iam_abuse';
    case 'secrets_exposure': return 'service_account_abuse';
    case 'public_storage': return 'cloud_api_call';
    case 'network_misconfiguration': return 'cloud_api_call';
    case 'open_security_groups': return 'cloud_api_call';
    default: return 'cloud_api_call';
  }
}

export const getCloudFindings = async (filters = {}) => {
  const query = {};
  if (filters.severity) query.severity = filters.severity;
  if (filters.status) query.status = filters.status;
  if (filters.checkCategory) query.checkCategory = filters.checkCategory;
  if (filters.provider) query.cloudProvider = filters.provider;

  const findings = await CloudFinding.find(query)
    .sort({ createdAt: -1 })
    .skip((Number(filters.page || 1) - 1) * Number(filters.limit || 50))
    .limit(Number(filters.limit || 50));

  const total = await CloudFinding.countDocuments(query);

  return {
    findings: findings.map((f) => ({
      id: f._id,
      cloudProvider: f.cloudProvider,
      checkId: f.checkId,
      checkName: f.checkName,
      checkCategory: f.checkCategory,
      severity: f.severity,
      riskScore: f.riskScore,
      title: f.title,
      description: f.description,
      recommendation: f.recommendation,
      evidence: f.evidence,
      status: f.status,
      resourceId: f.resourceId,
      resourceType: f.resourceType,
      createdAt: f.createdAt,
      updatedAt: f.updatedAt,
      aiExplanation: f.aiExplanation,
    })),
    total,
    page: Number(filters.page || 1),
    totalPages: Math.ceil(total / Number(filters.limit || 50)),
  };
};

export const getCloudSecurityMetrics = async () => {
  const providers = await CloudProvider.find({ isEnabled: true }).lean();
  const allFindings = await CloudFinding.find({}).lean();
  const allResources = await CloudResource.find({}).lean();

  const providerMetrics = {};
  for (const provider of providers) {
    const providerFindings = allFindings.filter((f) => f.cloudProvider === provider.provider);
    const providerResources = allResources.filter((r) => r.cloudProvider === provider.provider);
    const criticalFindings = providerFindings.filter((f) => f.severity === 'Critical');
    const highFindings = providerFindings.filter((f) => f.severity === 'High');
    const openFindings = providerFindings.filter((f) => f.status === 'open' || f.status === 'in_progress');
    const openRate = providerFindings.length > 0 ? Math.round((openFindings.length / providerFindings.length) * 100) : 0;
    const providerRisk = providerFindings.length > 0 ? Math.round(providerFindings.reduce((sum, f) => sum + f.riskScore, 0) / providerFindings.length) : 0;

    providerMetrics[provider.provider] = {
      accountId: provider.accountId,
      accountName: provider.name,
      riskScore: providerRisk,
      resourceCount: providerResources.length,
      findingCount: providerFindings.length,
      criticalFindings: criticalFindings.length,
      highFindings: highFindings.length,
      openFindings: openFindings.length,
      openRate,
      status: provider.status,
      lastScanAt: provider.lastScanAt,
    };
  }

  const severityDistribution = {
    Critical: allFindings.filter((f) => f.severity === 'Critical').length,
    High: allFindings.filter((f) => f.severity === 'High').length,
    Medium: allFindings.filter((f) => f.severity === 'Medium').length,
    Low: allFindings.filter((f) => f.severity === 'Low').length,
  };

  const categoryDistribution = {};
  for (const finding of allFindings) {
    categoryDistribution[finding.checkCategory] = (categoryDistribution[finding.checkCategory] || 0) + 1;
  }

  const complianceScore = allFindings.length > 0 ? Math.round(((allFindings.length - allFindings.filter((f) => f.status === 'open' || f.status === 'in_progress').length) / allFindings.length) * 100) : 100;

  return {
    overallRiskScore: Math.round(allFindings.reduce((sum, f) => sum + f.riskScore, 0) / allFindings.length) || 0,
    complianceScore,
    totalFindings: allFindings.length,
    totalResources: allResources.length,
    severityDistribution,
    categoryDistribution,
    providerMetrics,
    providers: providers.map((p) => ({ id: p._id, name: p.name, provider: p.provider, accountId: p.accountId, status: p.status, riskScore: p.riskScore })),
  };
};

export const updateFindingStatus = async (findingId, status, userId) => {
  const finding = await CloudFinding.findById(findingId);
  if (!finding) {
    throw new Error('Finding not found');
  }

  finding.status = status;
  if (status === 'resolved' || status === 'false_positive') {
    finding.resolvedAt = new Date();
    finding.resolvedBy = userId;
  } else if (status === 'in_progress') {
    finding.assignedTo = userId;
  }

  await finding.save();
  await auditLog('finding_update', { findingId, status, userId, provider: finding.cloudProvider });
  emitSocketEvent('cloud.finding.updated', { findingId, status, provider: finding.cloudProvider });

  return finding;
};

export const addCloudProvider = async (providerData, userId) => {
  const { provider, accountId, accountName, region, credentials } = providerData;
  const existing = await CloudProvider.findOne({ provider, accountId });
  if (existing) {
    throw new Error(`Cloud provider ${provider} with account ${accountId} already exists`);
  }

  const cloudProvider = await CloudProvider.create({
    name: accountName || `${provider}-${accountId}`,
    provider,
    accountId,
    accountName,
    region,
    credentials,
    status: 'pending',
    addedBy: userId,
  });

  await cloudProvider.save();

  const connector = createConnector(provider, credentials, accountId, accountName, region);
  const connectResult = await connector.connect();

  if (connectResult.connected) {
    cloudProvider.status = 'connected';
  } else {
    cloudProvider.status = 'connected';
    cloudProvider.metadata = { mode: connectResult.mode, ...cloudProvider.metadata };
  }
  await cloudProvider.save();

  await auditLog('cloud_provider_add', { provider, accountId, userId, status: true });
  emitSocketEvent('cloud.provider.added', { provider, accountId });

  return cloudProvider;
};

export const getCloudProviders = async () => {
  return CloudProvider.find({}).sort({ provider: 1, createdAt: -1 }).lean();
};

export const removeCloudProvider = async (providerId, userId) => {
  const provider = await CloudProvider.findByIdAndDelete(providerId);
  if (!provider) {
    throw new Error('Cloud provider not found');
  }
  await auditLog('cloud_provider_remove', { providerId, userId, provider: provider.provider });
  emitSocketEvent('cloud.provider.removed', { provider: provider.provider, accountId: provider.accountId });
  return provider;
};

export { CHECK_CATEGORIES, SEVERITY_RISK_SCORES };
export default { runCloudScan, getCloudFindings, getCloudSecurityMetrics, updateFindingStatus, addCloudProvider, getCloudProviders, removeCloudProvider };
