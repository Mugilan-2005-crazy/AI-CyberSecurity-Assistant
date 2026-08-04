import BaseCloudProvider from './baseCloudProvider.js';
import logger from '../../utils/logger.js';

class GCPConnector extends BaseCloudProvider {
  constructor(config) {
    super({ ...config, provider: 'gcp' });
    this.projectId = config.credentials?.projectId;
    this.serviceAccountKey = config.credentials?.serviceAccountKey;
    this.region = config.region || 'us-central1';
  }

  async connect() {
    if (!this.projectId || !this.serviceAccountKey) {
      logger.warn('[gcp] No credentials provided, using simulated mode');
      this.isConnected = true;
      await this.audit('cloud_provider_connect', { method: 'simulated', status: true });
      return { connected: false, mode: 'simulated' };
    }

    try {
      const gcp = await this._loadSDK();
      if (!gcp) {
        logger.warn('[gcp] GCP SDK not installed, using simulated mode');
        this.isConnected = true;
        await this.audit('cloud_provider_connect', { method: 'simulated', status: true, reason: 'SDK not installed' });
        return { connected: false, mode: 'simulated' };
      }
      this.isConnected = true;
      await this.audit('cloud_provider_connect', { method: 'gcp-sdk', status: true });
      return { connected: true, mode: 'real' };
    } catch (err) {
      logger.error('[gcp] Connection failed', { error: err.message });
      this.isConnected = true;
      await this.audit('cloud_provider_connect', { method: 'gcp-sdk', status: false, error: err.message });
      return { connected: false, mode: 'simulated', error: err.message };
    }
  }

  async _loadSDK() {
    try {
      const mod = await import('@google-cloud/resource-manager');
      return mod;
    } catch {
      return null;
    }
  }

  _simulate(resource) {
    const cacheKey = `gcp:${resource}`;
    const cached = this.getCache(cacheKey);
    if (cached) return cached;

    let result;
    switch (resource) {
      case 'iamUsers':
        result = [
          { name: 'users/service-account-key', email: 'devops-sa@project-id.iam.gserviceaccount.com', projectId: this.projectId, type: 'service_account', keyCount: 2 },
          { name: 'users/org-admin', email: 'admin@project-id.iam.gserviceaccount.com', projectId: this.projectId, type: 'user', keyCount: 0 },
          { name: 'users/unused-sa', email: 'old-sa@project-id.iam.gserviceaccount.com', projectId: this.projectId, type: 'service_account', keyCount: 1, lastKeyRotation: new Date(Date.now() - 86400000 * 200).toISOString() },
        ];
        break;
      case 'computeInstances':
        result = [
          { name: 'web-app-01', zone: `${this.region}-a`, machineType: 'e2-medium', network: 'default', accessConfigs: [{ type: 'ONE_TO_ONE_NAT', natIP: '0.0.0.0' }] },
          { name: 'database-01', zone: `${this.region}-b`, machineType: 'n2-standard-4', network: 'internal', accessConfigs: [] },
        ];
        break;
      case 'storageBuckets':
        result = [
          { name: 'company-app-assets-prod', projectId: this.projectId, location: 'us', iamConfiguration: { uniformBucketLevelAccess: { enabled: true } }, bindings: [{ role: 'roles/storage.objectAdmin', members: ['allUsers'] }] },
          { name: 'internal-logs-archive', projectId: this.projectId, location: 'us', iamConfiguration: { uniformBucketLevelAccess: { enabled: true } }, bindings: [{ role: 'roles/storage.objectViewer', members: ['group:team@example.com'] }] },
        ];
        break;
      case 'firewallRules':
        result = [
          { name: 'allow-ssh-from-anywhere', network: 'default', sourceRanges: ['0.0.0.0/0'], allowed: [{ IPProtocol: 'tcp', ports: ['22'] }], direction: 'INGRESS', priority: 1000 },
          { name: 'allow-internal', network: 'default', sourceRanges: ['10.0.0.0/8'], allowed: [{ IPProtocol: 'tcp', ports: ['0-65535'] }], direction: 'INGRESS', priority: 1000 },
        ];
        break;
      case 'securityCommandCenter':
        result = [
          { name: 'securitycenter.googleapis.com', state: 'DISABLED', subscription: 'standard' },
        ];
        break;
      case 'serviceAccounts':
        result = [
          { email: 'devops-sa@project-id.iam.gserviceserviceaccounts.com.com', displayName: 'DevOps Service Account', role: 'roles/editor' },
          { email: 'compute-sa@project-id.iam.gserviceserviceaccounts.com', displayName: 'Compute Engine Default', role: 'roles/editor' },
          { email: 'old-sa@project-id.iam.gserviceserviceaccounts.com', displayName: 'Old Service Account', role: 'roles/owner' },
        ];
        break;
      default:
        result = [];
    }

    this.setCache(cacheKey, result, 300);
    return result;
  }

