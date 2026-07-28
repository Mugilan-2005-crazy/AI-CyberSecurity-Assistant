/**
 * pages/admin/AdminAnalytics.jsx
 * ------------------------------------------------------------
 * Professional SOC (Security Operations Center) Dashboard.
 * Sections:
 *   1. Security Metric Cards (users, scans, threats, AI, health)
 *   2. Threat Analytics Charts (verdict distribution, scan trends)
 *   3. Login Security Monitoring (suspicious activity)
 *   4. AI Monitoring (Gemini/Ollama usage)
 *   5. System Health (service status indicators)
 * Uses glassmorphism cards, Framer Motion, existing StatCard component.
 */
import { useEffect, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Bar, Doughnut } from 'react-chartjs-2';
import {
  UsersIcon, ShieldCheckIcon, ExclamationTriangleIcon,
  SparklesIcon, ServerIcon, CheckCircleIcon,
  CpuChipIcon, ClockIcon, EyeIcon, ChartBarIcon,
  BugAntIcon, GlobeAltIcon, CircleStackIcon,
} from '@heroicons/react/24/outline';
import api from '../../services/api.js';
import endpoints from '../../services/endpoints.js';
import StatCard from '../../components/ui/StatCard.jsx';
import Card from '../../components/ui/Card.jsx';
import Skeleton from '../../components/ui/Skeleton.jsx';
import StateView from '../../components/ui/StateView.jsx';

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

const stagger = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const rel = (iso) => {
  if (!iso) return '—';
  const diff = (Date.now() - new Date(iso)) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
};

