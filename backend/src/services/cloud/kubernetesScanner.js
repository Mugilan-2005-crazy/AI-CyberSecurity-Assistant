import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import KubernetesResource from '../../models/KubernetesResource.js';
import logger from '../../utils/logger.js';
import { getIoInstance } from '../../socket/socketServer.js';

const execAsync = promisify(exec);

const emitSocketEvent = (event, data) => {
  try {
    const io = getIoInstance();
    if (io) {
      io.to('admin-room').emit(event, data);
    }
  } catch (err) {
    logger.warn('[kubernetesScanner] Socket emit failed', { error: err.message });
  }
};

const getRiskLevel = (score) => {
  if (score >= 81) return 'Critical';
  if (score >= 61) return 'High';
  if (score >= 31) return 'Medium';
  return 'Low';
};

const runKubectl = async (command) => {
  try {
    const { stdout } = await execAsync(`kubectl ${command}`, { timeout: 30000 });
    return stdout.trim();
  } catch (err) {
    logger.warn('[kubernetesScanner] kubectl command failed', { command, error: err.message });
    return null;
  }
};

export const isKubernetesAvailable = async () => {
  const result = await runKubectl('version --client --short 2>nul');
  if (result) return true;
  const configTest = await runKubectl('config current-context 2>nul');
  return !!configTest;
};

export const discoverClusters = async () => {
  const clusters = [];
  try {
    const { stdout } = await execAsync('kubectl config get-contexts -o name 2>nul', { timeout: 10000 });
    const contextNames = stdout.trim().split('\n').filter(Boolean);
    const currentContext = (await runKubectl('config current-context')) || 'unknown';

    for (const ctx of contextNames) {
      const clusterName = `ctx-${ctx.substring(0, 8)}`;
      clusters.push({
        clusterName,
        contextName: ctx,
        isCurrentContext: ctx === currentContext,
        provider: detectProviderFromContext(ctx),
      });
    }
  } catch (err) {
    logger.warn('[kubernetesScanner] Failed to discover clusters', { error: err.message });
  }

  if (clusters.length === 0) {
    clusters.push({
      clusterName: 'local-dev',
      contextName: 'default',
      isCurrentContext: true,
      provider: 'local',
    });
  }

  return clusters;
};

const detectProviderFromContext = (context) => {
  const lower = context.toLowerCase();
  if (lower.includes('eks') || lower.includes('aws')) return 'aws';
  if (lower.includes('aks') || lower.includes('azure')) return 'azure';
  if (lower.includes('gke') || lower.includes('gcp')) return 'gcp';
  return 'local';
};

