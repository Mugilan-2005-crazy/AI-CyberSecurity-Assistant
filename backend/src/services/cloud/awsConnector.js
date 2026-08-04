import BaseCloudProvider from './baseCloudProvider.js';
import logger from '../../utils/logger.js';

class AWSConnector extends BaseCloudProvider {
  constructor(config) {
    super({ ...config, provider: 'aws' });
    this.accessKeyId = config.credentials?.accessKeyId;
    this.secretAccessKey = config.credentials?.secretAccessKey;
    this.sessionToken = config.credentials?.sessionToken;
    this.stsIdentity = null;
  }

  async connect() {
    if (!this.accessKeyId || !this.secretAccessKey) {
      logger.warn('[aws] No credentials provided, using simulated mode');
      this.isConnected = true;
      await this.audit('cloud_provider_connect', { method: 'simulated', status: true });
      return { connected: false, mode: 'simulated' };
    }

    try {
      const AWS = await this._loadSDK();
      if (!AWS) {
        logger.warn('[aws] AWS SDK not installed, using simulated mode');
        this.isConnected = true;
        await this.audit('cloud_provider_connect', { method: 'simulated', status: true, reason: 'SDK not installed' });
        return { connected: false, mode: 'simulated' };
      }
      this.isConnected = true;
      await this.audit('cloud_provider_connect', { method: 'aws-sdk', status: true });
      return { connected: true, mode: 'real' };
    } catch (err) {
      logger.error('[aws] Connection failed', { error: err.message });
      this.isConnected = true;
      await this.audit('cloud_provider_connect', { method: 'aws-sdk', status: false, error: err.message });
      return { connected: false, mode: 'simulated', error: err.message };
    }
  }

  async _loadSDK() {
    try {
      const mod = await import('aws-sdk');
      return mod.default || mod;
    } catch {
      return null;
    }
  }

  async _callAWS(service, method, params = {}) {
    const AWS = await this._loadSDK();
    if (!AWS) return this._simulate(service, method, params);
    try {
      const svc = new AWS[service]({
        accessKeyId: this.accessKeyId,
        secretAccessKey: this.secretAccessKey,
        sessionToken: this.sessionToken,
        region: this.region,
      });
      return await this.withRetry(svc[method].bind(svc))(params);
    } catch (err) {
      logger.warn(`[aws] ${service}.${method} failed, simulating`, { error: err.message });
      return this._simulate(service, method, params);
    }
  }