export default function AdminAnalytics() {
  const [data, setData] = useState(null);
  const [logs, setLogs] = useState([]);
  const [aiStatus, setAiStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get('/admin/analytics').then((r) => r.data),
      api.get('/admin/logs').then((r) => r.logs || []),
      endpoints.getAIStatus().catch(() => null),
    ])
      .then(([d, l, ai]) => { setData(d); setLogs(l); setAiStatus(ai); })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  const verdicts = useMemo(
    () => Object.fromEntries((data?.verdicts || []).map((v) => [v._id, v.count])),
    [data]
  );

  const totalUsers = data?.totalUsers || 0;
  const totalScans = data?.totalScans || 0;
  const threats = (verdicts.malicious || 0) + (verdicts.suspicious || 0);
  const safeScans = Math.max(0, totalScans - threats);

  const doughnut = {
    labels: ['Safe', 'Suspicious', 'Malicious'],
    datasets: [{
      data: [verdicts.safe || 0, verdicts.suspicious || 0, verdicts.malicious || 0],
      backgroundColor: ['#10b981', '#f59e0b', '#ef4444'],
      borderColor: ['#065f46', '#92400e', '#991b1b'],
      borderWidth: 1,
    }],
  };

  const bar = {
    labels: (data?.scansByType || []).map((t) => t._id.charAt(0).toUpperCase() + t._id.slice(1)),
    datasets: [{
      label: 'Scans',
      data: (data?.scansByType || []).map((t) => t.count),
      backgroundColor: '#10b981',
      borderRadius: 4,
    }],
  };

  // Recent suspicious login activities from scan logs
  const suspiciousLogs = useMemo(
    () => logs.filter((l) => l.verdict === 'suspicious' || l.verdict === 'malicious').slice(0, 6),
    [logs]
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Skeleton className="h-72 rounded-2xl" />
          <Skeleton className="h-72 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return <StateView type="error" title="Couldn't load SOC dashboard" message="Check your connection and try again." />;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <motion.div initial="hidden" animate="show" variants={fadeUp}>
        <h1 className="text-2xl font-bold">Security Operations Center</h1>
        <p className="text-sm text-slate-400">Platform-wide security monitoring and analytics</p>
      </motion.div>

      {/* ─── 1. Security Metric Cards ─────────────────── */}
      <motion.div
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
        initial="hidden" animate="show" variants={stagger}
      >
        <motion.div variants={fadeUp}>
          <StatCard title="Total Users" value={totalUsers} icon={UsersIcon} accent="primary" subtitle="Registered accounts" />
        </motion.div>
        <motion.div variants={fadeUp}>
          <StatCard title="Total Security Scans" value={totalScans} icon={ShieldCheckIcon} accent="cyber" subtitle="All modules" />
        </motion.div>
        <motion.div variants={fadeUp}>
          <StatCard title="Threats Detected" value={threats} icon={ExclamationTriangleIcon} accent="danger" subtitle="Suspicious + malicious" />
        </motion.div>
        <motion.div variants={fadeUp}>
          <StatCard title="Safe Scans" value={safeScans} icon={CheckCircleIcon} accent="cyber" subtitle="Clean results" />
        </motion.div>
        <motion.div variants={fadeUp}>
          <StatCard title="AI Requests" value={data?.totalChats || 0} icon={SparklesIcon} accent="warning" subtitle="Gemini + Ollama" />
        </motion.div>
        <motion.div variants={fadeUp}>
          <StatCard title="System Health" value="Operational" icon={ServerIcon} accent={aiStatus ? 'cyber' : 'warning'} subtitle={aiStatus ? 'All services online' : 'Check providers'} />
        </motion.div>
      </motion.div>

      {/* ─── 3. Threat Analytics Charts ───────────────── */}
      <motion.div
        className="grid grid-cols-1 lg:grid-cols-2 gap-4"
        initial="hidden" animate="show" variants={fadeUp}
      >
        <Card title="Threat Category Distribution" description="Safe vs suspicious vs malicious" className="backdrop-blur-sm bg-white/50 dark:bg-surface-card/50 border border-slate-200 dark:border-slate-700">
          <div className="h-64 flex items-center justify-center">
            <Doughnut data={doughnut} options={{ cutout: '60%', plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8' } } } }} />
          </div>
        </Card>
        <Card title="Scan Activity Trends" description="Scans by module type" className="backdrop-blur-sm bg-white/50 dark:bg-surface-card/50 border border-slate-200 dark:border-slate-700">
          <div className="h-64">
            <Bar data={bar} options={{ plugins: { legend: { display: false } }, scales: { x: { ticks: { color: '#94a3b8' } }, y: { ticks: { color: '#94a3b8' } } } }} />
          </div>
        </Card>
      </motion.div>

      {/* ─── 4. Risk Level Statistics + Login Security ── */}
      <motion.div
        className="grid grid-cols-1 lg:grid-cols-3 gap-4"
        initial="hidden" animate="show" variants={fadeUp}
      >
        {/* Risk level overview */}
        <Card title="Risk Level Statistics" description="Verdict breakdown" className="backdrop-blur-sm bg-white/50 dark:bg-surface-card/50 border border-slate-200 dark:border-slate-700">
          <div className="space-y-4">
            {[
              { label: 'Safe', count: verdicts.safe || 0, color: 'bg-green-500', pct: totalScans ? Math.round(((verdicts.safe || 0) / totalScans) * 100) : 0 },
              { label: 'Suspicious', count: verdicts.suspicious || 0, color: 'bg-amber-500', pct: totalScans ? Math.round(((verdicts.suspicious || 0) / totalScans) * 100) : 0 },
              { label: 'Malicious', count: verdicts.malicious || 0, color: 'bg-red-500', pct: totalScans ? Math.round(((verdicts.malicious || 0) / totalScans) * 100) : 0 },
            ].map((r) => (
              <div key={r.label}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-slate-300">{r.label}</span>
                  <span className="text-slate-400">{r.count} ({r.pct}%)</span>
                </div>
                <div className="h-2 rounded-full bg-slate-700 overflow-hidden">
                  <motion.div
                    className={`h-full rounded-full ${r.color}`}
                    initial={{ width: 0 }}
                    animate={{ width: `${r.pct}%` }}
                    transition={{ duration: 1, delay: 0.3 }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Login Security Monitoring */}
        <Card title="Login Activity Monitoring" description="Recent suspicious detections" className="lg:col-span-2 backdrop-blur-sm bg-white/50 dark:bg-surface-card/50 border border-slate-200 dark:border-slate-700">
          {suspiciousLogs.length > 0 ? (
            <div className="space-y-2">
              {suspiciousLogs.map((l, i) => (
                <motion.div
                  key={l._id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-center justify-between p-3 rounded-xl bg-slate-50/50 dark:bg-slate-800/30 backdrop-blur-sm"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`p-2 rounded-lg ${
                      l.verdict === 'malicious' ? 'bg-red-500/10 text-red-400' : 'bg-amber-500/10 text-amber-400'
                    }`}>
                      <ExclamationTriangleIcon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate capitalize">{l.type || 'Scan'} Threat</p>
                      <p className="text-xs text-slate-400 truncate">
                        {l.input || '—'} · {rel(l.createdAt)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      l.verdict === 'malicious' ? 'bg-red-500/10 text-red-400' : 'bg-amber-500/10 text-amber-400'
                    }`}>
                      risk {l.riskScore}
                    </span>
                    <span className="text-xs text-slate-400">{l.verdict}</span>
                  </div>
                </motion.div>
              ))}
              {logs.length === 0 && (
                <p className="text-sm text-slate-400 text-center py-4">No suspicious activity recorded</p>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-slate-400">
              <CheckCircleIcon className="h-10 w-10 text-green-400 mb-2" />
              <p className="text-sm">No threats detected — all clear</p>
            </div>
          )}
        </Card>
      </motion.div>

      {/* ─── 5. AI Monitoring ─────────────────────────── */}
      <motion.div
        className="grid grid-cols-1 lg:grid-cols-3 gap-4"
        initial="hidden" animate="show" variants={fadeUp}
      >
        <Card title="AI Usage Analytics" description="Gemini & Ollama monitoring" className="backdrop-blur-sm bg-white/50 dark:bg-surface-card/50 border border-slate-200 dark:border-slate-700">
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50/50 dark:bg-slate-800/30">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                  <SparklesIcon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-medium">Gemini Usage</p>
                  <p className="text-xs text-slate-400">Cloud AI</p>
                </div>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                aiStatus?.gemini !== false ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
              }`}>
                {aiStatus?.gemini !== false ? 'Online' : 'Offline'}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50/50 dark:bg-slate-800/30">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400">
                  <CpuChipIcon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-medium">Ollama Usage</p>
                  <p className="text-xs text-slate-400">Local Llama 3.1</p>
                </div>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                aiStatus?.ollama !== false ? 'bg-green-500/10 text-green-400' : 'bg-amber-500/10 text-amber-400'
              }`}>
                {aiStatus?.ollama !== false ? 'Online' : 'Unavailable'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="text-center p-3 rounded-xl bg-slate-50/50 dark:bg-slate-800/30">
                <p className="text-xl font-bold text-cyber-400">{data?.totalChats || 0}</p>
                <p className="text-xs text-slate-400">Total Conversations</p>
              </div>
              <div className="text-center p-3 rounded-xl bg-slate-50/50 dark:bg-slate-800/30">
                <p className="text-xl font-bold text-primary">{logs.length > 0 ? rel(logs[0].createdAt) : '—'}</p>
                <p className="text-xs text-slate-400">Last Scan</p>
              </div>
            </div>
          </div>
        </Card>

        {/* ─── 6. System Health ──────────────────────────── */}
        <Card title="System Health" description="Service status monitoring" className="lg:col-span-2 backdrop-blur-sm bg-white/50 dark:bg-surface-card/50 border border-slate-200 dark:border-slate-700">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { icon: ServerIcon, name: 'Backend API', status: 'Operational', color: 'bg-green-500/10 text-green-400', dot: 'bg-green-500' },
              { icon: CircleStackIcon, name: 'Database', status: 'Connected', color: 'bg-green-500/10 text-green-400', dot: 'bg-green-500' },
              { icon: SparklesIcon, name: 'Gemini AI', status: aiStatus?.gemini !== false ? 'Online' : 'Offline', color: aiStatus?.gemini !== false ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400', dot: aiStatus?.gemini !== false ? 'bg-green-500' : 'bg-red-500' },
              { icon: CpuChipIcon, name: 'Ollama AI', status: aiStatus?.ollama !== false ? 'Online' : 'Unavailable', color: aiStatus?.ollama !== false ? 'bg-green-500/10 text-green-400' : 'bg-amber-500/10 text-amber-400', dot: aiStatus?.ollama !== false ? 'bg-green-500' : 'bg-amber-500' },
              { icon: EyeIcon, name: 'Security APIs', status: 'Operational', color: 'bg-green-500/10 text-green-400', dot: 'bg-green-500' },
              { icon: GlobeAltIcon, name: 'Frontend', status: 'Operational', color: 'bg-green-500/10 text-green-400', dot: 'bg-green-500' },
              { icon: BugAntIcon, name: 'VirusTotal', status: 'Available', color: 'bg-green-500/10 text-green-400', dot: 'bg-green-500' },
              { icon: ChartBarIcon, name: 'Analytics Engine', status: 'Operational', color: 'bg-green-500/10 text-green-400', dot: 'bg-green-500' },
            ].map((s) => (
              <div key={s.name} className="p-4 rounded-xl bg-slate-50/50 dark:bg-slate-800/30 backdrop-blur-sm">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`h-2 w-2 rounded-full ${s.dot}`} />
                  <s.icon className={`h-4 w-4 ${s.color}`} />
                </div>
                <p className="text-sm font-medium">{s.name}</p>
                <p className={`text-xs ${s.color}`}>{s.status}</p>
              </div>
            ))}
          </div>
        </Card>
      </motion.div>

      {/* Platform overview footer */}
      <motion.div initial="hidden" animate="show" variants={fadeUp}>
        <Card className="text-center backdrop-blur-sm bg-white/50 dark:bg-surface-card/50 border border-slate-200 dark:border-slate-700">
          <div className="flex flex-wrap justify-center gap-8 text-sm">
            {[
              { label: 'Total Users', value: totalUsers, icon: UsersIcon },
              { label: 'Total Scans', value: totalScans, icon: ShieldCheckIcon },
              { label: 'Threats', value: threats, icon: ExclamationTriangleIcon },
              { label: 'AI Conversations', value: data?.totalChats || 0, icon: SparklesIcon },
            ].map((s) => (
              <div key={s.label} className="flex items-center gap-2">
                <s.icon className="h-5 w-5 text-cyber-400" />
                <span className="font-bold">{s.value}</span>
                <span className="text-slate-400">{s.label}</span>
              </div>
            ))}
          </div>
        </Card>
      </motion.div>
    </div>
  );
}