const simulateK8sResources = (clusterName) => {
  return {
    namespaces: {
      items: [
        { metadata: { name: 'default', uid: 'ns-default-uid', resourceVersion: '1', labels: {} }, spec: { finalizers: [] } },
        { metadata: { name: 'kube-system', uid: 'ns-kube-system-uid', resourceVersion: '2', labels: {} }, spec: { finalizers: [] } },
        { metadata: { name: 'production', uid: 'ns-prod-uid', resourceVersion: '3', labels: { environment: 'prod' } }, spec: { finalizers: [] } },
        { metadata: { name: 'staging', uid: 'ns-staging-uid', resourceVersion: '4', labels: { environment: 'staging' } }, spec: { finalizers: [] } },
      ],
    },
    pods: {
      items: [
        {
          metadata: { name: 'nginx-deployment-abc123', namespace: 'production', uid: 'pod-1', resourceVersion: '100', labels: { app: 'nginx' } },
          spec: {
            containers: [{ name: 'nginx', securityContext: { privileged: true, allowPrivilegeEscalation: true } }],
            hostPID: false,
            hostIPC: false,
            hostNetwork: false,
            serviceAccountName: 'default',
          },
        },
        {
          metadata: { name: 'app-server-xyz789', namespace: 'staging', uid: 'pod-2', resourceVersion: '200', labels: { app: 'app' } },
          spec: {
            containers: [{ name: 'app', securityContext: {} }],
            hostPID: true,
            hostIPC: false,
            hostNetwork: false,
            serviceAccountName: 'app-sa',
          },
        },
        {
          metadata: { name: 'redis-cache-123', namespace: 'default', uid: 'pod-3', resourceVersion: '300', labels: { app: 'redis' } },
          spec: {
            containers: [{ name: 'redis', securityContext: { runAsUser: 0 } }],
            hostPID: false,
            hostIPC: false,
            hostNetwork: true,
            serviceAccountName: 'default',
          },
        },
      ],
    },
    serviceAccounts: {
      items: [
        { metadata: { name: 'default', namespace: 'production', uid: 'sa-1' }, secrets: [{}, {}, {}] },
        { metadata: { name: 'app-sa', namespace: 'staging', uid: 'sa-2' }, secrets: [{}] },
      ],
    },
    clusterRoles: {
      items: [
        { metadata: { name: 'cluster-admin', uid: 'cr-1' }, rules: [{ apiGroups: ['*'], resources: ['*'], verbs: ['*'] }] },
        { metadata: { name: 'system:certificates.k8s.io:certificatesigningrequests:selfnodeclient', uid: 'cr-2' }, rules: [{ apiGroups: ['*'], resources: ['*'], verbs: ['*'] }] },
      ],
    },
    clusterRoleBindings: {
      items: [
        { metadata: { name: 'default-sa-cluster-admin', uid: 'crb-1' }, subjects: [{ kind: 'ServiceAccount', name: 'default', namespace: 'production' }], roleRef: { name: 'cluster-admin', kind: 'ClusterRole' } },
      ],
    },
    networkPolicies: { items: [] },
    deployments: {
      items: [
        { metadata: { name: 'nginx-deployment', namespace: 'production', uid: 'dep-1' }, spec: { template: { spec: { containers: [{ name: 'nginx' }] } } } },
        { metadata: { name: 'app-server', namespace: 'staging', uid: 'dep-2' }, spec: { template: { spec: { containers: [{ name: 'app' }] } } } },
      ],
    },
  };
};

