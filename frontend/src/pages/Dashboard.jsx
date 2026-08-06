import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';
import useRealtimeDashboard from '../hooks/useRealtimeDashboard.js';
import {
  ShieldCheckIcon, ExclamationTriangleIcon, CheckCircleIcon,
  EnvelopeIcon, BugAntIcon, QrCodeIcon, LinkIcon,
  DocumentArrowDownIcon, SparklesIcon, KeyIcon,
  ChartBarIcon, ClockIcon, ArrowRightIcon,
  ServerIcon, CpuChipIcon, ChatBubbleLeftRightIcon,
  EyeIcon, FingerPrintIcon, ShieldExclamationIcon,
  BeakerIcon, SignalIcon, HeartIcon, ChartPieIcon,
  GlobeAltIcon, BuildingOfficeIcon, UsersIcon,
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
import Tooltip from '../design-system/components/Tooltip.jsx';
import Badge from '../design-system/components/Badge.jsx';
import Button from '../design-system/components/Button.jsx';
import Alert from '../design-system/components/Alert.jsx';

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

const severityConfig = {
  critical: { color: 'danger', icon: ShieldExclamationIcon, label: 'Critical' },
  high: { color: 'danger', icon: ExclamationTriangleIcon, label: 'High' },
  medium: { color: 'warning', icon: EyeIcon, label: 'Medium' },
  low: { color: 'info', icon: FingerPrintIcon, label: 'Low' },
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
  const [agentInsights, setAgentInsights] = useState(null);
  const [agentLoading, setAgentLoading] = useState(true);
  const [agentError, setAgentError] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [timeRange, setTimeRange] = useState('7d');

  useEffect(() => {
    Promise.all([
      endpoints.getDashboard(),
      endpoints.getNotifications().catch(() => []),
      endpoints.getAIStatus().catch(() => null),
      endpoints.getSecurityInsights().catch(() => null),
    ])
      .then(([d, n, ai, agent]) => { setData(d); setNotes(n); setAiStatus(ai); setAgentInsights(agent); })
      .catch(() => setError(true))
      .finally(() => { setLoading(false); setAgentLoading(false); });
  }, []);

  useRealtimeDashboard({
    onScanCompleted: useCallback((payload) => {
      const { result } = payload || {};
      if (result?.verdict === 'malicious' || result?.verdict === 'suspicious') {
        toast.warn(`New threat detected: ${result.verdict}`, { autoClose: 5000 });
      }
      setData((prev) => {
        if (!prev) return prev;
        const totalScans = (prev.totalScans || 0) + 1;
        const threats = result?.verdict === 'malicious' || result?.verdict === 'suspicious'
          ? (prev.threatsDetected || 0) + 1
          : (prev.threatsDetected || 0);
        const recentActivity = [{
          _id: payload?.scanId || Date.now().toString(),
          type: result?.scanType || 'url',
          verdict: result?.verdict || 'unknown',
          riskScore: result?.riskScore || 0,
          input: result?.input || '',
          createdAt: new Date().toISOString(),
        }, ...(prev.recentActivity || [])];
        return { ...prev, totalScans, threatsDetected: threats, recentActivity: recentActivity.slice(0, 8) };
      });
    }, []),
    onAICompleted: useCallback((payload) => {
      const { analysis } = payload || {};
      if (analysis?.threatScore >= 70) {
        toast.error(`High-risk AI analysis: ${analysis.riskLevel}`, { autoClose: 8000 });
      }
      setNotes((prev) => [
        {
          _id: `ai-${Date.now()}`,
          title: 'AI Analysis Completed',
          message: `${analysis?.scanType || 'Scan'} analysis: ${analysis?.riskLevel || 'Unknown'} risk (score: ${analysis?.threatScore || 0})`,
          type: analysis?.threatScore >= 70 ? 'danger' : 'info',
          read: false,
          createdAt: new Date().toISOString(),
        },
        ...prev,
      ]);
    }, []),
    onNotificationCreated: useCallback((payload) => {
      setNotes((prev) => [payload, ...prev]);
    }, []),
    onDashboardUpdate: useCallback((payload) => {
      if (payload?.threatScore !== undefined) {
        setData((prev) => prev ? { ...prev, threatScore: payload.threatScore } : prev);
      }
    }, []),
  });

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

  const threatLevel = useMemo(() => {
    if (securityScore >= 80) return { level: 'Low', color: 'success', icon: CheckCircleIcon };
    if (securityScore >= 60) return { level: 'Medium', color: 'warning', icon: EyeIcon };
    if (securityScore >= 40) return { level: 'High', color: 'warning', icon: ExclamationTriangleIcon };
    return { level: 'Critical', color: 'danger', icon: ShieldExclamationIcon };
  }, [securityScore]);

  const ThreatLevelIcon = threatLevel.icon;

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
    return (
      <StateView
        type="error"
        title="Couldn't load dashboard"
        message="Check your connection and try again."
        action={<Button onClick={() => window.location.reload()}>Retry</Button>}
      />
    );
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
          <Tooltip content={`Security level: ${threatLevel.level}`} position="bottom">
            <Badge tone={threatLevel.color} className="cursor-default">
              <ThreatLevelIcon className="h-3 w-3 mr-1 inline" />
              {threatLevel.level} Risk
            </Badge>
          </Tooltip>
          <Button onClick={handleDownloadReport} loading={generatingReport}>
            <DocumentArrowDownIcon className="w-4 h-4" />
            {generatingReport ? t('dashboard.generating') : t('dashboard.downloadReport')}
          </Button>
          <Button onClick={() => setShowNotes((s) => !s)}>
            {t('dashboard.notifications')} ({notes.filter((n) => !n.read).length})
          </Button>
        </div>
      </motion.div>

      {/* ─── Security Status Indicators ────────────────── */}
      <motion.div initial="hidden" animate="show" variants={fadeUp}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Tooltip content="Overall platform security posture">
            <div className="p-4 rounded-xl bg-white dark:bg-surface-card border border-slate-200 dark:border-slate-700 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-success-500/10 text-success-500">
                <ShieldCheckIcon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Security Posture</p>
                <p className="text-lg font-bold text-success-500">{securityScore}/100</p>
              </div>
            </div>
          </Tooltip>
          <Tooltip content="Active threats detected">
            <div className="p-4 rounded-xl bg-white dark:bg-surface-card border border-slate-200 dark:border-slate-700 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-danger-500/10 text-danger-500">
                <ExclamationTriangleIcon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Active Threats</p>
                <p className="text-lg font-bold text-danger-500">{highRisk}</p>
              </div>
            </div>
          </Tooltip>
          <Tooltip content="AI provider availability">
            <div className="p-4 rounded-xl bg-white dark:bg-surface-card border border-slate-200 dark:border-slate-700 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary-500/10 text-primary-500">
                <SparklesIcon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-slate-500">AI Status</p>
                <p className="text-lg font-bold text-primary-500">{aiStatus?.gemini !== false ? 'Online' : 'Offline'}</p>
              </div>
            </div>
          </Tooltip>
          <Tooltip content="System health indicator">
            <div className="p-4 rounded-xl bg-white dark:bg-surface-card border border-slate-200 dark:border-slate-700 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-cyber-500/10 text-cyber-400">
                <ServerIcon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-slate-500">System Health</p>
                <p className="text-lg font-bold text-cyber-400">Operational</p>
              </div>
            </div>
          </Tooltip>
        </div>
      </motion.div>

      {/* ─── 1. Security Overview Hero Card ─────────────── */}
      <motion.div initial="hidden" animate="show" variants={fadeUp}>
        <Card className="relative overflow-hidden backdrop-blur-sm bg-white/50 dark:bg-surface-card/50 border border-slate-200 dark:border-slate-700">
          <div className="absolute inset-0 bg-gradient-to-br from-cyber-500/5 via-primary/5 to-cyber-500/5 pointer-events-none" />
          <div className="relative grid grid-cols-1 lg:grid-cols-5 gap-6 p-6">
            <div className="lg:col-span-2 flex flex-col items-center justify-center">
              <SecurityGauge score={securityScore} size={180} />
              <RiskLevel score={securityScore} className="mt-2" />
            </div>
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

      {/* ─── AI Security Agent Card ────────────────────── */}
      <motion.div
        className="grid grid-cols-1 lg:grid-cols-3 gap-4"
        initial="hidden"
        animate="show"
        variants={fadeUp}
      >
        <Card
          title="AI Security Agent"
          description="Autonomous risk assessment and recommendations"
          className="lg:col-span-3 backdrop-blur-sm bg-white/50 dark:bg-surface-card/50 border border-slate-200 dark:border-slate-700"
        >
          {agentLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                <Skeleton className="h-24 rounded-xl" />
                <Skeleton className="h-24 rounded-xl" />
                <Skeleton className="h-24 rounded-xl" />
              </div>
            </div>
          ) : agentError || !agentInsights ? (
            <StateView
              type="error"
              title="Agent unavailable"
              message="Could not load security insights. Please try again later."
            />
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-slate-50/50 dark:bg-slate-800/30">
                  <p className="text-xs text-slate-400 mb-1">Security Score</p>
                  <p className="text-3xl font-bold text-cyber-400">
                    {agentInsights.assessment?.overallRiskScore ?? '—'}
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-slate-50/50 dark:bg-slate-800/30">
                  <p className="text-xs text-slate-400 mb-1">Risk Level</p>
                  <p className="text-lg font-semibold capitalize">
                    {agentInsights.assessment?.verdict || 'unknown'}
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-slate-50/50 dark:bg-slate-800/30">
                  <p className="text-xs text-slate-400 mb-1">Recommendations</p>
                  <p className="text-3xl font-bold text-primary">
                    {agentInsights.recommendations?.length ?? 0}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-sm font-medium mb-2">Threat Summary</p>
                <p className="text-sm text-slate-300 leading-relaxed">
                  {agentInsights.assessment?.summary || 'No summary available.'}
                </p>
              </div>

              <div>
                <p className="text-sm font-medium mb-3">Recommendations</p>
                <div className="space-y-2">
                  {(agentInsights.recommendations || []).slice(0, 5).map((rec, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-3 p-3 rounded-xl bg-slate-50/50 dark:bg-slate-800/30 hover:bg-slate-100/50 dark:hover:bg-slate-700/30 transition-colors duration-200"
                    >
                      <div className={`mt-0.5 h-2 w-2 rounded-full ${
                        rec.priority === 'critical' ? 'bg-red-400' :
                        rec.priority === 'high' ? 'bg-amber-400' :
                        rec.priority === 'medium' ? 'bg-orange-400' :
                        'bg-cyan-400'
                      }`} />
                      <div>
                        <p className="text-sm font-medium">{rec.action}</p>
                        {rec.detail && (
                          <p className="text-xs text-slate-400 mt-0.5">{rec.detail}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </Card>
      </motion.div>

      {/* ─── 3. Threat Activity Chart ──────────────────── */}
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
                  className="flex items-center justify-between p-3 rounded-xl bg-slate-50/50 dark:bg-slate-800/30 backdrop-blur-sm hover:bg-slate-100/50 dark:hover:bg-slate-700/30 transition-colors duration-200"
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