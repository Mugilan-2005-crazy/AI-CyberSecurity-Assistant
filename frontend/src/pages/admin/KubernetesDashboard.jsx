import { useEffect, useState, useCallback } from 'react';
import { toast } from 'react-toastify';
import {
  ServerStackIcon, ShieldCheckIcon, ExclamationTriangleIcon,
  KeyIcon, GlobeAltIcon, LockClosedIcon,
  UsersIcon, CheckCircleIcon, XCircleIcon,
} from '@heroicons/react/24/outline';
import endpoints from '../../services/endpoints.js';
import StatCard from '../../components/ui/StatCard.jsx';
import Card from '../../components/ui/Card.jsx';
import Skeleton from '../../components/ui/Skeleton.jsx';
import StateView from '../../components/ui/StateView.jsx';
import Badge from '../../components/ui/Badge.jsx';
import Button from '../../components/ui/Button.jsx';
import RiskLevel from '../../components/ui/RiskLevel.jsx';
import { useSocket } from '../../hooks/useSocket.js';

const kindIcons = {
  Pod: ServerStackIcon,
  Deployment: CubeIcon,
  Service: NetworkArrowRightIcon,
  Ingress: LockClosedIcon,
  Secret: KeyIcon,
  ServiceAccount: UsersIcon,
  Role: ShieldCheckIcon,
  RoleBinding: ShieldCheckIcon,
  ClusterRole: ShieldCheckIcon,
  ClusterRoleBinding: ShieldCheckIcon,
  NetworkPolicy: NetworkArrowRightIcon,
  Node: ServerStackIcon,
  Namespace: ShieldCheckIcon,
};

import { CubeIcon } from '@heroicons/react/24/outline';

export default function KubernetesDashboard() {
  const socket = useSocket(true);
  const [metrics, setMetrics] = useState(null);
  const [resources, setResources] = useState([]);
  const [clusters, setClusters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [selectedCluster, setSelectedCluster] = useState(null);

  const loadMetrics = useCallback(async () => {
    try {
      setLoading(true);
      const [metricsData, clustersData, resourcesData] = await Promise.all([
        endpoints.getK8sMetrics().catch(() => null),
        endpoints.getK8sClusters().catch(() => []),
        endpoints.getK8sResources({ page: 1, limit: 20 }).catch(() => ({ resources: [] })),
      ]);
      setMetrics(metricsData);
      setClusters(clustersData);
      setResources(resourcesData?.resources || []);
    } catch (err) {
      console.error('[KubernetesDashboard] Failed to load data', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleScan = async () => {
    setScanning(true);
    try {
      await endpoints.k8sScan({ clusterName: selectedCluster || undefined });
      toast.info('Kubernetes scan started');
      setTimeout(loadMetrics, 5000);
    } catch (err) {
      toast.error('Failed to start scan');
    } finally {
      setScanning(false);
    }
  };

  useEffect(() => {
    loadMetrics();
    document.title = 'Kubernetes Security | CyberSec Assistant';

    socket.on('k8s.scan.completed', (data) => {
      toast.success(`K8s scan completed — ${data?.findingCount} findings`);
      loadMetrics();
    });

    return () => {
      socket.off('k8s.scan.completed');
    };
  }, [socket, loadMetrics, selectedCluster]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Kubernetes Security</h1>
        <div className="flex gap-3">
          {clusters.length > 0 && (
            <select value={selectedCluster || ''} onChange={(e) => setSelectedCluster(e.target.value || null)} className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-800 rounded-lg focus:ring-2 focus:ring-blue-500">
              <option value="">All clusters</option>
              {clusters.map((c) => (
                <option key={c.clusterName} value={c.clusterName}>{c.clusterName} ({c.isCurrentContext ? 'current' : ''})</option>
              ))}
            </select>
          )}
          <Button onClick={handleScan} disabled={scanning}>
            {scanning ? 'Scanning...' : 'Scan Cluster'}
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <StatCard title="Total Resources" value={metrics?.totalResources || 0} icon={ServerStackIcon} color="blue" />
          <StatCard title="Clusters" value={metrics?.clusterCount || clusters.length} icon={ShieldCheckIcon} color="purple" />
          <StatCard title="High Risk" value={metrics?.highRiskResources || 0} icon={ExclamationTriangleIcon} color="red" />
          <StatCard title="Critical Pods" value={metrics?.criticalPods || 0} icon={ExclamationTriangleIcon} color="orange" />
          <StatCard title="Privileged Pods" value={metrics?.privilegedPods || 0} icon={LockClosedIcon} color="red" />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Findings by Category" icon={ExclamationTriangleIcon}>
          {metrics?.findingsByCategory ? (
            <div className="space-y-3">
              {Object.entries(metrics.findingsByCategory)
                .sort(([, a], [, b]) => b - a)
                .map(([category, count]) => (
                  <div key={category} className="flex items-center justify-between">
                    <span className="text-sm text-gray-700 dark:text-gray-300">{category.replace(/_/g, ' ')}</span>
                    <Badge variant={count > 5 ? 'danger' : count > 2 ? 'warning' : 'info'}>{count}</Badge>
                  </div>
                ))}
            </div>
          ) : (
            <StateView state="empty" message="No K8s findings yet" />
          )}
        </Card>

        <Card title="Resource Kind Distribution" icon={CubeIcon}>
          {metrics?.resourceKindDistribution ? (
            <div className="space-y-3">
              {Object.entries(metrics.resourceKindDistribution)
                .sort(([, a], [, b]) => b - a)
                .map(([kind, count]) => {
                  const Icon = kindIcons[kind] || CubeIcon;
                  return (
                    <div key={kind} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Icon className="w-4 h-4 text-gray-500" />
                        <span className="text-sm text-gray-700 dark:text-gray-300">{kind}</span>
                      </div>
                      <Badge variant="outline">{count}</Badge>
                    </div>
                  );
                })}
            </div>
          ) : (
            <StateView state="empty" message="No resources found" />
          )}
        </Card>
      </div>

      <Card title="Recent Resources" icon={ServerStackIcon}>
        {resources.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-2 text-gray-500 dark:text-gray-400">Kind</th>
                  <th className="text-left py-2 text-gray-500 dark:text-gray-400">Name</th>
                  <th className="text-left py-2 text-gray-500 dark:text-gray-400">Namespace</th>
                  <th className="text-left py-2 text-gray-500 dark:text-gray-400">Cluster</th>
                  <th className="text-left py-2 text-gray-500 dark:text-gray-400">Risk</th>
                </tr>
              </thead>
              <tbody>
                {resources.slice(0, 15).map((r) => {
                  const Icon = kindIcons[r.kind] || CubeIcon;
                  return (
                    <tr key={r.id} className="border-b border-gray-200 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="py-2 flex items-center gap-2"><Icon className="w-4 h-4 text-gray-500" /><span>{r.kind}</span></td>
                      <td className="py-2 font-mono text-sm">{r.name}</td>
                      <td className="py-2 text-gray-500 dark:text-gray-400">{r.namespace}</td>
                      <td className="py-2 text-gray-500 dark:text-gray-400">{r.clusterName}</td>
                      <td className="py-2"><RiskLevel score={r.riskScore} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <StateView state="empty" message="No Kubernetes resources found. Run a scan to populate." />
        )}
      </Card>
    </div>
  );
}