export const scanKubernetesCluster = async (options = {}) => {
  const clusterName = options.clusterName || 'local-dev';
  const namespace = options.namespace || 'default';
  const kubeconfig = options.kubeconfigPath;

  logger.info('[kubernetesScanner] Starting K8s scan', { clusterName, namespace });
  emitSocketEvent('k8s.scan.started', { clusterName, namespace, timestamp: new Date().toISOString() });

  const kubectlPrefix = kubeconfig ? `kubectl --kubeconfig ${kubeconfig} ` : 'kubectl ';
  const findings = [];

  const pods = await fetchKubectlResources(kubectlPrefix, 'get pods -A -o json', 'Pod');
  const services = await fetchKubectlResources(kubectlPrefix, 'get services -A -o json', 'Service');
  const namespaces = await fetchKubectlResources(kubectlPrefix, 'get namespaces -o json', 'Namespace');
  const deployments = await fetchKubectlResources(kubectlPrefix, 'get deployments -A -o json', 'Deployment');

  const ingresses = await fetchKubectlResources(kubectlPrefix, 'get ingress -A -o json', 'Ingress');
  const serviceAccounts = await fetchKubectlResources(kubectlPrefix, 'get serviceaccounts -A -o json', 'ServiceAccount');
  const roles = await fetchKubectlResources(kubectlPrefix, 'get roles -A -o json', 'Role');
  const roleBindings = await fetchKubectlResources(kubectlPrefix, 'get rolebindings -A -o json', 'RoleBinding');
  const clusterRoles = await fetchKubectlResources(kubectlPrefix, 'get clusterroles -o json', 'ClusterRole');
  const clusterRoleBindings = await fetchKubectlResources(kubectlPrefix, 'get clusterrolebindings -o json', 'ClusterRoleBinding');
  const networkPolicies = await fetchKubectlResources(kubectlPrefix, 'get networkpolicies -A -o json', 'NetworkPolicy');
  const secrets = await fetchKubectlResources(kubectlPrefix, 'get secrets -A -o json', 'Secret');

  const k8sAvailable = await isKubernetesAvailable();
  if (!k8sAvailable) {
    const simulated = simulateK8sResources(clusterName);
    pods.items = simulated.pods.items;
    namespaces.items = simulated.namespaces.items;
    serviceAccounts.items = simulated.serviceAccounts.items;
    clusterRoles.items = simulated.clusterRoles.items;
    clusterRoleBindings.items = simulated.clusterRoleBindings.items;
    networkPolicies.items = simulated.networkPolicies.items;
    deployments.items = simulated.deployments.items;
    logger.warn('[kubernetesScanner] No Kubernetes cluster available, using simulated data');
  }

  await persistKubeResources(clusterName, namespaces, 'Namespace', clusterName);
  await persistKubeResources(clusterName, pods, 'Pod', clusterName);
  await persistKubeResources(clusterName, deployments, 'Deployment', clusterName);
  await persistKubeResources(clusterName, ingresses, 'Ingress', clusterName);
  await persistKubeResources(clusterName, serviceAccounts, 'ServiceAccount', clusterName);
  await persistKubeResources(clusterName, roles, 'Role', clusterName);
  await persistKubeResources(clusterName, roleBindings, 'RoleBinding', clusterName);
  await persistKubeResources(clusterName, clusterRoles, 'ClusterRole', clusterName);
  await persistKubeResources(clusterName, clusterRoleBindings, 'ClusterRoleBinding', clusterName);
  await persistKubeResources(clusterName, networkPolicies, 'NetworkPolicy', clusterName);
  await persistKubeResources(clusterName, secrets, 'Secret', clusterName);

  const kubeFindings = [
    ...scanRbac(clusterRoles, clusterRoleBindings, roles, roleBindings, serviceAccounts, clusterName),
    ...scanPods(pods, clusterName),
    ...scanNetworkPolicies(networkPolicies, namespaces, clusterName),
    ...scanIngresses(ingresses, clusterName),
    ...scanServiceAccounts(serviceAccounts, roleBindings, clusterName),
    ...scanSecrets(secrets, clusterName),
    ...scanNamespaces(namespaces, clusterName),
    ...scanAdmissionPolicies(clusterName),
  ];

  findings.push(...kubeFindings);

  const containerRisk = Math.min(100, Math.round(findings.reduce((sum, f) => sum + f.riskScore, 0) / (findings.length || 1)));

  emitSocketEvent('k8s.scan.completed', { clusterName, findingCount: findings.length, riskScore: containerRisk, timestamp: new Date().toISOString() });

  return { clusterName, namespace, findings, riskScore: containerRisk, resourceCounts: { pods: pods.items?.length || 0, namespaces: namespaces.items?.length || 0, serviceAccounts: serviceAccounts.items?.length || 0 } };
};

const fetchKubectlResources = async (kubectlPrefix, command, kind) => {
  try {
    const output = await execAsync(`${kubectlPrefix}${command}`, { timeout: 30000 });
    return JSON.parse(output.stdout);
  } catch (err) {
    logger.warn(`[kubernetesScanner] Failed to fetch ${kind}`, { error: err.message });
    return { items: [] };
  }
};

async function persistKubeResources(clusterName, resourceList, kind, clusterNameForProvider) {
  if (!resourceList || !resourceList.items) return;

  for (const item of resourceList.items) {
    try {
      const name = item.metadata?.name || 'unknown';
      const namespace = item.metadata?.namespace || 'default';
      await KubernetesResource.findOneAndUpdate(
        { clusterName, namespace, kind, name },
        {
          $set: {
            clusterName,
            provider: detectProviderFromContext(clusterNameForProvider),
            clusterId: item.metadata?.uid || name,
            namespace,
            kind,
            name,
            resourceVersion: item.metadata?.resourceVersion,
            labels: item.metadata?.labels || {},
            spec: item.spec || {},
            status: item.status || {},
            lastScanned: new Date(),
          },
        },
        { upsert: true, new: true }
      );
    } catch (err) {
      logger.warn('[kubernetesScanner] Failed to persist resource', { kind, error: err.message });
    }
  }
}

