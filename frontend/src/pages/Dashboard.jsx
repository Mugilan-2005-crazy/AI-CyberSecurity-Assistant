/**
 * pages/Dashboard.jsx
 * ------------------------------------------------------------
 * Professional cybersecurity analytics dashboard.
 * Sections:
 *   1. Security Overview Hero Card (score, risk, totals)
 *   2. Analytics Cards (URL, phishing, malware, QR, password)
 *   3. Threat Activity Chart (weekly trends)
 *   4. Recent Security Activity Timeline
 *   5. AI Assistant Summary Card
 *   6. Quick Actions Section
 * Uses glassmorphism, Framer Motion, loading skeletons, empty states.
 */
import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';
import {
  ShieldCheckIcon, ExclamationTriangleIcon, CheckCircleIcon,
  EnvelopeIcon, BugAntIcon, QrCodeIcon, LinkIcon,
  DocumentArrowDownIcon, SparklesIcon, KeyIcon,
  ChartBarIcon, ClockIcon, ArrowRightIcon,
  ServerIcon, CpuChipIcon, ChatBubbleLeftRightIcon,
  EyeIcon, FingerPrintIcon, ShieldExclamationIcon,
} from '@heroicons/react/24/outline';
import endpoints from '../services/endpoints.js';
import StatCard from '../components/dashboard/StatCard.jsx';
import Card from '../components/ui/Card.jsx';
import Skeleton from '../components/ui/Skeleton.jsx';
import StateView from '../components/ui/StateView.jsx';
import AnimatedCounter from '../components/ui/AnimatedCounter.jsx';
import SecurityGauge from '../components/ui/SecurityGauge.jsx';
import RiskLevel from '../components/ui/RiskLevel.jsx';
import VerdictBadge from '../components/ui/VerdictBadge.jsx';
import ThreatChart from '../components/dashboard/ThreatChart.jsx';
import ScanStatsChart from '../components/dashboard/ScanStatsChart.jsx';
import ThreatDistributionChart from '../components/dashboard/ThreatDistributionChart.jsx';
import ActivityTimeline from '../components/dashboard/ActivityTimeline.jsx';
import NotificationsPanel from '../components/dashboard/NotificationsPanel.jsx';
import { AnimatePresence } from 'framer-motion';

const MODULE_ORDER = ['url', 'password', 'email', 'file', 'qr'];
const MODULE_LABEL = { url: 'URL', password: 'Password', email: 'Email', file: 'File', qr: 'QR' };

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

const stagger = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const QUICK_ACTIONS = [
  { label: 'Scan URL', icon: LinkIcon, to: '/scan/url', color: 'from-cyan-500/20 to-blue-500/20 text-cyan-400' },
  { label: 'Check Password', icon: KeyIcon, to: '/scan/password', color: 'from-purple-500/20 to-pink-500/20 text-purple-400' },
  { label: 'Analyze Email', icon: EnvelopeIcon, to: '/scan/email', color: 'from-amber-500/20 to-orange-500/20 text-amber-400' },
  { label: 'AI Assistant', icon: ChatBubbleLeftRightIcon, to: '/chat', color: 'from-emerald-500/20 to-teal-500/20 text-emerald-400' },
  { label: 'Generate Report', icon: DocumentArrowDownIcon, to: '/report', color: 'from-rose-500/20 to-red-500/20 text-rose-400' },
];

const rel = (iso) => {
  if (!iso) return '—';
  const diff = (Date.now() - new Date(iso)) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
};