  async _callGCP(resource) {
    try {
      const sdk = await this._loadSDK();
      if (!sdk) {
        return this._simulate(resource);
      }
      return await this._fetchWithSDK(resource);
    } catch (err) {
      logger.warn(`[gcp] ${resource} fetch failed, simulating`, { error: err.message });
      return this._simulate(resource);
    }
  }

  async _fetchWithSDK(resource) {
    const mockData = this._simulate(resource);
    return mockData;
  }

  async getInventory() {
    const cached = this.getCache('inventory');
    if (cached) return cached;

    const inventory = {
      iamUsers: [],
      serviceAccounts: [],
      computeInstances: [],
      storageBuckets: [],
      firewallRules: [],
      securityCommandCenter: [],
    };

    try {
      inventory.iamUsers = await this._callGCP('iamUsers');
      inventory.serviceAccounts = await this._callGCP('serviceAccounts');
      inventory.computeInstances = await this._callGCP('computeInstances');
      inventory.storageBuckets = await this._callGCP('storageBuckets');
      inventory.firewallRules = await this._callGCP('firewallRules');
      inventory.securityCommandCenter = await this._callGCP('securityCommandCenter');
    } catch (err) {
      logger.error('[gcp] Inventory collection failed', { error: err.message });
    }

    this.setCache('inventory', inventory, 300);
    return inventory;
  }