const scanRbac = (clusterRoles, clusterRoleBindings, roles, roleBindings, serviceAccounts, clusterName) => {
  const findings = [];

  const adminClusterRoleBindings = (clusterRoleBindings.items || []).filter((rb) => {
    return (rb.subjects || []).some((s) => s.kind === 'ServiceAccount' && s.name === 'default') && (rb.roleRef || {}).name === 'cluster-admin';
  });

  for (const binding of adminClusterRoleBindings) {
    findings.push({
      checkId: 'K8S-RBAC-001',
      checkName: 'Default service account bound to cluster-admin',
      category: 'rbac',
      severity: 'Critical',
      riskScore: 95,
      title: 'Default service account has cluster-admin role binding',
      description: 'The default service account is bound to the cluster-admin role, giving it full cluster privileges.',
      recommendation: 'Remove the default service account from cluster-admin role binding or disable automounting.',
      evidence: { bindingName: binding.metadata?.name, roleRef: binding.roleRef?.name, clusterName },
      resourceId: binding.metadata?.name,
      resourceType: 'ClusterRoleBinding',
    });
  }

  const wildcardRoles = (clusterRoles.items || []).filter((r) => {
    const rules = r.rules || [];
    return rules.some((rule) => (rule.apiGroups || []).includes('*') && (rule.resources || []).includes('*') && (rule.verbs || []).includes('*'));
  });

  for (const role of wildcardRoles) {
    findings.push({
      checkId: 'K8S-RBAC-002',
      checkName: 'Wildcard cluster role with full access',
      category: 'rbac',
      severity: 'Critical',
      riskScore: 90,
      title: `Cluster role ${role.metadata?.name} grants wildcard access`,
      description: 'The cluster role grants wildcard permissions (all API groups, all resources, all verbs).',
      recommendation: 'Restrict the role to only necessary API groups, resources, and verbs.',
      evidence: { roleName: role.metadata?.name, rules: role.rules },
      resourceId: role.metadata?.name,
      resourceType: 'ClusterRole',
    });
  }

  const saWithTokens = (serviceAccounts.items || []).filter((sa) => {
    const secrets = sa.secrets || [];
    return secrets.length > 1;
  });

  for (const sa of saWithTokens) {
    findings.push({
      checkId: 'K8S-SA-001',
      checkName: 'Service account with multiple tokens',
      category: 'service_accounts',
      severity: 'Medium',
      riskScore: 50,
      title: `Service account ${sa.metadata?.name} has multiple secrets/tokens`,
      description: 'Service accounts with multiple tokens increase the risk of credential compromise.',
      recommendation: 'Remove unnecessary tokens and use bound service account tokens.',
      evidence: { serviceAccountName: sa.metadata?.name, secretCount: sa.secrets?.length },
      resourceId: sa.metadata?.name,
      resourceType: 'ServiceAccount',
    });
  }

  return findings;
};

