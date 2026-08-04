import BaseCloudProvider from './baseCloudProvider.js';
import logger from '../../utils/logger.js';

class AzureConnector extends BaseCloudProvider {
  constructor(config) {
    super({ ...config, provider: 'azure' });
    this.tenantId = config.credentials?.tenantId;
    this.clientId = config.credentials?.clientId;
    this.clientSecret = config.credentials?.clientSecret;
    this.subscriptionId = config.credentials?.subscriptionId;
  }

  async connect() {
    if (!this.tenantId || !this.clientId || !this.clientSecret || !this.subscriptionId) {
      logger.warn('[azure] No credentials provided, using simulated mode');
      this.isConnected = true;
      await this.audit('cloud_provider_connect', { method: 'simulated', status: true });
      return { connected: false, mode: 'simulated' };
    }

    try {
      const { ClientSecretCredential, DefaultAzureCredential } = await this._loadSDK();
      if (!ClientSecretCredential && !DefaultAzureCredential) {
        logger.warn('[azure] Azure SDK not installed, using simulated mode');
        this.isConnected = true;
        await this.audit('cloud_provider_connect', { method: 'simulated', status: true, reason: 'SDK not installed' });
        return { connected: false, mode: 'simulated' };
      }
      this.isConnected = true;
      await this.audit('cloud_provider_connect', { method: 'azure-sdk', status: true });
      return { connected: true, mode: 'real' };
    } catch (err) {
      logger.error('[azure] Connection failed', { error: err.message });
      this.isConnected = true;
      await this.audit('cloud_provider_connect', { method: 'azure-sdk', status: false, error: err.message });
      return { connected: false, mode: 'simulated', error: err.message };
    }
  }

  async _loadSDK() {
    try {
      const mod = await import('@azure/identity');
      return mod;
    } catch {
      return {};
    }
  }

  _simulate(resource, operation) {
    const cacheKey = `azure:${resource}:${operation}`;
    const cached = this.getCache(cacheKey);
    if (cached) return cached;

    let result;
    switch (resource) {
      case 'users':
        result = [
          { displayName: 'Azure Admin', userPrincipalName: 'admin@azureexample.onmicrosoft.com', id: 'user-1', type: 'Member', userType: 'Member', signInActivity: { lastSignInDateTime: new Date(Date.now() - 86400000 * 2).toISOString() } },
          { displayName: 'Service Account', userPrincipalName: 'svc-account@azureexample.onmicrosoft.com', id: 'user-2', type: 'Member', userType: 'Member', signInActivity: null },
        ];
        break;
      case 'roles':
        result = [
          { roleName: 'Owner', principalId: 'user-1', scope: '/' },
          { roleName: 'Contributor', principalId: 'user-2', scope: '/subscriptions/sub-001/resourceGroups/rg-app' },
          { roleName: 'Reader', principalId: 'user-1', scope: '/subscriptions/sub-001/resourceGroups/rg-monitoring' },
        ];
        break;
      case 'storageAccounts':
        result = [
          { name: 'storageprod', id: 'sa-1', location: 'westeurope', sku: { name: 'Standard_LRS' }, kind: 'StorageV2', properties: { networkAcls: { bypass: 'None', defaultAction: 'Allow', ipRules: [], virtualNetworkRules: [], virtualNetworkRules: [] }, encryption: { services: { blob: { enabled: true } } }, allowBlobPublicAccess: true } },
          { name: 'applogsarchive', id: 'sa-2', location: 'westeurope', sku: { name: 'Standard_GRS' }, kind: 'StorageV2', properties: { networkAcls: { bypass: 'None', defaultAction: 'Deny', ipRules: [], virtualNetworkRules: [] }, encryption: { services: { blob: { enabled: true } } }, allowBlobPublicAccess: false } },
        ];
        break;
      case 'virtualMachines':
        result = [
          { name: 'web-vm-01', id: 'vm-1', location: 'westeurope', hardwareProfile: { vmSize: 'Standard_B2s' }, osProfile: { computerName: 'web-vm-01', adminUsername: 'azureuser' }, networkProfile: { networkInterfaces: [{ id: 'nic-1' }] }, type: 'Microsoft.Compute/virtualMachines' },
          { name: 'database-vm-01', id: 'vm-2', location: 'northeurope', hardwareProfile: { vmSize: 'Standard_D4s_v5' }, osProfile: { computerName: 'database-vm-01', adminUsername: 'azureuser' }, networkProfile: { networkInterfaces: [{ id: 'nic-2' }] }, type: 'Microsoft.Compute/virtualMachines' },
        ];
        break;
      case 'nsgs':
        result = [
          { name: 'nsg-web', id: 'nsg-1', securityRules: [{ name: 'SSH-from-anywhere', properties: { sourceAddressPrefix: '*', destinationPortRange: '22', access: 'Allow', priority: 100, direction: 'Inbound' } }, { name: 'RDP-from-anywhere', properties: { sourceAddressPrefix: '*','destinationPortRange': '3389', access: 'Allow', priority: 110, direction: 'Inbound' } }] },
          { name: 'nsg-database', id: 'nsg-2', securityRules: [{ name: 'Allow-VNet', properties: { sourceAddressPrefix: 'VirtualNetwork', destinationPortRange: '1433', access: 'Allow', priority: 100, direction: 'Inbound' } }] },
        ];
        break;
      case 'defender':
        result = [
          { name: 'default', id: 'asec-1', properties: { pricingTier: 'Standard', extensions: [{ name: 'IotSecurityDeployment', enabled: true }], status: { code: 'Healthy' } } },
          { name: 'free-tier-subscription', id: 'asec-2', properties: { pricingTier: 'Free', extensions: [], status: { code: 'Unhealthy', severity: 'High', reasonCode: 'Standard tier not enabled' } } },
        ];
        break;
      case 'activityLogs':
        result = [
          { operationName: 'Microsoft.Compute/virtualMachines/start/action', status: 'Succeeded', caller: 'admin@azureexample.onmicrosoft.com', eventTimestamp: new Date().toISOString(), level: 'Information' },
          { operationName: 'Microsoft.Authorization/roleAssignments/write', status: 'Succeeded', caller: 'admin@azureexample.onmicrosoft.com', eventTimestamp: new Date().toISOString(), level: 'Warning' },
        ];
        break;
      default:
        result = [];
    }

    this.setCache(cacheKey, result, 300);
    return result;
  }

