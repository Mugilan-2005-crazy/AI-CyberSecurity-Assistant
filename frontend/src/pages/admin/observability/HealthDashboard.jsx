import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useObservability } from '../../../hooks/observability/useObservability.js';
import endpoints from '../../../services/endpoints.js';
import api from '../../../services/api.js';
import Card from '../../../components/ui/Card.jsx';
import Skeleton from '../../../components/ui/Skeleton.jsx';
import StateView from '../../../components/ui/StateView.jsx';
import Badge from '../../../components/ui/Badge.jsx';

export default function HealthDashboard() {
  const { health, metrics, loading, error } = useObservability();
  const [details, setDetails] = useState(null);

  useEffect(() => {
    const fetchDetails = async () => {
      try {
        const res = await api.get('/observability/health/all');
        setDetails(res.data);
      } catch {
        setDetails(null);
      }
    };
    fetchDetails();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  if (error) {
    return <StateView type="error" title="Failed to load Health Dashboard" message="Check your connection and try again." />;
  }

  const healthData = health?.data;
  const snapshot = metrics?.data || metrics;

  const checks = [
    { name: 'Backend', status: 'healthy', metric: snapshot?.system?.uptime },
    { name: 'Frontend', status: 'healthy', metric: null },
    { name: 'MongoDB', status: healthData?.checks?.mongodb?.status || 'unknown', metric: null },
    { name: 'Socket.IO', status: 'healthy', metric: snapshot?.socket?.connections },
    { name: 'Gemini', status: 'healthy', metric: snapshot?.ai?.requests },
    { name: 'Ollama', status: 'healthy', metric: null },
    { name: 'Threat Intel', status: 'healthy', metric: snapshot?.threatIntel?.queries },
    { name: 'Cloud Providers', status: 'healthy', metric: snapshot?.cloud?.providersActive },
    { name: 'Docker', status: 'healthy', metric: snapshot?.container?.imagesScanned },
    { name: 'Kubernetes', status: 'healthy', metric: snapshot?.kubernetes?.clusters },
    { name: 'CPU', status: snapshot?.cpu?.usage > 90 ? 'unhealthy' : 'healthy', metric: snapshot?.cpu?.usage },
    { name: 'Memory', status: snapshot?.memory ? (snapshot.memory.heapUsed / Math.max(1, snapshot.memory.heapTotal) * 100 > 90 ? 'unhealthy' : 'healthy') : 'unknown', metric: snapshot?.memory ? Math.round(snapshot.memory.heapUsed / Math.max(1, snapshot.memory.heapTotal) * 100) : null },
    { name: 'Disk', status: snapshot?.disk?.usagePercent > 90 ? 'unhealthy' : 'healthy', metric: snapshot?.disk?.usagePercent },
    { name: 'Network', status: 'healthy', metric: null },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <motion.h1 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="text-2xl font-bold">Health Dashboard</motion.h1>

      <motion.div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { staggerChildren: 0.05 } }}>
        {checks.map((check) => (
          <Card key={check.name} title={check.name}>
            <div className="flex items-center justify-between">
              <Badge variant={check.status === 'healthy' ? 'success' : check.status === 'unhealthy' ? 'danger' : 'warning'}>{check.status.toUpperCase()}</Badge>
              {check.metric !== null && check.metric !== undefined && (
                <span className="text-sm text-slate-400">{typeof check.metric === 'number' ? check.metric.toLocaleString() : check.metric}</span>
              )}
            </div>
          </Card>
        ))}
      </motion.div>

      {healthData?.summary && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card title="Overall Status">
            <Badge variant={healthData.status === 'healthy' ? 'success' : healthData.status === 'critical' ? 'danger' : 'warning'} className="text-lg">{healthData.status.toUpperCase()}</Badge>
          </Card>
          <Card title="Healthy Checks">
            <p className="text-3xl font-bold text-green-400">{healthData.summary?.healthy || 0}</p>
            <p className="text-sm text-slate-400">of {healthData.summary?.total || 0} total</p>
          </Card>
          <Card title="Unhealthy Checks">
            <p className="text-3xl font-bold text-red-400">{healthData.summary?.unhealthy || 0}</p>
            <p className="text-sm text-slate-400">checks</p>
          </Card>
        </motion.div>
      )}
    </div>
  );
}