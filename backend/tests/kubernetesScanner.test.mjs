import { describe, test, expect, jest, afterEach } from '@jest/globals';

const mockExec = jest.fn();
jest.unstable_mockModule('child_process', () => ({
  exec: mockExec,
}));
jest.unstable_mockModule('util', () => ({
  promisify: jest.fn(() => mockExec),
}));

const {
  scanKubernetesCluster,
  discoverClusters,
  isKubernetesAvailable,
  getKubernetesMetrics,
  getKubernetesResources,
} = await import('../src/services/cloud/kubernetesScanner.js');

afterEach(() => {
  mockExec.mockClear();
});

describe('Kubernetes Scanner — Resilience', () => {
  const sampleNodeOutput = 'NAME   STATUS   ROLES    AGE   VERSION\nnode1   Ready    <none>   1d    v1.28.0';

  const sampleResources = {
    pods: { items: [] },
    services: { items: [] },
    namespaces: { items: [] },
    deployments: { items: [] },
    ingresses: { items: [] },
    serviceAccounts: { items: [] },
    roles: { items: [] },
    roleBindings: { items: [] },
    clusterRoles: { items: [] },
    clusterRoleBindings: { items: [] },
    networkPolicies: { items: [] },
    secrets: { items: [] },
  };

  const mockResponseFor = (command) => {
    if (command.includes('get nodes')) return { stdout: sampleNodeOutput };
    if (command.includes('get pods -A -o json')) return { stdout: JSON.stringify(sampleResources.pods) };
    if (command.includes('get services -A -o json')) return { stdout: JSON.stringify(sampleResources.services) };
    if (command.includes('get namespaces -o json')) return { stdout: JSON.stringify(sampleResources.namespaces) };
    if (command.includes('get deployments -A -o json')) return { stdout: JSON.stringify(sampleResources.deployments) };
    if (command.includes('get ingress -A -o json')) return { stdout: JSON.stringify(sampleResources.ingresses) };
    if (command.includes('get serviceaccounts -A -o json')) return { stdout: JSON.stringify(sampleResources.serviceAccounts) };
    if (command.includes('get roles -A -o json')) return { stdout: JSON.stringify(sampleResources.roles) };
    if (command.includes('get rolebindings -A -o json')) return { stdout: JSON.stringify(sampleResources.roleBindings) };
    if (command.includes('get clusterroles -o json')) return { stdout: JSON.stringify(sampleResources.clusterRoles) };
    if (command.includes('get clusterrolebindings -o json')) return { stdout: JSON.stringify(sampleResources.clusterRoleBindings) };
    if (command.includes('get networkpolicies -A -o json')) return { stdout: JSON.stringify(sampleResources.networkPolicies) };
    if (command.includes('get secrets -A -o json')) return { stdout: JSON.stringify(sampleResources.secrets) };
    return { stdout: '' };
  };

  test('kubectl available — scanner executes normally', async () => {
    mockExec.mockImplementation(mockResponseFor);

    const result = await scanKubernetesCluster({ clusterName: 'test-cluster' });
    expect(result).toHaveProperty('clusterName', 'test-cluster');
    expect(result).toHaveProperty('findings');
    expect(Array.isArray(result.findings)).toBe(true);
    expect(result).toHaveProperty('riskScore');
  });

  test('kubectl unavailable — scanner returns skipped status', async () => {
    mockExec.mockRejectedValue(new Error('kubectl: command not found'));

    const result = await scanKubernetesCluster({ clusterName: 'test-cluster' });
    expect(result).toEqual({
      status: 'skipped',
      message: 'Kubernetes cluster unavailable - scan skipped',
    });
  });

  test('kubectl command failure — graceful handling without throwing', async () => {
    mockExec
      .mockResolvedValueOnce({ stdout: sampleNodeOutput })
      .mockRejectedValueOnce(new Error('dial tcp localhost:8080 connection refused'))
      .mockResolvedValue({ stdout: JSON.stringify({ items: [] }) });

    const result = await scanKubernetesCluster({ clusterName: 'test-cluster' });
    expect(result).toHaveProperty('clusterName', 'test-cluster');
    expect(result).toHaveProperty('findings');
    expect(Array.isArray(result.findings)).toBe(true);
  });
});