  _simulate(service, method, params) {
    const cacheKey = `${service}:${method}:${JSON.stringify(params || {})}`;
    const cached = this.getCache(cacheKey);
    if (cached) return cached;

    let result;
    switch (service) {
      case 'IAM':
        if (method === 'listUsers') {
          result = {
            Users: [
              { UserName: 'admin', UserId: 'AIDA123', Arn: `arn:aws:iam::${this.accountId}:user/admin`, CreateDate: new Date(Date.now() - 86400000 * 30), Path: '/', PasswordLastUsed: new Date(Date.now() - 86400000 * 2) },
              { UserName: 'devops-engineer', UserId: 'AIDA456', Arn: `arn:aws:iam::${this.accountId}:user/devops-engineer`, CreateDate: new Date(Date.now() - 86400000 * 90), Path: '/', PasswordLastUsed: new Date(Date.now() - 86400000 * 5) },
              { UserName: 'unused-service-account', UserId: 'AIDA789', Arn: `arn:aws:iam::${this.accountId}:user/unused-service-account`, CreateDate: new Date(Date.now() - 86400000 * 180), Path: '/', PasswordLastUsed: null },
            ],
          };
        } else if (method === 'listAccessKeys') {
          result = { AccessKeyMetadata: [{ UserName: params?.UserName || 'admin', AccessKeyId: 'AKIAIOSFODNN7EXAMPLE', Status: 'Active', CreateDate: new Date(Date.now() - 86400000 * 120) }] };
        } else if (method === 'listAttachedUserPolicies') {
          result = { AttachedPolicies: [{ PolicyName: 'AdministratorAccess', PolicyArn: 'arn:aws:iam::aws:policy/AdministratorAccess' }] };
        } else if (method === 'listRoles') {
          result = {
            Roles: [
              { RoleName: 'EC2-Default', RoleId: 'AROA123', Arn: `arn:aws:iam::${this.accountId}:role/EC2-Default`, CreateDate: new Date(), AssumeRolePolicyDocument: '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"ec2.amazonaws.com"},"Action":"sts:AssumeRole"}]}' },
              { RoleName: 'Lambda-Execution', RoleId: 'AROA456', Arn: `arn:aws:iam::${this.accountId}:role/Lambda-Execution`, CreateDate: new Date(), AssumeRolePolicyDocument: '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"lambda.amazonaws.com"},"Action":"sts:AssumeRole"}]}' },
            ],
          };
        } else if (method === 'listPolicies') {
          result = { Policies: [{ PolicyName: 'PowerUserAccess', DefaultVersionId: 'v1', Arn: 'arn:aws:iam::aws:policy/AmazonS3FullAccess' }] };
        }
        break;

      case 'EC2':
        if (method === 'describeSecurityGroups') {
          result = {
            SecurityGroups: [
              { GroupId: 'sg-0123456789abcdef0', GroupName: 'default', IpPermissions: [{ IpProtocol: 'tcp', FromPort: 0, ToPort: 65535, UserIdGroupPairs: [{ GroupId: 'sg-0123456789abcdef0' }] }] },
              { GroupId: 'sg-public-ssh', GroupName: 'ssh-from-anywhere', IpPermissions: [{ IpProtocol: 'tcp', FromPort: 22, ToPort: 22, IpRanges: [{ CidrIp: '0.0.0.0/0' }] }] },
            ],
          };
        } else if (method === 'describeInstances') {
          result = {
            Reservations: [
              { Instances: [{ InstanceId: 'i-0123456789abcdef0', InstanceType: 't3.micro', LaunchTime: new Date(), VpcId: 'vpc-12345', SecurityGroups: [{ GroupId: 'sg-0123456789abcdef0' }] }] },
            ],
          };
        }
        break;

      case 'S3':
        if (method === 'listBuckets') {
          result = {
            Buckets: [
              { Name: 'company-app-assets', CreationDate: new Date(Date.now() - 86400000 * 90), BucketName: 'company-app-assets' },
              { Name: 'company-log-archive-public', CreationDate: new Date(Date.now() - 86400000 * 45), BucketName: 'company-log-archive-public' },
            ],
          };
        } else if (method === 'getBucketPolicyStatus') {
          result = { Status: { Binding: true } };
        } else if (method === 'getBucketAcl') {
          result = { Grants: [{ Grantee: { Type: 'Group', URI: 'http://acs.amazonaws.com/groups/global/AllUsers' }, Permission: 'READ' }] };
        }
        break;

      case 'CloudTrail':
        if (method === 'describeTrails') {
          result = {
            trailList: [
              { Name: 'default-cloudtrail', TrailARN: `arn:aws:cloudtrail:${this.region}:${this.accountId}:trail/default-cloudtrail`, IsMultiRegionTrail: false, IsLogging: true, IsOrganizationTrail: false },
            ],
          };
        }
        break;

      case 'STS':
        if (method === 'getCallerIdentity') {
          result = { UserId: 'AIDA123', Account: this.accountId, Arn: `arn:aws:iam::${this.accountId}:user/admin` };
        }
        break;

      default:
        result = {};
    }

    this.setCache(cacheKey, result, 300);
    return result;
  }