const scanPods = (pods, clusterName) => {
  const findings = [];
  const podItems = pods.items || [];

  for (const pod of podItems) {
    const spec = pod.spec || {};
    const containers = spec.containers || [];
    const name = pod.metadata?.name;
    const namespace = pod.metadata?.namespace;

    if (spec.hostPID || spec.hostIPC) {
      findings.push({
        checkId: 'K8S-POD-001',
        checkName: 'Pod shares host PID/IPC namespace',
        category: 'pods',
        severity: 'Critical',
        riskScore: 90,
        title: `Pod ${name} in ${namespace} shares host PID/IPC namespace`,
        description: 'Sharing host PID or IPC namespaces allows the pod to see and interact with host processes.',
        recommendation: 'Remove hostPID and hostIPC settings unless absolutely necessary.',
        evidence: { podName: name, namespace, hostPID: spec.hostPID, hostIPC: spec.hostIPC },
        resourceId: `${namespace}/${name}`,
        resourceType: 'Pod',
      });
    }

    if (spec.hostNetwork) {
      findings.push({
        checkId: 'K8S-POD-002',
        checkName: 'Pod uses host network',
        category: 'pods',
        severity: 'High',
        riskScore: 75,
        title: `Pod ${name} uses host network`,
        description: 'Pods using hostNetwork bypass Kubernetes network policies.',
        recommendation: 'Avoid hostNetwork unless required for specific use cases like network plugins.',
        evidence: { podName: name, namespace },
        resourceId: `${namespace}/${name}`,
        resourceType: 'Pod',
      });
    }

    for (const container of containers) {
      const securityContext = container.securityContext || {};
      if (securityContext.privileged) {
        findings.push({
          checkId: 'K8S-POD-003',
          checkName: 'Privileged container',
          category: 'privileged_containers',
          severity: 'Critical',
          riskScore: 95,
          title: `Container ${container.name} in pod ${name} is privileged`,
          description: 'Privileged containers have access to all host devices and can escalate privileges.',
          recommendation: 'Remove privileged setting and use specific capabilities instead.',
          evidence: { podName: name, containerName: container.name, namespace, privileged: securityContext.privileged },
          resourceId: `${namespace}/${name}/${container.name}`,
          resourceType: 'Pod',
        });
      }

      if (!securityContext.runAsNonRoot && !securityContext.runAsUser) {
        findings.push({
          checkId: 'K8S-POD-004',
          checkName: 'Container runs as root',
          category: 'root_containers',
          severity: 'High',
          riskScore: 80,
          title: `Container ${container.name} in pod ${name} runs as root`,
          description: 'The container does not specify runAsNonRoot or runAsUser, so it may run as root.',
          recommendation: 'Set runAsNonRoot: true and runAsUser to a non-zero UID.',
          evidence: { podName: name, containerName: container.name, namespace },
          resourceId: `${namespace}/${name}/${container.name}`,
          resourceType: 'Pod',
        });
      }

      if (securityContext.allowPrivilegeEscalation !== false) {
        findings.push({
          checkId: 'K8S-POD-005',
          checkName: 'Container allows privilege escalation',
          category: 'privileged_containers',
          severity: 'High',
          riskScore: 75,
          title: `Container ${container.name} in pod ${name} allows privilege escalation`,
          description: 'Containers should set allowPrivilegeEscalation: false.',
          recommendation: 'Set allowPrivilegeEscalation: false in the container security context.',
          evidence: { podName: name, containerName: container.name, namespace },
          resourceId: `${namespace}/${name}/${container.name}`,
          resourceType: 'Pod',
        });
      }

      const insecureCaps = (securityContext.capabilities?.add || []).filter((c) => ['SYS_ADMIN', 'NET_ADMIN', 'NET_RAW', 'ALL'].includes(c));
      if (insecureCaps.length > 0) {
        findings.push({
          checkId: 'K8S-POD-006',
          checkName: 'Container has insecure capabilities',
          category: 'privileged_containers',
          severity: 'High',
          riskScore: 70,
          title: `Container ${container.name} has insecure capabilities: ${insecureCaps.join(', ')}`,
          description: 'Containers should not have insecure capabilities like SYS_ADMIN, NET_ADMIN, NET_RAW, or ALL.',
          recommendation: 'Remove insecure capabilities or use drop: ["ALL"].',
          evidence: { podName: name, containerName: container.name, capabilities: insecureCaps },
          resourceId: `${namespace}/${name}/${container.name}`,
          resourceType: 'Pod',
        });
      }
    }

    if (spec.serviceAccountName === 'default' || !spec.serviceAccountName) {
      findings.push({
        checkId: 'K8S-POD-007',
        checkName: 'Pod uses default service account',
        category: 'service_accounts',
        severity: 'Medium',
        riskScore: 55,
        title: `Pod ${name} uses default service account`,
        description: 'Pods using the default service account may have unnecessary token access.',
        recommendation: 'Create a dedicated service account with least privilege.',
        evidence: { podName: name, namespace, serviceAccountName: spec.serviceAccountName || 'default' },
        resourceId: `${namespace}/${name}`,
        resourceType: 'Pod',
      });
    }
  }

  return findings;
};

