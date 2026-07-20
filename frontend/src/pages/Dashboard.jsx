/**
 * pages/Dashboard.jsx
 * ------------------------------------------------------------
 * Enterprise security dashboard (Phase 2 polish). Composes:
 *   - 6 KPI cards with animated counters + trend
 *   - Security score gauge + per-module risk-level indicators
 *   - 3 interactive charts (Weekly Threat, Scan Stats, Distribution)
 *   - Recent Activity timeline
 *   - Notifications panel
 * Uses skeletons while loading and a graceful error state.
 */
import { useEffect, useState, useMemo } from 'react';
import { ShieldCheckIcon, ExclamationTriangleIcon, CheckCircleIcon, EnvelopeIcon, BugAntIcon, QrCodeIcon, LinkIcon } from '@heroicons/react/24/outline';
import { AnimatePresence } from 'framer-motion';
import endpoints from '../services/endpoints.js';
import StatCard from '../components/dashboard/StatCard.jsx';
import Card from '../components/ui/Card.jsx';
import Skeleton from '../components/ui/Skeleton.jsx';
import StateView from '../components/ui/StateView.jsx';
import AnimatedCounter from '../components/ui/AnimatedCounter.jsx';
import SecurityGauge from '../components/ui/SecurityGauge.jsx';
import RiskLevel from '../components/ui/RiskLevel.jsx';
import ThreatChart from '../components/dashboard/ThreatChart.jsx';
import ScanStatsChart from '../components/dashboard/ScanStatsChart.jsx';
import ThreatDistributionChart from '../components/dashboard/ThreatDistributionChart.jsx';
import ActivityTimeline from '../components/dashboard/ActivityTimeline.jsx';
import NotificationsPanel from '../components/dashboard/NotificationsPanel.jsx';

const MODULE_ORDER = ['url', 'password', 'email', 'file', 'qr'];
const MODULE_LABEL = { url: 'URL', password: 'Password', email: 'Email', file: 'File', qr: 'QR' };

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [notes, setNotes] = useState([]);
  const [showNotes, setShowNotes] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    Promise.all([endpoints.getDashboard(), endpoints.getNotifications().catch(() => [])])
      .then(([d, n]) => { setData(d); setNotes(n); })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  const byType = useMemo(
    () => Object.fromEntries((data?.typeBreakdown || []).map((t) => [t._id, t.count])),
    [data]
  );
  const recent = data?.recentActivity || [];
  // Live KPIs derived strictly from the dashboard aggregate (no extra APIs).
  const totalScans = data?.totalScans || 0;
  const highRisk = data?.threatsDetected || 0;            // suspicious + malicious
  const safeScans = Math.max(0, totalScans - highRisk);   // remainder treated as safe

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Skeleton className="h-64 rounded-2xl lg:col-span-2" />
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return <StateView type="error" title="Couldn't load dashboard" message="Check your connection and try again." />;
  }

  const cards = [
    { icon: ShieldCheckIcon, label: 'Total Scans', value: totalScans, sub: 'All modules', accent: 'primary' },
    { icon: CheckCircleIcon, label: 'Safe Scans', value: safeScans, sub: 'Clean results', accent: 'cyber' },
    { icon: BugAntIcon, label: 'Malicious / High Risk', value: highRisk, sub: 'Flagged threats', accent: 'danger' },
    { icon: LinkIcon, label: 'URL Scans', value: byType.url || 0, sub: 'Analyzed', accent: 'info' },
    { icon: EnvelopeIcon, label: 'Email Scans', value: byType.email || 0, sub: 'Analyzed', accent: 'warning' },
    { icon: QrCodeIcon, label: 'QR Scans', value: byType.qr || 0, sub: 'Decoded', accent: 'primary' },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Security Overview</h1>
          <p className="text-sm text-slate-400">Real-time posture across all protection modules.</p>
        </div>
        <button onClick={() => setShowNotes((s) => !s)} className="btn-primary" aria-label="Toggle notifications">
          Notifications ({notes.filter((n) => !n.read).length})
        </button>
      </div>

      {/* KPI cards with animated counters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((c, i) => (
          <StatCard key={c.label} {...c} delay={i * 0.05}>
            <AnimatedCounter value={c.value} className="text-3xl font-bold mt-1 block" />
          </StatCard>
        ))}
      </div>

      {/* Security gauge + module risk levels */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card title="Overall Security Score" description="Composite of all module risk" className="flex flex-col items-center">
          <SecurityGauge score={100 - data.avgThreatScore} />
          <RiskLevel score={100 - data.avgThreatScore} className="mt-2" />
        </Card>
        <Card title="Module Risk Levels" className="lg:col-span-2">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {MODULE_ORDER.map((m) => {
              const count = byType[m] || 0;
              // Approximate per-module risk from recent avg (safe default 0).
              const mod = recent.filter((r) => r.type === m);
              const avg = mod.length ? Math.round(mod.reduce((s, x) => s + x.riskScore, 0) / mod.length) : 0;
              return (
                <div key={m} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{MODULE_LABEL[m]}</p>
                    <p className="text-xs text-slate-400">{count} scans</p>
                  </div>
                  <RiskLevel score={avg} showScore={false} />
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card title="Weekly Threat Analysis" description="Average threat score trend" className="lg:col-span-2 glass">
          <ThreatChart recent={recent} />
        </Card>
        <Card title="Threat Distribution" description="Safe vs flagged" className="glass">
          <ThreatDistributionChart recent={recent} />
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card title="Scan Statistics" description="Scans per module" className="glass">
          <ScanStatsChart breakdown={data.typeBreakdown || []} />
        </Card>
        <Card title="Recent Scans" description="Latest 5 scans" className="lg:col-span-2 glass">
          <ActivityTimeline rows={recent.slice(0, 5)} />
        </Card>
      </div>

      {totalScans === 0 && (
        <StateView type="empty" title="No scans yet" message="Run a scan from any module to populate your live analytics." />
      )}

      <AnimatePresence>
        {showNotes && <NotificationsPanel items={notes} onClose={() => setShowNotes(false)} />}
      </AnimatePresence>
    </div>
  );
}
