/**
 * pages/admin/SOCDashboard.jsx
 * ------------------------------------------------------------
 * MITRE ATT&K Threat Mapping + AI SOC Dashboard + Incident Response.
 * Sections:
 *   1. Security Metric Cards (threats, critical, risk score)
 *   2. Risk Trend Chart
 *   3. Threat Distribution Chart
 *   4. Top Threats Table
 *   5. Recent Incidents Table
 *   6. MITRE Technique Information
 *   7. AI Incident Response Panel
 * Uses glassmorphism cards, Framer Motion, existing UI components.
 */
import { useEffect, useState, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import { Bar, Line, Doughnut } from 'react-chartjs-2';
import useRealtimeDashboard from '../../hooks/useRealtimeDashboard.js';
import {
  ShieldCheckIcon, ExclamationTriangleIcon,
  CheckCircleIcon, XCircleIcon, ClockIcon,
  ChartBarIcon, BeakerIcon, InformationCircleIcon,
  ArrowPathIcon, SparklesIcon, PaperAirplaneIcon,
  FingerPrintIcon, ArrowDownOnSquareIcon, FireIcon,
  BugAntIcon, GlobeAltIcon,
} from '@heroicons/react/24/outline';
import api from '../../services/api.js';
import endpoints, { getAlerts, acknowledgeAlert, getDashboardAlerts } from '../../services/endpoints.js';
import StatCard from '../../components/ui/StatCard.jsx';
import Card from '../../components/ui/Card.jsx';
import Skeleton from '../../components/ui/Skeleton.jsx';
import StateView from '../../components/ui/StateView.jsx';
import AlertCard from '../../components/soc/AlertCard.jsx';
import ThreatFeed from '../../components/soc/ThreatFeed.jsx';
import CVECard from '../../components/soc/CVECard.jsx';

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

const stagger = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const severityColors = {
  Critical: 'bg-red-500/10 text-red-400',
  High: 'bg-orange-500/10 text-orange-400',
  Medium: 'bg-amber-500/10 text-amber-400',
  Low: 'bg-green-500/10 text-green-400',
};

const statusColors = {
  open: 'bg-red-500/10 text-red-400',
  'in-progress': 'bg-amber-500/10 text-amber-400',
  resolved: 'bg-green-500/10 text-green-400',
  closed: 'bg-slate-500/10 text-slate-400',
};

const responseStatusColors = {
  pending: 'bg-amber-500/10 text-amber-400',
  investigating: 'bg-blue-500/10 text-blue-400',
  approved: 'bg-green-500/10 text-green-400',
  executed: 'bg-cyber-400/10 text-cyber-400',
  rejected: 'bg-red-500/10 text-red-400',
};

const categoryLabels = {
  containment: 'Containment',
  notification: 'Notification',
  remediation: 'Remediation',
  monitoring: 'Monitoring',
};

const rel = (iso) => {
  if (!iso) return 'â€”';
  const diff = (Date.now() - new Date(iso)) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
};

export default function SOCDashboard() {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [alerts, setAlerts] = useState([]);
  const [alertLoading, setAlertLoading] = useState(true);
  const [threats, setThreats] = useState([]);
  const [cves, setCves] = useState([]);
  const [threatLoading, setThreatLoading] = useState(true);
  const [threatConfidence, setThreatConfidence] = useState(0);
  const [riskLevel, setRiskLevel] = useState('Low');

  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [responsePlan, setResponsePlan] = useState(null);
  const [activeIncidentId, setActiveIncidentId] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(false);
    setAlertLoading(true);
    setThreatLoading(true);
    Promise.all([
      api.get('/soc/dashboard').then((r) => r.data),
      getDashboardAlerts({ timeframe: '24h' }),
      api.get('/threat-intel/feeds').then((r) => r.data).catch(() => ({ threats: [], cves: [] })),
    ])
      .then(([socData, alertData, intelData]) => {
        setDashboard(socData);
        setAlerts(alertData?.data?.alerts || []);
        setThreats(intelData?.threats || []);
        setCves(intelData?.cves || []);
        setThreatConfidence(Math.min(100, Math.round((socData?.threatsDetected || 0) / Math.max(socData?.scans || 1, 1) * 100)));
        setRiskLevel(socData?.threatsDetected > 10 ? 'Critical' : socData?.threatsDetected > 5 ? 'High' : socData?.threatsDetected > 0 ? 'Medium' : 'Low');
      })
      .catch(() => setError(true))
      .finally(() => { setLoading(false); setAlertLoading(false); setThreatLoading(false); });
  }, []);

  useRealtimeDashboard({
    onIncidentCreated: useCallback((payload) => {
      const { incident } = payload || {};
      toast.warn(`New incident: ${incident?.threatType || 'Unknown'}`, { autoClose: 6000 });
      setDashboard((prev) => {
        if (!prev) return prev;
        const recentIncidents = [{
          id: incident?._id || Date.now().toString(),
          userId: incident?.userId,
          threatType: incident?.threatType || '',
          mitreTechnique: incident?.mitreTechnique || {},
          severity: incident?.severity || 'Medium',
          status: incident?.status || 'open',
          createdAt: incident?.createdAt || new Date().toISOString(),
        }, ...(prev.recentIncidents || [])];
        return {
          ...prev,
          recentIncidents: recentIncidents.slice(0, 10),
          criticalAlerts: (prev.criticalAlerts || 0) + (incident?.severity === 'Critical' ? 1 : 0),
          totalThreats: (prev.totalThreats || 0) + 1,
        };
      });
    }, []),
    onIncidentUpdated: useCallback((payload) => {
      const { incident } = payload || {};
      setDashboard((prev) => {
        if (!prev) return prev;
        const recentIncidents = (prev.recentIncidents || []).map((inc) =>
          inc.id === incident?._id || inc.id === incident?._id?.toString()
            ? { ...inc, ...incident, id: incident?._id || inc.id, createdAt: incident?.createdAt || inc.createdAt }
            : inc
        );
        return { ...prev, recentIncidents };
      });
    }, []),
    onIncidentClosed: useCallback((payload) => {
      const { incident } = payload || {};
      toast.success(`Incident resolved: ${incident?.threatType || 'Unknown'}`, { autoClose: 5000 });
    }, []),
    onScanCompleted: useCallback((payload) => {
      const { result } = payload || {};
      if (result?.verdict === 'malicious' || result?.verdict === 'suspicious') {
        setDashboard((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            totalThreats: (prev.totalThreats || 0) + 1,
            criticalAlerts: (prev.criticalAlerts || 0) + (result?.verdict === 'malicious' ? 1 : 0),
          };
        });
      }
    }, []),
    onAICompleted: useCallback((payload) => {
      const { analysis } = payload || {};
      if (analysis?.threatScore >= 70) {
        toast.error(`Critical AI analysis: ${analysis?.riskLevel} (score: ${analysis?.threatScore})`, { autoClose: 8000 });
      }
    }, []),
  });

  useRealtimeDashboard({
    onIncidentCreated: useCallback((payload) => {
      const { incident } = payload || {};
      toast.warn(`New incident: ${incident?.threatType || 'Unknown'}`, { autoClose: 6000 });
      setDashboard((prev) => {
        if (!prev) return prev;
        const recentIncidents = [{
          id: incident?._id || Date.now().toString(),
          userId: incident?.userId,
          threatType: incident?.threatType || '',
          mitreTechnique: incident?.mitreTechnique || {},
          severity: incident?.severity || 'Medium',
          status: incident?.status || 'open',
          createdAt: incident?.createdAt || new Date().toISOString(),
        }, ...(prev.recentIncidents || [])];
        return {
          ...prev,
          recentIncidents: recentIncidents.slice(0, 10),
          criticalAlerts: (prev.criticalAlerts || 0) + (incident?.severity === 'Critical' ? 1 : 0),
          totalThreats: (prev.totalThreats || 0) + 1,
        };
      });
    }, []),
    onIncidentUpdated: useCallback((payload) => {
      const { incident } = payload || {};
      setDashboard((prev) => {
        if (!prev) return prev;
        const recentIncidents = (prev.recentIncidents || []).map((inc) =>
          inc.id === incident?._id || inc.id === (incident?._id?.toString())
            ? { ...inc, ...incident, id: incident?._id || inc.id, createdAt: incident?.createdAt || inc.createdAt }
            : inc
        );
        return { ...prev, recentIncidents };
      });
    }, []),
    onIncidentClosed: useCallback((payload) => {
      const { incident } = payload || {};
      toast.success(`Incident resolved: ${incident?.threatType || 'Unknown'}`, { autoClose: 5000 });
    }, []),
    onScanCompleted: useCallback((payload) => {
      const { result } = payload || {};
      if (result?.verdict === 'malicious' || result?.verdict === 'suspicious') {
        setDashboard((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            totalThreats: (prev.totalThreats || 0) + 1,
            criticalAlerts: (prev.criticalAlerts || 0) + (result?.verdict === 'malicious' ? 1 : 0),
          };
        });
      }
    }, []),
    onAICompleted: useCallback((payload) => {
      const { analysis } = payload || {};
      if (analysis?.threatScore >= 70) {
        toast.error(`Critical AI analysis: ${analysis?.riskLevel} (score: ${analysis?.threatScore})`, { autoClose: 8000 });
      }
    }, []),
  });

  const threatDistribution = useMemo(() => {
    const data = dashboard?.verdictDistribution || [];
    return {
      labels: data.map((d) => d._id.charAt(0).toUpperCase() + d._id.slice(1)),
      counts: data.map((d) => d.count),
    };
  }, [dashboard]);

  const lineChartData = useMemo(() => {
    const trend = dashboard?.riskTrend || [];
    return {
      labels: trend.map((t) => t.date.slice(5)),
      datasets: [
        {
          label: 'Total Scans',
          data: trend.map((t) => t.totalScans),
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          fill: true,
          tension: 0.4,
        },
        {
          label: 'Threats',
          data: trend.map((t) => t.threats),
          borderColor: '#ef4444',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          fill: true,
          tension: 0.4,
        },
      ],
    };
  }, [dashboard]);

  const mitreTechniques = useMemo(() => {
    const incidents = dashboard?.recentIncidents || [];
    const seen = new Set();
    const techniques = [];
    for (const inc of incidents) {
      if (inc.mitreTechnique && inc.mitreTechnique.techniqueId && !seen.has(inc.mitreTechnique.techniqueId)) {
        seen.add(inc.mitreTechnique.techniqueId);
        techniques.push(inc.mitreTechnique);
      }
    }
    return techniques;
  }, [dashboard]);

  const handleAnalyzeIncident = useCallback(async (incidentId) => {
    setAiLoading(true);
    setAiError(false);
    setAiResult(null);
    setActiveIncidentId(incidentId);
    try {
      const result = await endpoints.analyzeIncident(incidentId);
      setAiResult(result);
      toast.success('AI investigation completed');
    } catch {
      setAiError(true);
      toast.error('AI investigation failed');
    } finally {
      setAiLoading(false);
    }
  }, []);

  const handleRecommendResponse = useCallback(async (incidentId) => {
    setActionLoading(true);
    try {
      const plan = await endpoints.recommendResponse(incidentId);
      setResponsePlan(plan);
      toast.success('Response plan generated');
    } catch {
      toast.error('Failed to generate response plan');
    } finally {
      setActionLoading(false);
    }
  }, []);

  const handleApproveResponse = useCallback(async (incidentId, status) => {
    setActionLoading(true);
    try {
      await endpoints.approveResponse(incidentId, status);
      toast.success(`Response ${status}`);
      setResponsePlan(null);
      setAiResult(null);
    } catch {
      toast.error('Approval action failed');
    } finally {
      setActionLoading(false);
    }
  }, []);

  const handleAcknowledgeAlert = useCallback(async (alertId) => {
    try {
      await acknowledgeAlert(alertId);
      setAlerts((prev) => prev.map((a) => a.id === alertId ? { ...a, status: 'acknowledged', acknowledgedAt: new Date().toISOString() } : a));
      toast.success('Alert acknowledged');
    } catch {
      toast.error('Failed to acknowledge alert');
    }
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Skeleton className="h-72 rounded-2xl" />
          <Skeleton className="h-72 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (error || !dashboard) {
    return <StateView type="error" title="Couldn't load SOC dashboard" message="Check your connection and try again." />;
  }

  const totalThreats = dashboard.totalThreats || 0;
  const criticalAlerts = dashboard.criticalAlerts || 0;
  const topThreats = dashboard.topThreats || [];
  const recentIncidents = dashboard.recentIncidents || [];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <motion.div initial="hidden" animate="show" variants={fadeUp}>
        <h1 className="text-2xl font-bold">SOC Dashboard</h1>
        <p className="text-sm text-slate-400">MITRE ATT&CK threat mapping and AI incident response</p>
      </motion.div>

      {/* Metric Cards */}
      <motion.div
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
        initial="hidden" animate="show" variants={stagger}
      >
        <motion.div variants={fadeUp}>
          <StatCard title="Total Threats" value={totalThreats} icon={ExclamationTriangleIcon} accent="danger" subtitle="Detected across all modules" />
        </motion.div>
        <motion.div variants={fadeUp}>
          <StatCard title="Critical Alerts" value={criticalAlerts} icon={XCircleIcon} accent="danger" subtitle="Requiring immediate attention" />
        </motion.div>
        <motion.div variants={fadeUp}>
          <StatCard
            title="Risk Score"
            value={Math.round((totalThreats / Math.max(totalThreats + 10, 1)) * 100)}
            icon={ChartBarIcon}
            accent={criticalAlerts > 0 ? 'danger' : 'cyber'}
            subtitle="Based on threat activity"
          />
        </motion.div>
        <motion.div variants={fadeUp}>
          <StatCard title="Open Incidents" value={dashboard.openIncidents || 0} icon={ClockIcon} accent="warning" subtitle={`${dashboard.resolvedIncidents || 0} resolved`} />
        </motion.div>
      </motion.div>

      {/* ─── Threat Trend Chart ─────────────────── */}
      <motion.div initial="hidden" animate="show" variants={fadeUp}>
        <Card title="Risk Trend" description="Scans and threats over the past 30 days" className="backdrop-blur-sm bg-white/50 dark:bg-surface-card/50 border border-slate-200 dark:border-slate-700">
          <div className="h-64">
            <Line data={lineChartData} options={{ plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8' } } }, scales: { x: { ticks: { color: '#94a3b8' } }, y: { ticks: { color: '#94a3b8' } } } }} />
          </div>
        </Card>
      </motion.div>

      {/* ─── Threat Distribution + Top Threats ───── */}
      <motion.div
        className="grid grid-cols-1 lg:grid-cols-2 gap-4"
        initial="hidden" animate="show" variants={fadeUp}
      >
        <Card title="Threat Distribution" description="Verdict breakdown" className="backdrop-blur-sm bg-white/50 dark:bg-surface-card/50 border border-slate-200 dark:border-slate-700">
          <div className="h-64 flex items-center justify-center">
            <Doughnut
              data={{
                labels: threatDistribution.labels,
                datasets: [{
                  data: threatDistribution.counts,
                  backgroundColor: ['#10b981', '#f59e0b', '#ef4444'],
                  borderColor: ['#065f46', '#92400e', '#991b1b'],
                  borderWidth: 1,
                }],
              }}
              options={{ cutout: '60%', plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8' } } } }}
            />
          </div>
        </Card>

        <Card title="Top Threats" description="Most frequently detected threat types" className="backdrop-blur-sm bg-white/50 dark:bg-surface-card/50 border border-slate-200 dark:border-slate-700">
          {topThreats.length > 0 ? (
            <div className="space-y-3">
              {topThreats.map((t, i) => (
                <div key={t.type} className="flex items-center justify-between p-3 rounded-xl bg-slate-50/50 dark:bg-slate-800/30">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-slate-400 w-6">#{i + 1}</span>
                    <div>
                      <p className="text-sm font-medium capitalize">{t.type || 'Unknown'}</p>
                      <p className="text-xs text-slate-400">Avg risk: {t.avgRiskScore}</p>
                    </div>
                  </div>
                  <span className="text-sm font-bold">{t.count}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400 text-center py-4">No threat data available</p>
          )}
        </Card>
      </motion.div>

      {/* ─── Recent Incidents Table ──────────────── */}
      <motion.div initial="hidden" animate="show" variants={fadeUp}>
        <Card title="Recent Incidents" description="Latest reported security incidents" className="backdrop-blur-sm bg-white/50 dark:bg-surface-card/50 border border-slate-200 dark:border-slate-700">
          {recentIncidents.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-400 border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30">
                    <th className="py-3 px-4 font-medium">Threat Type</th>
                    <th className="py-3 px-4 font-medium hidden sm:table-cell">MITRE Technique</th>
                    <th className="py-3 px-4 font-medium">Severity</th>
                    <th className="py-3 px-4 font-medium">Status</th>
                    <th className="py-3 px-4 font-medium hidden md:table-cell">Detected</th>
                  </tr>
                </thead>
                <tbody>
                  {recentIncidents.map((inc) => (
                    <tr key={inc.id || inc._id} className="border-b border-slate-200/50 dark:border-slate-800/50 hover:bg-slate-50/50 dark:hover:bg-slate-700/30 transition-colors">
                      <td className="py-3 px-4 capitalize font-medium">{inc.threatType || '—'}</td>
                      <td className="py-3 px-4 hidden sm:table-cell">
                        {inc.mitreTechnique?.techniqueId ? (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 font-medium">
                            {inc.mitreTechnique.techniqueId}: {inc.mitreTechnique.techniqueName || ''}
                          </span>
                        ) : (
                          <span className="text-slate-400">â€”</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${severityColors[inc.severity] || 'bg-slate-500/10 text-slate-400'}`}>
                          {inc.severity}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[inc.status] || 'bg-slate-500/10 text-slate-400'}`}>
                          {inc.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-400 hidden md:table-cell">{rel(inc.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-slate-400">
              <CheckCircleIcon className="h-10 w-10 text-green-400 mb-2" />
              <p className="text-sm">No incidents recorded</p>
            </div>
          )}
        </Card>
      </motion.div>

      {/* ─── AI Incident Response Panel ─────────── */}
      <motion.div initial="hidden" animate="show" variants={fadeUp}>
        <Card
          title="AI Incident Response"
          description="Automated investigation and response recommendations with admin approval workflow"
          className="backdrop-blur-sm bg-white/50 dark:bg-surface-card/50 border border-slate-200 dark:border-slate-700"
        >
          {aiLoading ? (
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
          ) : aiError ? (
            <StateView type="error" title="AI Investigation Failed" message="The AI service is unavailable. Please try again." />
          ) : aiResult ? (
            <div className="space-y-6">
              {/* Investigation Result */}
              <div className="p-4 rounded-xl bg-slate-50/50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-3 mb-4">
                  <SparklesIcon className="h-5 w-5 text-cyber-400" />
                  <h3 className="text-lg font-semibold">AI Investigation Result</h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ml-auto ${
                    aiResult.aiProvider === 'gemini' ? 'bg-purple-500/10 text-purple-400' :
                    aiResult.aiProvider === 'ollama' ? 'bg-purple-500/10 text-purple-400' :
                    'bg-slate-500/10 text-slate-400'
                  }`}>
                    {aiResult.aiProvider || 'none'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                  <div className="p-3 rounded-xl bg-slate-50/50 dark:bg-slate-800/30">
                    <p className="text-xs text-slate-400 mb-1">Threat Severity</p>
                    <p className={`text-lg font-bold capitalize ${severityColors[aiResult.threatSeverity] || ''}`}>
                      {aiResult.threatSeverity}
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50/50 dark:bg-slate-800/30">
                    <p className="text-xs text-slate-400 mb-1">Confidence</p>
                    <p className="text-lg font-bold text-cyber-400">
                      {Math.round((aiResult.confidenceScore || 0) * 100)}%
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50/50 dark:bg-slate-800/30">
                    <p className="text-xs text-slate-400 mb-1">Response ID</p>
                    <p className="text-sm font-mono text-slate-300 truncate">{aiResult.responseId || 'N/A'}</p>
                  </div>
                </div>

                <div className="mb-4">
                  <p className="text-sm font-medium mb-2">Investigation Summary</p>
                  <p className="text-sm text-slate-300 leading-relaxed">{aiResult.investigationSummary}</p>
                </div>

                <div className="mb-4">
                  <p className="text-sm font-medium mb-2">Investigation Reasoning</p>
                  <p className="text-sm text-slate-400 leading-relaxed">{aiResult.investigationReasoning}</p>
                </div>

                {aiResult.mitreTechnique?.techniqueId && (
                  <div className="mb-4">
                    <p className="text-sm font-medium mb-1">MITRE Technique</p>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 font-medium">
                      {aiResult.mitreTechnique.techniqueId}: {aiResult.mitreTechnique.techniqueName}
                    </span>
                  </div>
                )}
              </div>

              {/* Recommended Actions */}
              {aiResult.recommendedActions && aiResult.recommendedActions.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-3">Recommended Actions</p>
                  <div className="space-y-2">
                    {aiResult.recommendedActions.map((action, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-slate-50/50 dark:bg-slate-800/30">
                        <div className="flex items-center gap-3">
                          <CheckCircleIcon className="h-4 w-4 text-green-400" />
                          <span className="text-sm">{action.action}</span>
                          <span className="text-xs text-slate-400 capitalize">({action.category})</span>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${severityColors[action.priority] || 'bg-slate-500/10 text-slate-400'}`}>
                          {action.priority}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center gap-3 pt-2 border-t border-slate-200 dark:border-slate-700">
                <button
                  onClick={() => handleRecommendResponse(activeIncidentId)}
                  disabled={actionLoading}
                  className="btn-cyber inline-flex items-center gap-2 text-sm"
                >
                  <ArrowDownOnSquareIcon className="h-4 w-4" />
                  {actionLoading ? 'Generating...' : 'Generate Response Plan'}
                </button>
                {responsePlan && (
                  <>
                    <button
                      onClick={() => handleApproveResponse(activeIncidentId, 'approved')}
                      disabled={actionLoading}
                      className="btn-primary inline-flex items-center gap-2 text-sm"
                    >
                      <CheckCircleIcon className="h-4 w-4" />
                      Approve Actions
                    </button>
                    <button
                      onClick={() => handleApproveResponse(activeIncidentId, 'rejected')}
                      disabled={actionLoading}
                      className="btn inline-flex items-center gap-2 text-sm text-danger border border-danger/30 hover:bg-danger/10"
                    >
                      <XCircleIcon className="h-4 w-4" />
                      Reject Actions
                    </button>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-6">
              <BeakerIcon className="h-10 w-10 text-cyber-400 mx-auto mb-3 opacity-50" />
              <p className="text-sm text-slate-400 mb-3">Select an incident to investigate with AI</p>
              {recentIncidents.length > 0 && (
                <div className="space-y-2 mt-4">
                  {recentIncidents.slice(0, 3).map((inc) => (
                    <div key={inc.id || inc._id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50/50 dark:bg-slate-800/30 hover:bg-slate-100/50 dark:hover:bg-slate-700/30 transition-colors cursor-pointer" onClick={() => handleAnalyzeIncident(inc.id || inc._id)}>
                      <div className="flex items-center gap-3">
                        <FingerPrintIcon className="h-4 w-4 text-cyber-400" />
                        <span className="text-sm font-medium capitalize">{inc.threatType || 'Unknown'}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${severityColors[inc.severity] || 'bg-slate-500/10 text-slate-400'}`}>
                          {inc.severity}
                        </span>
                      </div>
                      <ArrowPathIcon className="h-4 w-4 text-slate-400" />
                    </div>
                  ))}
                </div>
              )}
              {recentIncidents.length === 0 && (
                <p className="text-xs text-slate-500">No incidents available for investigation</p>
              )}
            </div>
          )}
        </Card>
      </motion.div>

      {/* ─── Threat Intelligence Panel ──────────── */}
      <motion.div initial="hidden" animate="show" variants={fadeUp}>
        <Card title="Threat Intelligence" description="Real-time feeds, CVEs, and confidence scoring" className="backdrop-blur-sm bg-white/50 dark:bg-surface-card/50 border border-slate-200 dark:border-slate-700">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Latest Threats */}
            <div className="lg:col-span-2">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <FireIcon className="h-4 w-4 text-orange-400" />
                Latest Threats
              </h3>
              <ThreatFeed threats={threats} loading={threatLoading} />
            </div>

            {/* Critical Alerts */}
            <div>
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <BugAntIcon className="h-4 w-4 text-red-400" />
                Critical Alerts
              </h3>
              {alertLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
                </div>
              ) : (
                <div className="space-y-3">
                  {alerts.filter((a) => a.severity === 'CRITICAL' || a.severity === 'HIGH').slice(0, 5).map((alert) => (
                    <AlertCard key={alert.id} alert={alert} onAcknowledge={handleAcknowledgeAlert} />
                  ))}
                  {alerts.filter((a) => a.severity === 'CRITICAL' || a.severity === 'HIGH').length === 0 && (
                    <p className="text-sm text-slate-400 text-center py-4">No critical alerts</p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Known CVEs + Threat Confidence */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
            <div className="lg:col-span-2">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <GlobeAltIcon className="h-4 w-4 text-purple-400" />
                Known CVEs
              </h3>
              {threatLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {cves.slice(0, 4).map((cve) => (
                    <CVECard key={cve.id} cve={cve} />
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <ChartBarIcon className="h-4 w-4 text-cyber-400" />
                Threat Confidence
              </h3>
              <div className="p-4 rounded-xl bg-slate-50/50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-700">
                <div className="mb-2">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-400">Confidence Score</span>
                    <span className="font-bold text-cyber-400">{threatConfidence}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-700 overflow-hidden">
                    <div className="h-full rounded-full bg-cyber-500 transition-all duration-1000" style={{ width: `${threatConfidence}%` }} />
                  </div>
                </div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-slate-400">Risk Level</span>
                  <span className={`font-bold ${riskLevel === 'Critical' ? 'text-red-400' : riskLevel === 'High' ? 'text-orange-400' : riskLevel === 'Medium' ? 'text-amber-400' : 'text-green-400'}`}>
                    {riskLevel}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Threats Detected</span>
                  <span className="font-bold">{dashboard?.threatsDetected || 0}</span>
                </div>
              </div>

              {/* Alert Timeline */}
              <div>
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Recent Alert Activity</h4>
                <div className="space-y-2">
                  {alerts.slice(0, 5).map((alert) => (
                    <div key={alert.id} className="flex items-center gap-2 p-2 rounded-lg bg-slate-50/50 dark:bg-slate-800/30">
                      <span className={`h-2 w-2 rounded-full ${
                        alert.severity === 'CRITICAL' ? 'bg-red-500' :
                        alert.severity === 'HIGH' ? 'bg-orange-500' :
                        alert.severity === 'MEDIUM' ? 'bg-amber-500' : 'bg-green-500'
                      }`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{alert.title}</p>
                        <p className="text-xs text-slate-500">{rel(alert.createdAt)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* ─── MITRE Technique Information ─────────── */}
      {mitreTechniques.length > 0 && (
        <motion.div initial="hidden" animate="show" variants={fadeUp}>
          <Card title="MITRE ATT&CK Techniques" description="Techniques mapped from recent incidents" className="backdrop-blur-sm bg-white/50 dark:bg-surface-card/50 border border-slate-200 dark:border-slate-700">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {mitreTechniques.map((tech) => (
                <div key={tech.techniqueId || tech.technique} className="p-4 rounded-xl bg-slate-50/50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-700">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-mono font-bold text-cyber-400">{tech.techniqueId || 'â€”'}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${severityColors[tech.severity] || 'bg-slate-500/10 text-slate-400'}`}>
                      {tech.severity || 'â€”'}
                    </span>
                  </div>
                  <p className="text-sm font-semibold mb-1">{tech.techniqueName || 'Unknown Technique'}</p>
                  <p className="text-xs text-slate-400 mb-2 capitalize">{tech.tactic || 'â€”'}</p>
                  {tech.description && (
                    <p className="text-xs text-slate-500 dark:text-slate-400">{tech.description}</p>
                  )}
                </div>
              ))}
            </div>
          </Card>
        </motion.div>
      )}
    </div>
  );
}