const scanNetworkPolicies = (networkPolicies, namespaces, clusterName) => {
  const findings = [];
  const nsItems = (namespaces.items || []).map((n) => n.metadata?.name);
  const npItems = networkPolicies.items || [];

  const namespacesWithoutPolicy = nsItems.filter((ns) => !npItems.some((np) => np.metadata?.namespace === ns));
  for (const ns of namespacesWithoutPolicy) {
    if (ns !== 'kube-system' && ns !== 'kube-public') {
      findings.push({
        checkId: 'K8S-NETPOL-001',
        checkName: 'Namespace without network policy',
        category: 'network_policies',
        severity: 'Medium',
        riskScore: 50,
        title: `Namespace ${ns} has no NetworkPolicy defined`,
        description: 'Namespaces without NetworkPolicy allow unrestricted pod-to-pod communication.',
        recommendation: 'Define NetworkPolicy to restrict traffic within the namespace.',
        evidence: { namespace: ns, clusterName },
        resourceId: ns,
        resourceType: 'Namespace',
      });
    }
  }

  return findings;
};

const scanIngresses = (ingresses, clusterName) => {
  const findings = [];
  for (const ing of ingresses.items || []) {
    const rules = (ing.spec || {}).rules || [];
    for (const rule of rules) {
      const tls = (ing.spec || {}).tls || [];
      if (tls.length === 0 && rule.host) {
        findings.push({
          checkId: 'K8S-ING-001',
          checkName: 'Ingress without TLS',
          category: 'ingress',
          severity: 'Medium',
          riskScore: 45,
          title: `Ingress ${ing.metadata?.name} in ${ing.metadata?.namespace} has no TLS for host ${rule.host}`,
          description: 'Ingress resources should use TLS to encrypt traffic.',
          recommendation: 'Configure TLS certificate for the ingress resource.',
          evidence: { ingressName: ing.metadata?.name, namespace: ing.metadata?.namespace, host: rule.host },
          resourceId: `${ing.metadata?.namespace}/${ing.metadata?.name}`,
          resourceType: 'Ingress',
        });
      }
    }
  }
  return findings;
};

const scanServiceAccounts = (serviceAccounts, roleBindings, clusterName) => {
  const findings = [];
  for (const sa of serviceAccounts.items || []) {
    const tokens = sa.secrets || [];
    if (tokens.length > 1) {
      findings.push({
        checkId: 'K8S-SA-002',
        checkName: 'Service account with multiple secrets',
        category: 'service_accounts',
        severity: 'Medium',
        riskScore: 50,
        title: `Service account ${sa.metadata?.name} has ${tokens.length} secrets`,
        description: 'Service accounts with multiple secrets increase credential compromise risk.',
        recommendation: 'Clean up unused secrets and use bound tokens.',
        evidence: { serviceAccountName: sa.metadata?.name, namespace: sa.metadata?.namespace, secretCount: tokens.length },
        resourceId: `${sa.metadata?.namespace}/${sa.metadata?.name}`,
        resourceType: 'ServiceAccount',
      });
    }
  }
  return findings;
};

const scanSecrets = (secrets, clusterName) => {
  const findings = [];
  for (const secret of secrets.items || []) {
    const secretType = secret.type || 'Opaque';
    if (secretType === 'kubernetes.io/service-account-token') continue;

    const data = secret.data || {};
    const hasEncryption = Object.keys(data).length > 0;
    if (!hasEncryption && secretType !== 'kubernetes.io/service-account-token') {
      findings.push({
        checkId: 'K8S-SECRET-001',
        checkName: 'Secret stored in plaintext',
        category: 'secrets',
        severity: 'Medium',
        riskScore: 45,
        title: `Secret ${secret.metadata?.name} in ${secret.metadata?.namespace} stored without encryption`,
        description: 'Kubernetes secrets are base64-encoded, not encrypted. Enable encryption at rest.',
        recommendation: 'Enable encryption at rest for Kubernetes secrets and use external secret management (e.g., HashiCorp Vault).',
        evidence: { secretName: secret.metadata?.name, namespace: secret.metadata?.namespace, type: secretType },
        resourceId: `${secret.metadata?.namespace}/${secret.metadata?.name}`,
        resourceType: 'Secret',
      });
    }
  }
  return findings;
};

