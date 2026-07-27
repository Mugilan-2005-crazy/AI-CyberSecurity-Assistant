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
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';
import { ShieldCheckIcon, ExclamationTriangleIcon, CheckCircleIcon, EnvelopeIcon, BugAntIcon, QrCodeIcon, LinkIcon, DocumentArrowDownIcon } from '@heroicons/react/24/outline';
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
  const { t } = useTranslation();
  const [data, setData] = useState(null);
  const [notes, setNotes] = useState([]);
  const [showNotes, setShowNotes] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [generatingReport, setGeneratingReport] = useState(false);

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

  const handleDownloadReport = async () => {
    setGeneratingReport(true);
    try {
      await endpoints.downloadReport();
      toast.success(t('reports.reportGenerated'));
    } catch {
      toast.error(t('reports.reportFailed'));
    } finally {
      setGeneratingReport(false);
    }
  };

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
    { icon: ShieldCheckIcon, label: t('dashboard.totalScans'), value: totalScans, sub: t('dashboard.allModules'), accent: 'primary' },
    { icon: CheckCircleIcon, label: t('dashboard.safeScans'), value: safeScans, sub: t('dashboard.cleanResults'), accent: 'cyber' },
    { icon: BugAntIcon, label: t('dashboard.highRisk'), value: highRisk, sub: t('dashboard.flaggedThreats'), accent: 'danger' },
    { icon: LinkIcon, label: t('dashboard.urlScans'), value: byType.url || 0, sub: t('dashboard.analyzed'), accent: 'info' },
    { icon: EnvelopeIcon, label: t('dashboard.emailScans'), value: byType.email || 0, sub: t('dashboard.analyzed'), accent: 'warning' },
    { icon: QrCodeIcon, label: t('dashboard.qrScans'), value: byType.qr || 0, sub: t('dashboard.decoded'), accent: 'primary' },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('dashboard.title')}</h1>
          <p className="text-sm text-slate-400">{t('dashboard.subtitle')}</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleDownloadReport}
            disabled={generatingReport}
            className="btn-primary inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label={t('dashboard.downloadReport')}
          >
            <DocumentArrowDownIcon className="w-4 h-4" />
            {generatingReport ? t('dashboard.generating') : t('dashboard.downloadReport')}
          </button>
          <button onClick={() => setShowNotes((s) => !s)} className="btn-primary" aria-label={t('dashboard.notifications')}>
            {t('dashboard.notifications')} ({notes.filter((n) => !n.read).length})
          </button>
        </div>
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
        <Card title={t('dashboard.overallScore')} description={t('dashboard.allModules')} className="flex flex-col items-center">
          <SecurityGauge score={100 - data.avgThreatScore} />
          <RiskLevel score={100 - data.avgThreatScore} className="mt-2" />
        </Card>
        <Card title={t('dashboard.moduleRiskLevels')} className="lg:col-span-2">
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
        <Card title={t('dashboard.weeklyThreat')} description={t('dashboard.weeklyThreat')} className="lg:col-span-2 glass">
          <ThreatChart recent={recent} />
        </Card>
        <Card title={t('dashboard.threatDistribution')} description={t('dashboard.threatDistribution')} className="glass">
          <ThreatDistributionChart recent={recent} />
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card title={t('dashboard.scanStatistics')} description={t('dashboard.scanStatistics')} className="glass">
          <ScanStatsChart breakdown={data.typeBreakdown || []} />
        </Card>
        <Card title={t('dashboard.recentScans')} description={t('dashboard.recentScans')} className="lg:col-span-2 glass">
          <ActivityTimeline rows={recent.slice(0, 5)} />
        </Card>
      </div>

      {totalScans === 0 && (
        <StateView type="empty" title={t('dashboard.noScansYet')} message={t('dashboard.runScanHint')} />
      )}

      <AnimatePresence>
        {showNotes && <NotificationsPanel items={notes} onClose={() => setShowNotes(false)} />}
      </AnimatePresence>
    </div>
  );
}