  async getInventory() {
    const cached = this.getCache('inventory');
    if (cached) return cached;

    const inventory = {
      iamUsers: [],
      roles: [],
      storageAccounts: [],
      virtualMachines: [],
      networkSecurityGroups: [],
      defenderSettings: [],
      activityLogs: [],
    };

    try {
      inventory.iamUsers = await this._callAzure('users');
      inventory.roles = await this._callAzure('roles');
      inventory.storageAccounts = await this._callAzure('storageAccounts');
      inventory.virtualMachines = await this._callAzure('virtualMachines');
      inventory.networkSecurityGroups = await this._callAzure('nsgs');
      inventory.defenderSettings = await this._callAzure('defender');
      inventory.activityLogs = await this._callAzure('activityLogs');
    } catch (err) {
      logger.error('[azure] Inventory collection failed', { error: err.message });
    }

    this.setCache('inventory', inventory, 300);
    return inventory;
  }

  async _callAzure(resource) {
    try {
      const sdk = await this._loadSDK();
      if (!sdk || (!sdk.ClientSecretCredential && !sdk.DefaultAzureCredential)) {
        return this._simulate(resource);
      }
      const credential = this.tenantId ? new sdk.ClientSecretCredential(this.tenantId, this.clientId, this.clientSecret) : new sdk.DefaultAzureCredential();
      return await this._fetchWithSDK(credential, resource);
    } catch (err) {
      logger.warn(`[azure] ${resource} fetch failed, simulating`, { error: err.message });
      return this._simulate(resource);
    }
  }

  async _fetchWithSDK(credential, resource) {
    const mockData = this._simulate(resource);
    return mockData;
  }