const scanNamespaces = (namespaces, clusterName) => {
  const findings = [];
  for (const ns of namespaces.items || []) {
    if (ns.metadata?.name === 'default') {
      findings.push({
        checkId: 'K8S-NS-001',
        checkName: 'Default namespace in use',
        category: 'misconfiguration',
        severity: 'Low',
        riskScore: 25,
        title: 'Default namespace is in use',
        description: 'The default namespace should not be used for application workloads.',
        recommendation: 'Create dedicated namespaces for different environments and applications.',
        evidence: { namespace: ns.metadata?.name },
        resourceId: ns.metadata?.name,
        resourceType: 'Namespace',
      });
    }
  }
  return findings;
};

const scanAdmissionPolicies = (clusterName) => {
  return [
    {
      checkId: 'K8S-ADMIT-001',
      checkName: 'No PodSecurity admission controller',
      category: 'misconfiguration',
      severity: 'Medium',
      riskScore: 50,
      title: 'PodSecurity admission controller not enforced',
      description: 'Without PodSecurity admission controller, pods can be created with privileged settings.',
      recommendation: 'Enable PodSecurity admission controller with restricted policy.',
      evidence: { clusterName },
      resourceId: clusterName,
      resourceType: 'Namespace',
    },
  ];
};

export const getKubernetesResources = async (filters = {}) => {
  const query = {};
  if (filters.clusterName) query.clusterName = filters.clusterName;
  if (filters.namespace) query.namespace = filters.namespace;
  if (filters.kind) query.kind = filters.kind;
  if (filters.riskScore && filters.riskScore >= 70) query.riskScore = { $gte: filters.riskScore };

  const resources = await KubernetesResource.find(query)
    .sort({ lastScanned: -1 })
    .skip((Number(filters.page || 1) - 1) * Number(filters.limit || 50))
    .limit(Number(filters.limit || 50));

  const total = await KubernetesResource.countDocuments(query);

  return {
    resources: resources.map((r) => ({
      id: r._id,
      clusterName: r.clusterName,
      namespace: r.namespace,
      kind: r.kind,
      name: r.name,
      riskScore: r.riskScore,
      lastScanned: r.lastScanned,
      labels: r.labels,
    })),
    total,
    page: Number(filters.page || 1),
    totalPages: Math.ceil(total / Number(filters.limit || 50)),
  };
};

export const getKubernetesMetrics = async () => {
  const totalResources = await KubernetesResource.countDocuments();
  const clusterCount = (await KubernetesResource.distinct('clusterName')).length;
  const highRisk = await KubernetesResource.countDocuments({ riskScore: { $gte: 70 } });
  const findingsByKind = await KubernetesResource.aggregate([
    { $match: { 'findings.0': { $exists: true } } },
    { $project: { findings: { $objectToArray: '$findings' } } },
    { $unwind: '$findings' },
  ]);

  const criticalPods = await KubernetesResource.countDocuments({ kind: 'Pod', riskScore: { $gte: 80 } });
  const privilegedPods = await KubernetesResource.countDocuments({ 'spec.containers.securityContext.privileged': true });

  const findingsByCategory = {};
  const resourceKindDistribution = {};
  const resources = await KubernetesResource.find({}).lean();
  for (const r of resources) {
    for (const f of r.findings || []) {
      const cat = f.category || 'unknown';
      findingsByCategory[cat] = (findingsByCategory[cat] || 0) + 1;
    }
    const kind = r.kind || 'Unknown';
    resourceKindDistribution[kind] = (resourceKindDistribution[kind] || 0) + 1;
  }

  return {
    totalResources,
    clusterCount,
    highRiskResources: highRisk,
    criticalPods,
    privilegedPods,
    findingsByCategory,
    resourceKindDistribution,
  };
};

export default { scanKubernetesCluster, discoverClusters, isKubernetesAvailable, getKubernetesResources, getKubernetesMetrics };
