import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useObservability } from '../../../hooks/observability/useObservability.js';
import endpoints from '../../../services/endpoints.js';
import Card from '../../../components/ui/Card.jsx';
import Skeleton from '../../../components/ui/Skeleton.jsx';
import StateView from '../../../components/ui/StateView.jsx';
import Badge from '../../../components/ui/Badge.jsx';

export default function ObservabilityDashboard() {
  const { metrics, health, alerts, dashboardData, loading, error } = useObservability();
  const [activeTab, setActiveTab] = useState('overview');

  const tabs = [
    { id: 'overview', label: 'System Overview' },
    { id: 'infrastructure', label: 'Infrastructure' },
    { id: 'application', label: 'Application' },
    { id: 'security', label: 'Security' },
    { id: 'ai', label: 'AI' },
    { id: 'cloud', label: 'Cloud' },
    { id: 'container', label: 'Container' },
    { id: 'executive', label: 'Executive' },
    { id: 'ueba', label: 'UEBA' },
    { id: 'health', label: 'Health' },
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  if (error) {
    return <StateView type="error" title="Failed to load Observability Dashboard" message="Check your connection and try again." />;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <motion.h1 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="text-2xl font-bold">Observability Dashboard</motion.h1>

      <div className="flex flex-wrap gap-2 border-b border-slate-200 dark:border-slate-700 pb-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-primary text-white'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <motion.div key={activeTab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        {activeTab === 'overview' && <div><h2 className="text-lg font-semibold mb-4">System Overview</h2><p className="text-slate-400">System health score, performance metrics, and live status.</p></div>}
        {activeTab === 'infrastructure' && <div><h2 className="text-lg font-semibold mb-4">Infrastructure</h2><p className="text-slate-400">CPU, memory, disk, MongoDB, and Socket.IO metrics.</p></div>}
        {activeTab === 'application' && <div><h2 className="text-lg font-semibold mb-4">Application</h2><p className="text-slate-400">HTTP requests, response times, API latency, and error rates.</p></div>}
        {activeTab === 'security' && <div><h2 className="text-lg font-semibold mb-4">Security</h2><p className="text-slate-400">Alerts, security events, and threat detection metrics.</p></div>}
        {activeTab === 'ai' && <div><h2 className="text-lg font-semibold mb-4">AI Services</h2><p className="text-slate-400">AI request metrics, tokens used, cache hits, and model performance.</p></div>}
        {activeTab === 'cloud' && <div><h2 className="text-lg font-semibold mb-4">Cloud</h2><p className="text-slate-400">Cloud provider metrics, container scanning, and Kubernetes status.</p></div>}
        {activeTab === 'container' && <div><h2 className="text-lg font-semibold mb-4">Container</h2><p className="text-slate-400">Docker and Kubernetes container runtime metrics.</p></div>}
        {activeTab === 'executive' && <div><h2 className="text-lg font-semibold mb-4">Executive</h2><p className="text-slate-400">Executive-level health scores, availability, and performance trends.</p></div>}
        {activeTab === 'ueba' && <div><h2 className="text-lg font-semibold mb-4">UEBA</h2><p className="text-slate-400">User behavior analytics, anomaly detection, and risk scoring.</p></div>}
        {activeTab === 'health' && <div><h2 className="text-lg font-semibold mb-4">Health Checks</h2><p className="text-slate-400">Detailed health check results for all monitored services.</p></div>}
      </motion.div>

      <Card title="Metrics Snapshot">
        <pre className="text-xs bg-slate-900 p-4 rounded-xl overflow-auto max-h-64 text-green-400">
          {JSON.stringify(metrics?.data || metrics, null, 2)}
        </pre>
      </Card>
    </div>
  );
}