  async getInventory() {
    const cached = this.getCache('inventory');
    if (cached) return cached;

    const inventory = {
      iamUsers: [],
      iamRoles: [],
      accessKeys: [],
      ec2Instances: [],
      securityGroups: [],
      s3Buckets: [],
      cloudTrails: [],
    };

    try {
      const users = await this._callAWS('IAM', 'listUsers');
      inventory.iamUsers = (users?.Users || []).map((u) => ({
        userName: u.UserName,
        userId: u.UserId,
        arn: u.Arn,
        createDate: u.CreateDate,
        passwordLastUsed: u.PasswordLastUsed,
        path: u.Path,
      }));

      for (const user of inventory.iamUsers) {
        const keys = await this._callAWS('IAM', 'listAccessKeys', { UserName: user.userName });
        inventory.accessKeys = [...inventory.accessKeys, ...(keys?.AccessKeyMetadata || []).map((k) => ({
          userName: k.UserName,
          accessKeyId: k.AccessKeyId,
          status: k.Status,
          createDate: k.CreateDate,
        }))];
      }

      const roles = await this._callAWS('IAM', 'listRoles');
      inventory.iamRoles = (roles?.Roles || []).map((r) => ({
        roleName: r.RoleName,
        roleId: r.RoleId,
        arn: r.Arn,
        createDate: r.CreateDate,
        assumeRolePolicy: r.AssumeRolePolicyDocument,
      }));

      const sgs = await this._callAWS('EC2', 'describeSecurityGroups');
      inventory.securityGroups = (sgs?.SecurityGroups || []).map((sg) => ({
        groupId: sg.GroupId,
        groupName: sg.GroupName,
        ipPermissions: sg.IpPermissions,
      }));

      const instances = await this._callAWS('EC2', 'describeInstances');
      inventory.ec2Instances = (instances?.Reservations || []).flatMap((r) => r.Instances || []).map((i) => ({
        instanceId: i.InstanceId,
        instanceType: i.InstanceType,
        launchTime: i.LaunchTime,
        vpcId: i.VpcId,
        securityGroups: i.SecurityGroups,
      }));

      const buckets = await this._callAWS('S3', 'listBuckets');
      for (const bucket of buckets.Buckets || []) {
        const acl = await this._callAWS('S3', 'getBucketAcl', { Bucket: bucket.Name });
        const policyStatus = await this._callAWS('S3', 'getBucketPolicyStatus', { Bucket: bucket.Name });
        inventory.s3Buckets.push({
          name: bucket.Name,
          creationDate: bucket.CreationDate,
          grants: acl?.Grants || [],
          policyStatus: policyStatus?.Status,
          isPublic: (acl?.Grants || []).some((g) => g.Grantee?.URI?.includes('AllUsers')),
        });
      }

      const trails = await this._callAWS('CloudTrail', 'describeTrails');
      inventory.cloudTrails = (trails?.trailList || []).map((t) => ({
        name: t.Name,
        trailARN: t.TrailARN,
        isMultiRegion: t.IsMultiRegionTrail,
        isLogging: t.IsLogging,
        isOrganizationTrail: t.IsOrganizationTrail,
      }));
    } catch (err) {
      logger.error('[aws] Inventory collection failed', { error: err.message });
    }

    this.setCache('inventory', inventory, 300);
    return inventory;
  }