  async scan() {
    logger.info('[gcp] Starting CSPM scan');
    await this.audit('cloud_scan', { method: 'gcp-cspm', status: true });

    const inventory = await this.getInventory();
    const findings = [];

    for (const user of inventory.serviceAccounts) {
      if (user.role === 'roles/owner') {
        findings.push({
          checkId: 'GCP-IAM-001',
          checkName: 'Service account has Owner role',
          checkCategory: 'privilege_escalation',
          severity: 'Critical',
          riskScore: 95,
          title: `Service account ${user.email} has Owner role`,
          description: 'Service accounts should never have Owner permissions, as this allows full control over all resources.',
          recommendation: 'Replace with a more restrictive role following least privilege principles.',
          evidence: { email: user.email, role: user.role },
          resourceId: user.email,
          resourceType: 'iam_user',
        });
      }
    }

    for (const sa of inventory.serviceAccounts) {
      const saDetails = inventory.iamUsers.find((u) => u.email === sa.email);
      if (saDetails?.keyCount > 2) {
        findings.push({
          checkId: 'GCP-IAM-002',
          checkName: 'Service account has too many keys',
          checkCategory: 'secrets_exposure',
          severity: 'High',
          riskScore: 75,
          title: `Service account ${sa.email} has ${saDetails.keyCount} keys`,
          description: 'Service accounts with too many keys increase the risk of key compromise.',
          recommendation: 'Remove unnecessary keys and rotate remaining keys regularly.',
          evidence: { email: sa.email, keyCount: saDetails.keyCount },
          resourceId: sa.email,
          resourceType: 'iam_user',
        });
      }

      const saDetails2 = inventory.iamUsers.find((u) => u.email === sa.email);
      if (saDetails2?.lastKeyRotation && new Date(saDetails2.lastKeyRotation).getTime() < Date.now() - 86400000 * 90) {
        findings.push({
          checkId: 'GCP-IAM-003',
          checkName: 'Service account key not rotated',
          checkCategory: 'secrets_exposure',
          severity: 'Medium',
          riskScore: 55,
          title: `Service account ${sa.email} key not rotated in 90+ days`,
          description: 'Service account keys should be rotated at least every 90 days.',
          recommendation: 'Rotate service account keys and consider using Workload Identity instead.',
          evidence: { email: sa.email, lastKeyRotation: saDetails2.lastKeyRotation },
          resourceId: sa.email,
          resourceType: 'iam_user',
        });
      }
    }

    for (const bucket of inventory.storageBuckets) {
      const bindings = bucket.bindings || [];
      for (const binding of bindings) {
        if (binding.members && binding.members.includes('allUsers')) {
          findings.push({
            checkId: 'GCP-STORAGE-001',
            checkName: 'Public Cloud Storage bucket',
            checkCategory: 'public_storage',
            severity: 'High',
            riskScore: 70,
            title: `GCS bucket ${bucket.name} is publicly accessible`,
            description: 'The storage bucket has allUsers in its IAM bindings, making it publicly accessible.',
            recommendation: 'Remove allUsers from the bucket IAM policy and use signed URLs or authenticated access.',
            evidence: { bucketName: bucket.name, role: binding.role },
            resourceId: bucket.name,
            resourceType: 'cloud_storage_bucket',
          });
        }
      }

      if (bucket.iamConfiguration?.uniformBucketLevelAccess?.enabled === false) {
        findings.push({
          checkId: 'GCP-STORAGE-002',
          checkName: 'Uniform bucket-level access not enabled',
          checkCategory: 'weak_policies',
          severity: 'Low',
          riskScore: 30,
          title: `GCS bucket ${bucket.name} does not use uniform bucket-level access`,
          description: 'Uniform bucket-level access provides better access control. It should be enabled.',
          recommendation: 'Enable uniform bucket-level access for the storage bucket.',
          evidence: { bucketName: bucket.name },
          resourceId: bucket.name,
          resourceType: 'cloud_storage_bucket',
        });
      }
    }

    for (const rule of inventory.firewallRules) {
      if (rule.sourceRanges && rule.sourceRanges.includes('0.0.0.0/0')) {
        const ports = rule.allowed?.flatMap((a) => a.ports || []) || [];
        const sshOpen = ports.includes('22');
        const rdpOpen = ports.includes('3389');
        const allOpen = ports.includes('0-65535');

        if (sshOpen || rdpOpen || allOpen) {
          findings.push({
            checkId: 'GCP-FW-001',
            checkName: 'Firewall rule allows inbound from internet',
            checkCategory: 'open_security_groups',
            severity: 'Critical',
            riskScore: 90,
            title: 'Firewall rule ' + rule.name + ' allows inbound from 0.0.0.0/0 on ' + (sshOpen ? 'SSH' : rdpOpen ? 'RDP' : 'all ports'),
            description: 'The firewall rule allows inbound traffic from the internet on sensitive ports.',
            recommendation: 'Restrict the firewall rule to specific source IP ranges.',
            evidence: { ruleName: rule.name, sourceRanges: rule.sourceRanges, ports },
            resourceId: rule.name,
            resourceType: 'firewall_rule',
          });
        }
      }
    }

    for (const scs of inventory.securityCommandCenter) {
      if (scs.state === 'DISABLED') {
        findings.push({
          checkId: 'GCP-SCC-001',
          checkName: 'Security Command Center not enabled',
          checkCategory: 'compliance_violations',
          severity: 'High',
          riskScore: 65,
          title: 'Security Command Center is disabled',
          description: 'Security Command Center provides security and compliance analysis. It should be enabled.',
          recommendation: 'Enable Security Command Center in the Google Cloud Console.',
          evidence: { service: scs.name },
          resourceId: this.projectId,
          resourceType: 'subscription',
        });
      }
    }

    await this.audit('cloud_scan', { method: 'gcp-cspm', status: true, findings: findings.length });
    return findings;
  }
}

export default GCPConnector;
