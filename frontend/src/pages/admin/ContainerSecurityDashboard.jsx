import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';
import {
  CubeIcon, CloudArrowUpIcon, ExclamationTriangleIcon,
  ShieldCheckIcon, CheckCircleIcon, XCircleIcon,
  ClockIcon, MagnifyingGlassIcon,
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

const severityColors = {
  Critical: 'bg-red-500 text-white',
  High: 'bg-orange-500 text-white',
  Medium: 'bg-yellow-500 text-black',
  Low: 'bg-blue-500 text-white',
};

export default function ContainerSecurityDashboard() {
  const { t } = useTranslation();
  const socket = useSocket(true);
  const [metrics, setMetrics] = useState(null);
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [scanImageName, setScanImageName] = useState('');

  const loadMetrics = useCallback(async () => {
    try {
      setLoading(true);
      const [metricsData, imagesData] = await Promise.all([
        endpoints.getContainerMetrics().catch(() => null),
        endpoints.getContainerImages({ page: 1, limit: 20 }).catch(() => ({ images: [] })),
      ]);
      setMetrics(metricsData);
      setImages(imagesData?.images || []);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleScanImage = async () => {
    if (!scanImageName.trim()) {
      toast.error('Please enter an image name');
      return;
    }
    setScanning(true);
    try {
      await endpoints.scanContainerImage(scanImageName);
      toast.info(`Scan started for ${scanImageName}`);
      setScanImageName('');
      setTimeout(loadMetrics, 5000);
    } catch (err) {
      toast.error('Failed to start scan');
    } finally {
      setScanning(false);
    }
  };

  const handleScanRunning = async () => {
    setScanning(true);
    try {
      await endpoints.scanRunningContainers();
      toast.info('Running container scan started');
      setTimeout(loadMetrics, 5000);
    } catch (err) {
      toast.error('Failed to start scan');
    } finally {
      setScanning(false);
    }
  };

  useEffect(() => {
    loadMetrics();
    document.title = 'Container Security | CyberSec Assistant';

    socket.on('container.scan.completed', () => {
      loadMetrics();
      toast.success('Container scan completed');
    });

    return () => {
      socket.off('container.scan.completed');
    };
  }, [socket, loadMetrics]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Container Security</h1>
        <div className="flex gap-3">
          <div className="flex gap-2">
            <input type="text" placeholder="image:tag" value={scanImageName} onChange={(e) => setScanImageName(e.target.value)} className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-800 rounded-lg focus:ring-2 focus:ring-blue-500" />
            <Button size="sm" onClick={handleScanImage} disabled={scanning || !scanImageName.trim()}>Scan Image</Button>
          </div>
          <Button variant="outline" size="sm" onClick={handleScanRunning} disabled={scanning}>Scan Running</Button>
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
          <StatCard title="Total Images" value={metrics?.totalImages || 0} icon={CubeIcon} color="blue" />
          <StatCard title="High Risk Images" value={metrics?.highRiskImages || 0} icon={ExclamationTriangleIcon} color="red" />
          <StatCard title="Critical Vulnerabilities" value={metrics?.criticalVulnerabilities || 0} icon={XCircleIcon} color="red" />
          <StatCard title="Secrets Found" value={metrics?.totalSecretsFound || 0} icon={ShieldCheckIcon} color="orange" />
          <StatCard title="Misconfigurations" value={metrics?.totalMisconfigurations || 0} icon={CloudArrowUpIcon} color="yellow" />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card title="Risk Distribution" icon={ShieldCheckIcon} className="lg:col-span-1">
          {metrics?.riskDistribution ? (
            <div className="space-y-3">
              {Object.entries(metrics.riskDistribution).map(([level, count]) => (
                <div key={level} className="flex items-center justify-between">
                  <span className={`text-sm ${level === 'Critical' ? 'text-red-500' : level === 'High' ? 'text-orange-500' : level === 'Medium' ? 'text-yellow-500' : 'text-blue-500'}`}>{level}</span>
                  <Badge variant={level === 'Critical' ? 'danger' : level === 'High' ? 'warning' : 'info'}>{count}</Badge>
                </div>
              ))}
            </div>
          ) : (
            <StateView state="empty" message="No data" />
          )}
        </Card>

        <Card title="Vulnerable Images" icon={CubeIcon} className="lg:col-span-2">
          {images.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-2 text-gray-500 dark:text-gray-400">Image</th>
                    <th className="text-left py-2 text-gray-500 dark:text-gray-400">Tag</th>
                    <th className="text-left py-2 text-gray-500 dark:text-gray-400">Vulns</th>
                    <th className="text-left py-2 text-gray-500 dark:text-gray-400">Secrets</th>
                    <th className="text-left py-2 text-gray-500 dark:text-gray-400">Misconfig</th>
                    <th className="text-left py-2 text-gray-500 dark:text-gray-400">Risk</th>
                  </tr>
                </thead>
                <tbody>
                  {images.slice(0, 10).map((img) => (
                    <tr key={img.id} className="border-b border-gray-200 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="py-2 font-mono text-sm">{img.imageName}</td>
                      <td className="py-2 text-gray-500 dark:text-gray-400">{img.imageTag}</td>
                      <td className="py-2">{img.vulnerabilities?.length || 0}</td>
                      <td className="py-2">{img.secrets?.length || 0}</td>
                      <td className="py-2">{img.misconfigurations?.length || 0}</td>
                      <td className="py-2"><RiskLevel score={img.riskScore} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <StateView state="empty" message="No container images scanned" />
          )}
        </Card>
      </div>
    </div>
  );
}