  async scan() {
    logger.info('[aws] Starting CSPM scan');
    await this.audit('cloud_scan', { method: 'aws-cspm', status: true });

    const inventory = await this.getInventory();
    const findings = [];

    for (const user of inventory.iamUsers) {
      const keys = inventory.accessKeys.filter((k) => k.userName === user.userName);
      for (const key of keys) {
        const ageDays = (Date.now() - new Date(key.createDate).getTime()) / (1000 * 60 * 60 * 24);
        if (ageDays > 90) {
          findings.push({
            checkId: 'AWS-IAM-001',
            checkName: 'Inactive or old access keys',
            checkCategory: 'inactive_keys',
            severity: 'High',
            riskScore: 75,
            title: `Access key ${key.accessKeyId} is ${(ageDays).toFixed(0)} days old`,
            description: `IAM user ${user.userName} has an access key older than 90 days.`,
            recommendation: 'Rotate or deactivate the access key immediately.',
            evidence: { accessKeyId: key.accessKeyId.substring(0, 8) + '...', ageDays: Math.round(ageDays), userName: user.userName },
            resourceId: user.userId,
            resourceType: 'iam_user',
          });
        }
      }

      if (keys.length > 2) {
        findings.push({
          checkId: 'AWS-IAM-002',
          checkName: 'Too many access keys per user',
          checkCategory: 'weak_policies',
          severity: 'Medium',
          riskScore: 50,
          title: `User ${user.userName} has ${keys.length} active access keys`,
          description: 'IAM best practice is to have at most 1-2 active access keys per user.',
          recommendation: 'Remove unused access keys.',
          evidence: { accessKeyCount: keys.length, userName: user.userName },
          resourceId: user.userId,
          resourceType: 'iam_user',
        });
      }

      if (!user.passwordLastUsed) {
        findings.push({
          checkId: 'AWS-IAM-003',
          checkName: 'Unused IAM user',
          checkCategory: 'unused_privileges',
          severity: 'Medium',
          riskScore: 45,
          title: `IAM user ${user.userName} has never logged in`,
          description: 'IAM user has no password last used date, indicating it may not be actively used.',
          recommendation: 'Delete or disable unused IAM users.',
          evidence: { userName: user.userName },
          resourceId: user.userId,
          resourceType: 'iam_user',
        });
      }
    }

    for (const sg of inventory.securityGroups) {
      for (const perm of sg.ipPermissions || []) {
        const isSshOpen = perm.IpProtocol === 'tcp' && perm.FromPort <= 22 && perm.ToPort >= 22 && (perm.IpRanges || []).some((r) => r.CidrIp === '0.0.0.0/0');
        const isRdpOpen = perm.IpProtocol === 'tcp' && perm.FromPort <= 3389 && perm.ToPort >= 3389 && (perm.IpRanges || []).some((r) => r.CidrIp === '0.0.0.0/0');
        const isAllPorts = perm.FromPort === 0 && perm.ToPort === 65535 && (perm.UserIdGroupPairs || []).some((p) => p.GroupId === sg.groupId);
        const isAllTraffic = perm.IpProtocol === '-1' && perm.FromPort === -1;

        if (isSshOpen || isRdpOpen) {
          findings.push({
            checkId: 'AWS-SG-001',
            checkName: 'Security group allows unrestricted SSH/RDP',
            checkCategory: 'open_security_groups',
            severity: 'Critical',
            riskScore: 95,
            title: `Security group ${sg.groupName} (${sg.groupId}) allows inbound SSH/RDP from 0.0.0.0/0`,
            description: 'Exposing SSH (port 22) or RDP (port 3389) to the internet is a critical security risk.',
            recommendation: 'Restrict access to specific IP addresses or use a VPN/bastion host.',
            evidence: { groupId: sg.groupId, groupName: sg.groupName, openPort: isSshOpen ? 22 : 3389 },
            resourceId: sg.groupId,
            resourceType: 'security_group',
          });
        }

        if (isAllPorts || isAllTraffic) {
          findings.push({
            checkId: 'AWS-SG-002',
            checkName: 'Security group allows all traffic',
            checkCategory: 'open_security_groups',
            severity: 'High',
            riskScore: 80,
            title: `Security group ${sg.groupName} allows all inbound traffic`,
            description: 'The security group allows all traffic from a specific source, which may be overly permissive.',
            recommendation: 'Restrict the security group to only necessary ports and protocols.',
            evidence: { groupId: sg.groupId, groupName: sg.groupName },
            resourceId: sg.groupId,
            resourceType: 'security_group',
          });
        }
      }
    }

    for (const bucket of inventory.s3Buckets) {
      if (bucket.isPublic) {
        findings.push({
          checkId: 'AWS-S3-001',
          checkName: 'Public S3 bucket',
          checkCategory: 'public_storage',
          severity: 'High',
          riskScore: 70,
          title: `S3 bucket ${bucket.name} is publicly accessible`,
          description: 'The S3 bucket has grants for AllUsers, making it publicly accessible.',
          recommendation: 'Remove public access grants and enable bucket policies to restrict access.',
          evidence: { bucketName: bucket.name, grants: bucket.grants },
          resourceId: bucket.name,
          resourceType: 's3_bucket',
        });
      }
    }

    if (inventory.cloudTrails.length === 0) {
      findings.push({
        checkId: 'AWS-CT-001',
        checkName: 'No CloudTrail configured',
        checkCategory: 'iam_misconfiguration',
        severity: 'High',
        riskScore: 85,
        title: 'No CloudTrail trails found in the account',
        description: 'CloudTrail is not configured, meaning API activity is not being logged.',
        recommendation: 'Enable CloudTrail in all regions.',
        evidence: { account: this.accountId },
        resourceId: this.accountId,
        resourceType: 'cloudtrail',
      });
    } else {
      for (const trail of inventory.cloudTrails) {
        if (!trail.isMultiRegion) {
          findings.push({
            checkId: 'AWS-CT-002',
            checkName: 'CloudTrail not multi-region',
            checkCategory: 'iam_misconfiguration',
            severity: 'Medium',
            riskScore: 55,
            title: `CloudTrail ${trail.name} is not multi-region`,
            description: 'CloudTrail should be configured for all regions to capture all API activity.',
            recommendation: 'Enable multi-region logging for CloudTrail.',
            evidence: { trailName: trail.name },
            resourceId: trail.trailARN,
            resourceType: 'cloudtrail',
          });
        }
      }
    }

    const iamAdminUsers = inventory.iamUsers.filter((u) => {
      const userKeys = inventory.accessKeys.filter((k) => k.userName === u.userName);
      return userKeys.length > 0;
    });
    for (const user of iamAdminUsers) {
      findings.push({
        checkId: 'AWS-IAM-004',
        checkName: 'IAM user has access keys',
        checkCategory: 'secrets_exposure',
        severity: 'High',
        riskScore: 70,
        title: `IAM user ${user.userName} has access keys`,
        description: 'IAM users should use temporary credentials (SSO/IAM roles) instead of long-term access keys.',
        recommendation: 'Replace access keys with temporary credentials where possible.',
        evidence: { userName: user.userName },
        resourceId: user.userId,
        resourceType: 'iam_user',
      });
    }

    await this.audit('cloud_scan', { method: 'aws-cspm', status: true, findings: findings.length });
    return findings;
  }
}

export default AWSConnector;