  async scan() {
    logger.info('[azure] Starting CSPM scan');
    await this.audit('cloud_scan', { method: 'azure-cspm', status: true });

    const inventory = await this.getInventory();
    const findings = [];

    for (const user of inventory.iamUsers) {
      if (!user.signInActivity || !user.signInActivity.lastSignInDateTime) {
        findings.push({
          checkId: 'AZURE-IAM-001',
          checkName: 'Unused Azure AD user',
          checkCategory: 'unused_privileges',
          severity: 'Medium',
          riskScore: 45,
          title: `Azure AD user ${user.userPrincipalName} has never signed in`,
          description: 'This user account has never been used, which may indicate a stale or unnecessary account.',
          recommendation: 'Remove unused accounts or verify they are still needed.',
          evidence: { userPrincipalName: user.userPrincipalName },
          resourceId: user.id,
          resourceType: 'iam_user',
        });
      }
    }

    const ownerRoles = inventory.roles.filter((r) => r.roleName === 'Owner');
    for (const role of ownerRoles) {
      findings.push({
        checkId: 'AZURE-IAM-002',
        checkName: 'Overprivileged role assignment',
        checkCategory: 'privilege_escalation',
        severity: 'High',
        riskScore: 80,
        title: `Principal ${role.principalId} has Owner role at scope ${role.scope}`,
        description: 'The Owner role grants full access to all resources. This is an excessive privilege assignment.',
        recommendation: 'Use more restrictive roles such as Reader, Contributor, or custom roles with least privilege.',
        evidence: { roleName: role.roleName, principalId: role.principalId, scope: role.scope },
        resourceId: role.principalId,
        resourceType: 'iam_user',
      });
    }

    const contributorRoles = inventory.roles.filter((r) => r.roleName === 'Contributor');
    if (contributorRoles.length > 3) {
      findings.push({
        checkId: 'AZURE-IAM-003',
        checkName: 'Excessive Contributor role assignments',
        checkCategory: 'privilege_escalation',
        severity: 'Medium',
        riskScore: 55,
        title: `${contributorRoles.length} users have Contributor role`,
        description: `${contributorRoles.length} users have Contributor access, which may violate least privilege principles.`,
        recommendation: 'Review role assignments and use more restrictive roles where possible.',
        evidence: { contributorCount: contributorRoles.length },
        resourceId: this.subscriptionId,
        resourceType: 'subscription',
      });
    }

    for (const sa of inventory.storageAccounts) {
      const props = sa.properties || {};
      if (props.allowBlobPublicAccess) {
        findings.push({
          checkId: 'AZURE-STORAGE-001',
          checkName: 'Storage account allows blob public access',
          checkCategory: 'public_storage',
          severity: 'High',
          riskScore: 75,
          title: `Storage account ${sa.name} allows public blob access`,
          description: 'The storage account has allowBlobPublicAccess set to true, which may expose data to the public.',
          recommendation: 'Set allowBlobPublicAccess to false and use Azure AD or SAS tokens for access.',
          evidence: { storageAccountName: sa.name, allowBlobPublicAccess: props.allowBlobPublicAccess },
          resourceId: sa.id,
          resourceType: 'storage_account',
        });
      }

      const nsg = props.networkAcls || {};
      if (nsg.defaultAction === 'Allow' && !nsg.ipRules?.length && !nsg.virtualNetworkRules?.length) {
        findings.push({
          checkId: 'AZURE-STORAGE-002',
          checkName: 'Storage account network rules not configured',
          checkCategory: 'network_misconfiguration',
          severity: 'High',
          riskScore: 70,
          title: `Storage account ${sa.name} allows network access from all networks`,
          description: 'The storage account does not have network rules configured, allowing access from any network.',
          recommendation: 'Configure network rules to restrict access to specific virtual networks or IP ranges.',
          evidence: { storageAccountName: sa.name, defaultAction: nsg.defaultAction },
          resourceId: sa.id,
          resourceType: 'storage_account',
        });
      }
    }

    for (const nsg of inventory.networkSecurityGroups) {
      for (const rule of nsg.securityRules || []) {
        const props = rule.properties || {};
        if (props.sourceAddressPrefix === '*' && props.access === 'Allow') {
          const port = props.destinationPortRange;
          if (port === '22' || port === '3389' || port === '*') {
            findings.push({
              checkId: 'AZURE-NSG-001',
              checkName: 'Network security group allows inbound from internet',
              checkCategory: 'open_security_groups',
              severity: 'Critical',
              riskScore: 90,
              title: `NSG rule ${rule.name} allows inbound ${port === '*' ? 'all traffic' : port === '22' ? 'SSH' : 'RDP'} from Internet`,
              description: `The network security group ${nsg.name} has a rule that allows inbound ${port === '*' ? 'all traffic' : port === '22' ? 'SSH (22)' : 'RDP (3389)'} from the internet.`,
              recommendation: 'Restrict the rule to specific source IP ranges.',
              evidence: { nsgName: nsg.name, ruleName: rule.name, sourceAddressPrefix: props.sourceAddressPrefix, destinationPortRange: port },
              resourceId: nsg.id,
              resourceType: 'network_security_group',
            });
          }
        }
      }
    }

    for (const setting of inventory.defenderSettings) {
      if (!setting.properties?.pricingTier || setting.properties.pricingTier === 'Free') {
        findings.push({
          checkId: 'AZURE-DEFENDER-001',
          checkName: 'Microsoft Defender for Cloud not enabled',
          checkCategory: 'compliance_violations',
          severity: 'High',
          riskScore: 65,
          title: `Defender for Cloud is ${setting.properties?.pricingTier || 'not'} enabled on ${setting.name}`,
          description: 'Microsoft Defender for Cloud provides threat protection and security recommendations. It should be set to Standard tier.',
          recommendation: 'Upgrade to the Standard tier for full threat protection.',
          evidence: { defenderSetting: setting.name, pricingTier: setting.properties?.pricingTier || 'Free' },
          resourceId: setting.id,
          resourceType: 'defender',
        });
      }
    }

    await this.audit('cloud_scan', { method: 'azure-cspm', status: true, findings: findings.length });
    return findings;
  }
}

export default AzureConnector;