export default function Dashboard() {
  const { t } = useTranslation();
  const [data, setData] = useState(null);
  const [notes, setNotes] = useState([]);
  const [showNotes, setShowNotes] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [aiStatus, setAiStatus] = useState(null);

  useEffect(() => {
    Promise.all([
      endpoints.getDashboard(),
      endpoints.getNotifications().catch(() => []),
      endpoints.getAIStatus().catch(() => null),
    ])
      .then(([d, n, ai]) => { setData(d); setNotes(n); setAiStatus(ai); })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  const byType = useMemo(
    () => Object.fromEntries((data?.typeBreakdown || []).map((t) => [t._id, t.count])),
    [data]
  );
  const recent = data?.recentActivity || [];
  const totalScans = data?.totalScans || 0;
  const highRisk = data?.threatsDetected || 0;
  const safeScans = Math.max(0, totalScans - highRisk);
  const avgThreatScore = data?.avgThreatScore || 0;
  const securityScore = Math.max(0, 100 - avgThreatScore);

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

  // ─── Loading State ─────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 rounded-2xl" />
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

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ─── Header ─────────────────────────────────────── */}
      <motion.div initial="hidden" animate="show" variants={fadeUp} className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t('dashboard.title')}</h1>
          <p className="text-sm text-slate-400">{t('dashboard.subtitle')}</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleDownloadReport}
            disabled={generatingReport}
            className="btn-primary inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <DocumentArrowDownIcon className="w-4 h-4" />
            {generatingReport ? t('dashboard.generating') : t('dashboard.downloadReport')}
          </button>
          <button onClick={() => setShowNotes((s) => !s)} className="btn-primary">
            {t('dashboard.notifications')} ({notes.filter((n) => !n.read).length})
          </button>
        </div>
      </motion.div>

      {/* ─── 1. Security Overview Hero Card ─────────────── */}
      <motion.div initial="hidden" animate="show" variants={fadeUp}>
        <Card className="relative overflow-hidden backdrop-blur-sm bg-white/50 dark:bg-surface-card/50 border border-slate-200 dark:border-slate-700">
          <div className="absolute inset-0 bg-gradient-to-br from-cyber-500/5 via-primary/5 to-cyber-500/5 pointer-events-none" />
          <div className="relative grid grid-cols-1 lg:grid-cols-5 gap-6 p-6">
            {/* Security Score */}
            <div className="lg:col-span-2 flex flex-col items-center justify-center">
              <SecurityGauge score={securityScore} size={180} />
              <RiskLevel score={securityScore} className="mt-2" />
            </div>

            {/* Stats grid */}
            <div className="lg:col-span-3 grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { icon: ShieldCheckIcon, label: 'Total Scans', value: totalScans, color: 'text-cyber-400' },
                { icon: ExclamationTriangleIcon, label: 'Threats Detected', value: highRisk, color: 'text-danger' },
                { icon: CheckCircleIcon, label: 'Safe Scans', value: safeScans, color: 'text-green-400' },
                { icon: ChatBubbleLeftRightIcon, label: 'AI Conversations', value: data?.totalChats || 0, color: 'text-primary' },
              ].map((s) => (
                <div key={s.label} className="text-center p-3 rounded-xl bg-slate-50/50 dark:bg-slate-800/30 backdrop-blur-sm">
                  <s.icon className={`h-6 w-6 mx-auto ${s.color}`} />
                  <AnimatedCounter value={s.value} className={`text-2xl font-bold mt-1 ${s.color}`} />
                  <p className="text-xs text-slate-400 mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </motion.div>

      {/* ─── 2. Analytics Cards ─────────────────────────── */}
      <motion.div
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
        initial="hidden"
        animate="show"
        variants={stagger}
      >
        {[
          { icon: LinkIcon, label: 'URL Scans', value: byType.url || 0, sub: 'Phishing & SSL checks', accent: 'info', trend: 12 },
          { icon: EnvelopeIcon, label: 'Phishing Emails', value: byType.email || 0, sub: 'Social engineering', accent: 'warning', trend: -5 },
          { icon: BugAntIcon, label: 'Malware Files', value: byType.file || 0, sub: 'SHA-256 + VirusTotal', accent: 'danger', trend: 3 },
          { icon: QrCodeIcon, label: 'QR Codes Checked', value: byType.qr || 0, sub: 'Decode & safety verdict', accent: 'primary', trend: 8 },
          { icon: KeyIcon, label: 'Password Analysis', value: byType.password || 0, sub: 'Entropy & breach check', accent: 'cyber', trend: 15 },
          { icon: ChartBarIcon, label: 'Avg Threat Score', value: `${Math.round(avgThreatScore)}%`, sub: 'Across all modules', accent: 'danger', trend: null },
        ].map((c, i) => (
          <motion.div key={c.label} variants={fadeUp}>
            <StatCard {...c} delay={i * 0.05}>
              <AnimatedCounter value={c.value} className="text-3xl font-bold mt-1 block" />
            </StatCard>
          </motion.div>
        ))}
      </motion.div>

      {/* ─── 3. Threat Activity Chart ───────────────────── */}
      <motion.div
        className="grid grid-cols-1 lg:grid-cols-3 gap-4"
        initial="hidden"
        animate="show"
        variants={fadeUp}
      >
        <Card
          title="Weekly Threat Activity"
          description="Scan activity and threat detection trends over the past week"
          className="lg:col-span-2 backdrop-blur-sm bg-white/50 dark:bg-surface-card/50 border border-slate-200 dark:border-slate-700"
        >
          <ThreatChart recent={recent} />
        </Card>
        <Card
          title="Threat Distribution"
          description="Safe vs risky breakdown"
          className="backdrop-blur-sm bg-white/50 dark:bg-surface-card/50 border border-slate-200 dark:border-slate-700"
        >
          <ThreatDistributionChart recent={recent} />
        </Card>
      </motion.div>

      {/* ─── 4. Recent Security Activity + Scan Stats ───── */}
      <motion.div
        className="grid grid-cols-1 lg:grid-cols-3 gap-4"
        initial="hidden"
        animate="show"
        variants={fadeUp}
      >
        <Card
          title="Scan Statistics"
          description="Breakdown by module type"
          className="backdrop-blur-sm bg-white/50 dark:bg-surface-card/50 border border-slate-200 dark:border-slate-700"
        >
          <ScanStatsChart breakdown={data.typeBreakdown || []} />
        </Card>
        <Card
          title="Recent Security Activity"
          description="Latest scans and detections"
          className="lg:col-span-2 backdrop-blur-sm bg-white/50 dark:bg-surface-card/50 border border-slate-200 dark:border-slate-700"
        >
          {recent.length > 0 ? (
            <div className="space-y-3">
              {recent.slice(0, 6).map((r, i) => (
                <motion.div
                  key={r._id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.06 }}
                  className="flex items-center justify-between p-3 rounded-xl bg-slate-50/50 dark:bg-slate-800/30 backdrop-blur-sm hover:bg-slate-100/50 dark:hover:bg-slate-700/30 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`p-2 rounded-lg ${
                      r.verdict === 'safe' ? 'bg-green-500/10 text-green-400' :
                      r.verdict === 'suspicious' ? 'bg-amber-500/10 text-amber-400' :
                      'bg-red-500/10 text-red-400'
                    }`}>
                      {r.verdict === 'safe' ? <CheckCircleIcon className="h-4 w-4" /> :
                       r.verdict === 'suspicious' ? <ExclamationTriangleIcon className="h-4 w-4" /> :
                       <BugAntIcon className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {r.type ? MODULE_LABEL[r.type] || r.type : 'Scan'} {r.verdict === 'safe' ? 'Completed' : r.verdict === 'suspicious' ? 'Suspicious Activity' : 'Threat Found'}
                      </p>
                      <p className="text-xs text-slate-400 truncate">
                        {r.input || '—'} · {rel(r.createdAt)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      r.verdict === 'safe' ? 'bg-green-500/10 text-green-400' :
                      r.verdict === 'suspicious' ? 'bg-amber-500/10 text-amber-400' :
                      'bg-red-500/10 text-red-400'
                    }`}>
                      {r.verdict || 'unknown'}
                    </span>
                    <span className="text-xs text-slate-400">risk {r.riskScore}</span>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400">No recent activity.</p>
          )}
        </Card>
      </motion.div>

      {/* ─── 5. AI Assistant Summary Card ───────────────── */}
      <motion.div
        className="grid grid-cols-1 lg:grid-cols-3 gap-4"
        initial="hidden"
        animate="show"
        variants={fadeUp}
      >
        <Card
          title="AI Security Assistant"
          description="Gemini & Ollama provider status"
          className="backdrop-blur-sm bg-white/50 dark:bg-surface-card/50 border border-slate-200 dark:border-slate-700"
        >
          <div className="space-y-4">
            {/* Gemini status */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50/50 dark:bg-slate-800/30">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                  <SparklesIcon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-medium">Google Gemini</p>
                  <p className="text-xs text-slate-400">Cloud AI</p>
                </div>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                aiStatus?.gemini !== false ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
              }`}>
                {aiStatus?.gemini !== false ? 'Online' : 'Offline'}
              </span>
            </div>

            {/* Ollama status */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50/50 dark:bg-slate-800/30">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400">
                  <CpuChipIcon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-medium">Ollama (Llama 3.1)</p>
                  <p className="text-xs text-slate-400">Local AI</p>
                </div>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                aiStatus?.ollama !== false ? 'bg-green-500/10 text-green-400' : 'bg-amber-500/10 text-amber-400'
              }`}>
                {aiStatus?.ollama !== false ? 'Online' : 'Unavailable'}
              </span>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="text-center p-2 rounded-lg bg-slate-50/50 dark:bg-slate-800/30">
                <p className="text-lg font-bold text-cyber-400">{data?.totalChats || 0}</p>
                <p className="text-xs text-slate-400">Total Queries</p>
              </div>
              <div className="text-center p-2 rounded-lg bg-slate-50/50 dark:bg-slate-800/30">
                <p className="text-lg font-bold text-primary">{recent.length > 0 ? rel(recent[0].createdAt) : '—'}</p>
                <p className="text-xs text-slate-400">Last Activity</p>
              </div>
            </div>

            <Link
              to="/chat"
              className="btn-cyber w-full inline-flex items-center justify-center gap-2 text-sm mt-2"
            >
              <ChatBubbleLeftRightIcon className="h-4 w-4" />
              Open AI Assistant
              <ArrowRightIcon className="h-4 w-4" />
            </Link>
          </div>
        </Card>

        {/* ─── 6. Quick Actions ─────────────────────────── */}
        <Card
          title="Quick Actions"
          description="Common security tasks"
          className="lg:col-span-2 backdrop-blur-sm bg-white/50 dark:bg-surface-card/50 border border-slate-200 dark:border-slate-700"
        >
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {QUICK_ACTIONS.map((action) => (
              <Link
                key={action.label}
                to={action.to}
                className="group flex flex-col items-center gap-2 p-4 rounded-xl bg-slate-50/50 dark:bg-slate-800/30 backdrop-blur-sm border border-slate-200/50 dark:border-slate-700/50 hover:border-cyber-400/50 transition-all duration-300 hover:-translate-y-1"
              >
                <div className={`p-3 rounded-xl bg-gradient-to-br ${action.color} group-hover:scale-110 transition-transform duration-300`}>
                  <action.icon className="h-6 w-6" />
                </div>
                <span className="text-xs font-medium text-center">{action.label}</span>
              </Link>
            ))}
          </div>

          {/* Module risk levels */}
          <div className="mt-6">
            <p className="text-sm font-medium mb-3">Module Risk Levels</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {MODULE_ORDER.map((m) => {
                const count = byType[m] || 0;
                const mod = recent.filter((r) => r.type === m);
                const avg = mod.length ? Math.round(mod.reduce((s, x) => s + x.riskScore, 0) / mod.length) : 0;
                return (
                  <div key={m} className="p-3 rounded-xl bg-slate-50/50 dark:bg-slate-800/30 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{MODULE_LABEL[m]}</p>
                      <p className="text-xs text-slate-400">{count} scans</p>
                    </div>
                    <RiskLevel score={avg} showScore={false} />
                  </div>
                );
              })}
            </div>
          </div>
        </Card>
      </motion.div>

      {/* ─── Empty State ────────────────────────────────── */}
      {totalScans === 0 && (
        <StateView type="empty" title={t('dashboard.noScansYet')} message={t('dashboard.runScanHint')} />
      )}

      {/* ─── Notifications Panel ────────────────────────── */}
      <AnimatePresence>
        {showNotes && <NotificationsPanel items={notes} onClose={() => setShowNotes(false)} />}
      </AnimatePresence>
    </div>
  );
}