import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';
import {
  CloudIcon, ExclamationTriangleIcon, ShieldCheckIcon,
  ServerStackIcon, ClockIcon, CheckCircleIcon,
  XCircleIcon, MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';
import endpoints from '../../services/endpoints.js';
import useCloudSecurity from '../../hooks/useCloudSecurity.js';
import StatCard from '../../components/ui/StatCard.jsx';
import Card from '../../components/ui/Card.jsx';
import Skeleton from '../../components/ui/Skeleton.jsx';
import StateView from '../../components/ui/StateView.jsx';
import Badge from '../../components/ui/Badge.jsx';
import Button from '../../components/ui/Button.jsx';
import RiskLevel from '../../components/ui/RiskLevel.jsx';

const severityColors = {
  Critical: 'bg-red-500 text-white',
  High: 'bg-orange-500 text-white',
  Medium: 'bg-yellow-500 text-black',
  Low: 'bg-blue-500 text-white',
};

const categoryLabels = {
  iam_misconfiguration: 'IAM Misconfigurations',
  privilege_escalation: 'Privilege Escalation',
  inactive_keys: 'Inactive Keys',
  unused_privileges: 'Unused Privileges',
  weak_policies: 'Weak Policies',
  secrets_exposure: 'Secrets Exposure',
  public_storage: 'Public Storage',
  network_misconfiguration: 'Network Misconfiguration',
  open_security_groups: 'Open Security Groups',
};

const providerIcons = {
  aws: CloudIcon,
  azure: ServerStackIcon,
  gcp: ShieldCheckIcon,
};

export default function CloudSecurityDashboard() {
  const { t } = useTranslation();
  const { metrics, riskScore, findings, providers, loading, refreshMetrics, startScan } = useCloudSecurity({
    onScanCompleted: (data) => {
      toast.success(`Cloud scan completed for ${data?.provider || 'all providers'} — ${data?.result?.totalFindings || 0} findings`);
      refreshMetrics();
    },
    onRiskUpdated: (data) => {
      if (data && data.riskScore !== undefined) {
        toast.info(`Cloud risk updated: ${data.riskScore}`, { autoClose: 3000 });
      }
    },
  });

  const [selectedProvider, setSelectedProvider] = useState(null);
  const [findingsFilter, setFindingsFilter] = useState('all');
  const [scanning, setScanning] = useState(false);

  const handleScanAll = async () => {
    setScanning(true);
    try {
      await startScan(null);
      toast.info('Cloud scan started for all providers');
    } catch (err) {
      toast.error('Failed to start scan');
    } finally {
      setScanning(false);
    }
  };

  const handleScanProvider = async (provider) => {
    setScanning(true);
    try {
      await startScan(provider);
      toast.info(`Cloud scan started for ${provider}`);
    } catch (err) {
      toast.error('Failed to start scan');
    } finally {
      setScanning(false);
    }
  };

  const filteredFindings = findingsFilter === 'all' ? findings : findings.filter((f) => f.severity === findingsFilter);

  useEffect(() => {
    document.title = 'Cloud Security Dashboard | CyberSec Assistant';
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Cloud Security Posture Management</h1>
        <div className="flex gap-3">
          <Button variant="outline" size="sm" onClick={selectedProvider ? () => handleScanProvider(selectedProvider) : handleScanAll} disabled={scanning}>
            {scanning ? 'Scanning...' : selectedProvider ? `Scan ${selectedProvider}` : 'Scan All Clouds'}
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard
            title="Cloud Security Score"
            value={`${metrics?.overallRiskScore !== undefined ? 100 - metrics.overallRiskScore : 0}/100`}
            icon={ShieldCheckIcon}
            color={metrics?.overallRiskScore > 70 ? 'red' : metrics?.overallRiskScore > 50 ? 'yellow' : 'green'}
            trend={metrics?.providers && Object.keys(metrics.providers).length > 0 ? 'active' : 'no-data'}
          />
          <StatCard
            title="Total Findings"
            value={metrics?.totalFindings || findings.length}
            icon={ExclamationTriangleIcon}
            color={metrics?.totalFindings > 50 ? 'red' : metrics?.totalFindings > 20 ? 'yellow' : 'green'}
          />
          <StatCard
            title="Critical Findings"
            value={metrics?.severityDistribution?.Critical || 0}
            icon={XCircleIcon}
            color="red"
          />
          <StatCard
            title="Compliance Score"
            value={`${metrics?.complianceScore || 100}%`}
            icon={CheckCircleIcon}
            color={metrics?.complianceScore > 80 ? 'green' : metrics?.complianceScore > 60 ? 'yellow' : 'red'}
          />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card title="Provider Comparison" icon={CloudIcon} className="lg:col-span-2">
          {providers && providers.length > 0 ? (
            <div className="space-y-4">
              {providers.map((provider) => {
                const Icon = providerIcons[provider.provider] || CloudIcon;
                const provMetrics = metrics?.providerMetrics?.[provider.provider];
                return (
                  <motion.div key={provider._id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" onClick={() => setSelectedProvider(provider.provider)}>
                    <div className="flex items-center gap-3">
                      <Icon className="w-6 h-6 text-blue-500" />
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{provider.name || provider.accountName}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{provider.provider.toUpperCase()} • {provider.accountId}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <RiskLevel score={provMetrics?.riskScore || provider.riskScore || 0} showLabel />
                      <Badge variant={provMetrics?.criticalFindings > 0 ? 'danger' : provMetrics?.highFindings > 0 ? 'warning' : 'success'}>
                        {provMetrics?.totalFindings || 0} findings
                      </Badge>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <StateView state="empty" message="No cloud providers configured" actionLabel="Add Provider" onAction={() => toast.info('Use API: POST /api/cloud-security/providers')} />
          )}
        </Card>

        <Card title="Risk by Category" icon={ExclamationTriangleIcon}>
          {metrics?.categoryDistribution && Object.keys(metrics.categoryDistribution).length > 0 ? (
            <div className="space-y-3">
              {Object.entries(metrics.categoryDistribution)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 8)
                .map(([category, count]) => (
                  <div key={category} className="flex items-center justify-between">
                    <span className="text-sm text-gray-700 dark:text-gray-300">{categoryLabels[category] || category}</span>
                    <Badge variant={count > 5 ? 'danger' : count > 2 ? 'warning' : 'info'}>{count}</Badge>
                  </div>
                ))}
            </div>
          ) : (
            <StateView state="empty" message="No findings yet" />
          )}
        </Card>
      </div>

      <Card title="Security Findings" icon={ExclamationTriangleIcon}>
        <div className="flex gap-2 mb-4">
          {['all', 'Critical', 'High', 'Medium', 'Low'].map((filter) => (
            <Button key={filter} variant={findingsFilter === filter ? 'primary' : 'outline'} size="sm" onClick={() => setFindingsFilter(filter === 'all' ? 'all' : filter)}>
              {filter === 'all' ? 'All' : filter}
            </Button>
          ))}
        </div>

        {filteredFindings.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-2 text-gray-500 dark:text-gray-400 font-medium">Severity</th>
                  <th className="text-left py-2 text-gray-500 dark:text-gray-400 font-medium">Finding</th>
                  <th className="text-left py-2 text-gray-500 dark:text-gray-400 font-medium">Category</th>
                  <th className="text-left py-2 text-gray-500 dark:text-gray-400 font-medium">Provider</th>
                  <th className="text-left py-2 text-gray-500 dark:text-gray-400 font-medium">Risk</th>
                  <th className="text-left py-2 text-gray-500 dark:text-gray-400 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredFindings.slice(0, 20).map((finding) => (
                  <tr key={finding._id || finding.id} className="border-b border-gray-200 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="py-2"><Badge variant={finding.severity === 'Critical' ? 'danger' : finding.severity === 'High' ? 'warning' : 'info'}>{finding.severity}</Badge></td>
                    <td className="py-2">{finding.title}</td>
                    <td className="py-2 text-gray-500 dark:text-gray-400">{categoryLabels[finding.checkCategory] || finding.checkCategory}</td>
                    <td className="py-2">{finding.cloudProvider?.toUpperCase()}</td>
                    <td className="py-2">{finding.riskScore}</td>
                    <td className="py-2"><Badge variant="outline">{finding.status}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <StateView state="empty" message="No findings match the selected filter" />
        )}
      </Card>
    </div>
  );
}
