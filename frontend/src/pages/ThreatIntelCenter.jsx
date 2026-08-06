import { useEffect, useState, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import {
  ShieldCheckIcon, MagnifyingGlassIcon, ExclamationTriangleIcon,
  CheckCircleIcon, XCircleIcon, BugAntIcon,
  ChartBarIcon, ClockIcon, CogIcon, UserIcon,
  GlobeAltIcon, DocumentTextIcon, InformationCircleIcon,
  ServerStackIcon, KeyIcon, LinkIcon, HashtagIcon,
  EnvelopeIcon, CodeBracketSquareIcon, SparklesIcon,
} from '@heroicons/react/24/outline';
import api from '../services/api.js';
import endpoints from '../services/endpoints.js';
import useRealtimeDashboard from '../hooks/useRealtimeDashboard.js';
import StatCard from '../components/ui/StatCard.jsx';
import Card from '../components/ui/Card.jsx';
import Skeleton from '../components/ui/Skeleton.jsx';
import StateView from '../components/ui/StateView.jsx';
import Loader from '../components/ui/Loader.jsx';
import RiskMeter from '../components/ui/RiskMeter.jsx';
import Badge from '../components/ui/Badge.jsx';

const fadeUp = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.4 } } };
const stagger = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } };

const IOC_TYPE_OPTIONS = [
  { value: '', label: 'Auto-detect' },
  { value: 'ip', label: 'IP Address', icon: ServerStackIcon },
  { value: 'domain', label: 'Domain', icon: GlobeAltIcon },
  { value: 'url', label: 'URL', icon: LinkIcon },
  { value: 'hash', label: 'File Hash', icon: HashtagIcon },
  { value: 'email', label: 'Email', icon: EnvelopeIcon },
  { value: 'cve', label: 'CVE ID', icon: CodeBracketSquareIcon },
];

const IOC_ICONS = {
  ip: ServerStackIcon,
  domain: GlobeAltIcon,
  url: LinkIcon,
  hash: HashtagIcon,
  email: EnvelopeIcon,
  cve: CodeBracketSquareIcon,
};

const severityColors = {
  Critical: 'bg-red-500/10 text-red-400',
  High: 'bg-orange-500/10 text-orange-400',
  Medium: 'bg-amber-500/10 text-amber-400',
  Low: 'bg-green-500/10 text-green-400',
};

const classificationTone = {
  malicious: 'danger',
  suspicious: 'warning',
  clean: 'safe',
  unknown: 'neutral',
};

export default function ThreatIntelCenter() {
  const [dashboard, setDashboard] = useState(null);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState(false);

  const [iocInput, setIocInput] = useState('');
  const [iocType, setIocType] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);

  const [iocHistory, setIocHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotal, setHistoryTotal] = useState(0);

  const [correlationIocs, setCorrelationIocs] = useState([]);
  const [correlationLoading, setCorrelationLoading] = useState(false);
  const [correlationResult, setCorrelationResult] = useState(null);

  const [activeTab, setActiveTab] = useState('lookup');

  useEffect(() => {
    setDashboardLoading(true);
    setDashboardError(false);
    endpoints.getThreatIntelDashboard()
      .then((data) => {
        setDashboard(data);
        setDashboardError(false);
      })
      .catch(() => setDashboardError(true))
      .finally(() => setDashboardLoading(false));
  }, []);

  useEffect(() => {
    fetchIocHistory(historyPage);
  }, [historyPage]);

  useRealtimeDashboard({
    onThreatAnalysisCompleted: useCallback((payload) => {
      const { ioc, iocType, result } = payload || {};
      toast.success(`IOC analysis updated: ${ioc} - ${result?.classification || 'unknown'}`, { autoClose: 5000 });
      if (activeTab === 'history') {
        fetchIocHistory(historyPage);
      }
      if (activeTab === 'dashboard' && result) {
        setDashboard((prev) => {
          if (!prev) return prev;
          const recentIocs = [{
            id: result?.iocId || `ioc-${Date.now()}`,
            ioc,
            iocType,
            reputationScore: result?.reputationScore || 0,
            classification: result?.classification || 'unknown',
            createdAt: new Date().toISOString(),
          }, ...(prev.recentIocs || [])];
          return { ...prev, totalIocs: (prev.totalIocs || 0) + 1, recentIocs: recentIocs.slice(0, 10) };
        });
      }
    }, [activeTab, historyPage, fetchIocHistory]),
    onThreatFeedUpdate: useCallback((payload) => {
      toast.info('Threat intelligence feed updated', { autoClose: 3000 });
      if (activeTab === 'dashboard') {
        endpoints.getThreatIntelDashboard()
          .then(setDashboard)
          .catch(() => {});
      }
    }, [activeTab]),
  });

  const fetchIocHistory = useCallback(async (page) => {
    setHistoryLoading(true);
    try {
      const data = await endpoints.getIocHistory({ page, limit: 20 });
      setIocHistory(data.iocs || []);
      setHistoryTotal(data.total || 0);
    } catch {
      toast.error('Failed to load IOC history');
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const handleAnalyze = useCallback(async () => {
    if (!iocInput.trim()) {
      toast.error('Please enter an IOC value');
      return;
    }
    setIsAnalyzing(true);
    setAnalysisResult(null);
    try {
      const data = await endpoints.analyzeIoc(iocInput.trim(), iocType || undefined);
      setAnalysisResult(data);
      toast.success(`IOC analyzed: ${data.classification}`);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'IOC analysis failed');
    } finally {
      setIsAnalyzing(false);
    }
  }, [iocInput, iocType]);

  const handleAddCorrelationIoc = (ioc, type) => {
    if (!ioc || correlationIocs.some((i) => i.value === ioc && i.type === type)) return;
    setCorrelationIocs([...correlationIocs, { value: ioc, type }]);
  };

  const handleRemoveCorrelationIoc = (idx) => {
    setCorrelationIocs(correlationIocs.filter((_, i) => i !== idx));
  };

  const handleCorrelate = useCallback(async () => {
    if (correlationIocs.length === 0) {
      toast.error('Add at least one IOC to correlate');
      return;
    }
    setCorrelationLoading(true);
    setCorrelationResult(null);
    try {
      const data = await endpoints.correlateIocs(correlationIocs);
      setCorrelationResult(data);
      toast.success(`Correlation complete: ${data.results?.length || 0} IOCs analyzed`);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Correlation failed');
    } finally {
      setCorrelationLoading(false);
    }
  }, [correlationIocs]);

  const handleIocHistoryClick = useCallback(async (id) => {
    try {
      const data = await endpoints.getIocReport(id);
      setAnalysisResult(data);
      setActiveTab('lookup');
      toast.success('IOC report loaded');
    } catch {
      toast.error('Failed to load IOC report');
    }
  }, []);

  const classificationData = useMemo(() => {
    const data = dashboard?.classificationStats || [];
    return {
      labels: data.map((d) => d._id.charAt(0).toUpperCase() + d._id.slice(1)),
      datasets: [{
        data: data.map((d) => d.count),
        backgroundColor: ['#ef4444', '#f59e0b', '#10b981', '#6b7280'],
        borderColor: ['#991b1b', '#92400e', '#065f46', '#374151'],
        borderWidth: 1,
      }],
    };
  }, [dashboard]);

  const threatCategoryData = useMemo(() => {
    const data = dashboard?.topThreatCategories || [];
    return {
      labels: data.map((d) => d.category),
      datasets: [{
        label: 'IOC Count',
        data: data.map((d) => d.count),
        backgroundColor: 'rgba(56, 189, 248, 0.6)',
        borderColor: 'rgba(14, 165, 233, 1)',
        borderWidth: 1,
      }],
    };
  }, [dashboard]);

  const reputationTrendData = useMemo(() => {
    const data = dashboard?.reputationTrend || [];
    return {
      labels: data.map((t) => t.date.slice(5)),
      datasets: [
        {
          label: 'Total IOCs',
          data: data.map((t) => t.total),
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          fill: true,
          tension: 0.4,
        },
        {
          label: 'Malicious',
          data: data.map((t) => t.malicious),
          borderColor: '#ef4444',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          fill: true,
          tension: 0.4,
        },
        {
          label: 'Suspicious',
          data: data.map((t) => t.suspicious),
          borderColor: '#f59e0b',
          backgroundColor: 'rgba(245, 158, 11, 0.1)',
          fill: true,
          tension: 0.4,
        },
      ],
    };
  }, [dashboard]);

  const renderAnalysisResult = () => {
    if (!analysisResult) return null;

    const { ioc, iocType: type, reputationScore, classification, threatCategory, threatPriority, malwareInfo, relatedCves, mitreTechniques, attackTimeline, providers, aiSummary, recommendedResponse } = analysisResult;
    const Icon = IOC_ICONS[type] || MagnifyingGlassIcon;

    return (
      <motion.div initial="hidden" animate="show" variants={stagger} className="space-y-6">
        <motion.div variants={fadeUp}>
          <Card title="IOC Analysis Result" description={`${type.toUpperCase()} • ${ioc}`} className="backdrop-blur-sm bg-white/50 dark:bg-surface-card/50">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-1 flex flex-col items-center">
                <RiskMeter score={reputationScore} size={140} />
                <div className="mt-4 flex gap-2">
                  <Badge tone={classificationTone[classification] || 'neutral'}>{classification}</Badge>
                  <Badge tone="info">{threatCategory}</Badge>
                </div>
                <p className="text-xs text-slate-400 mt-2">Confidence: {Math.round(((providers || []).filter((p) => p.success).length / Math.max(1, (providers || []).length)) * 100)}%</p>
              </div>

              <div className="lg:col-span-2 space-y-4">
                <div>
                  <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Recommended Response</h4>
                  <Badge tone={recommendedResponse === 'immediate_block' ? 'danger' : recommendedResponse === 'investigate_block' ? 'warning' : 'safe'}>
                    {recommendedResponse?.replace('_', ' ') || 'monitor'}
                  </Badge>
                </div>

                {aiSummary?.response && (
                  <div>
                    <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                      <SparklesIcon className="h-4 w-4 text-cyber-400" />
                      AI Threat Summary
                    </h4>
                    <div className="text-sm text-slate-300 leading-relaxed p-4 rounded-xl bg-slate-50/50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-700 max-h-48 overflow-y-auto">
                      {aiSummary.response}
                    </div>
                    <p className="text-xs text-slate-400 mt-1">Provider: {aiSummary.provider}</p>
                  </div>
                )}

                {malwareInfo?.isMalware && (
                  <div>
                    <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Malware Information</h4>
                    <p className="text-sm"><span className="text-slate-400">Family:</span> {malwareInfo.family || 'Unknown'}</p>
                    <p className="text-sm"><span className="text-slate-400">Type:</span> {malwareInfo.type || 'Unknown'}</p>
                    {malwareInfo.names?.length > 0 && (
                      <p className="text-sm text-slate-300 mt-1">Aliases: {malwareInfo.names.join(', ')}</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </Card>
        </motion.div>

        <motion.div variants={fadeUp} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card title="Provider Results" description="Threat intelligence sources" className="backdrop-blur-sm bg-white/50 dark:bg-surface-card/50">
            <div className="space-y-3">
              {(providers || []).map((p) => (
                <div key={p.provider} className="flex items-center justify-between p-3 rounded-xl bg-slate-50/50 dark:bg-slate-800/30">
                  <div className="flex items-center gap-3">
                    <div className={`h-2 w-2 rounded-full ${p.success ? 'bg-green-400' : 'bg-red-400'}`} />
                    <span className="text-sm font-medium">{p.provider || 'Unknown'}</span>
                  </div>
                  {p.error && <span className="text-xs text-red-400" title={p.error}>Error</span>}
                  {p.success && p.reputation !== undefined && (
                    <Badge tone={p.reputation >= 80 ? 'danger' : p.reputation >= 40 ? 'warning' : 'safe'}>
                      Score: {p.reputation}
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </Card>

          <Card title="Related CVEs" description="Known vulnerabilities" className="backdrop-blur-sm bg-white/50 dark:bg-surface-card/50">
            {relatedCves?.length > 0 ? (
              <div className="space-y-3">
                {relatedCves.slice(0, 5).map((cve) => (
                  <div key={cve.id || cve} className="p-3 rounded-xl bg-slate-50/50 dark:bg-slate-800/30">
                    <div className="flex items-center justify-between">
                      <Badge tone="danger">{cve.id || cve}</Badge>
                      {cve.cvssScore && <span className="text-xs text-slate-400">CVSS: {cve.cvssScore}</span>}
                    </div>
                    <p className="text-xs text-slate-400 mt-1 line-clamp-2">{cve.description || 'No description available'}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400 text-center py-4">No related CVEs found</p>
            )}
          </Card>
        </motion.div>

        <motion.div variants={fadeUp} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card title="MITRE ATT&CK Techniques" description="Mapped techniques" className="backdrop-blur-sm bg-white/50 dark:bg-surface-card/50">
            {mitreTechniques?.length > 0 ? (
              <div className="space-y-3">
                {mitreTechniques.slice(0, 6).map((tech, i) => (
                  <div key={tech.techniqueId || i} className="p-3 rounded-xl bg-slate-50/50 dark:bg-slate-800/30">
                    <div className="flex items-center justify-between mb-1">
                      <Badge tone="info">{tech.techniqueId || '—'}</Badge>
                      <Badge tone={tech.severity === 'Critical' ? 'danger' : tech.severity === 'High' ? 'warning' : 'neutral'}>
                        {tech.severity || 'Medium'}
                      </Badge>
                    </div>
                    <p className="text-sm font-medium">{tech.techniqueName || 'Unknown'}</p>
                    <p className="text-xs text-slate-400 capitalize">{tech.tactic || '—'}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400 text-center py-4">No MITRE techniques mapped</p>
            )}
          </Card>

          <Card title="Attack Timeline" description="Chronological threat activity" className="backdrop-blur-sm bg-white/50 dark:bg-surface-card/50">
            {attackTimeline?.length > 0 ? (
              <div className="space-y-3">
                {attackTimeline
                  .slice()
                  .sort((a, b) => new Date(b.date) - new Date(a.date))
                  .slice(0, 8)
                  .map((event, i) => (
                    <div key={i} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className="h-2 w-2 rounded-full bg-cyan-400" />
                        {i < attackTimeline.length - 1 && <div className="w-px h-full bg-slate-700 mt-1" />}
                      </div>
                      <div className="flex-1 pb-4">
                        <p className="text-xs text-slate-400">{event.date ? new Date(event.date).toLocaleDateString() : '—'}</p>
                        <p className="text-sm font-medium">{event.event || 'Threat activity'}</p>
                        {event.description && <p className="text-xs text-slate-500 mt-1">{event.description}</p>}
                      </div>
                    </div>
                  ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400 text-center py-4">No timeline events</p>
            )}
          </Card>
        </motion.div>
      </motion.div>
    );
  };

  const renderCorrelation = () => (
    <motion.div initial="hidden" animate="show" variants={stagger} className="space-y-6">
      <motion.div variants={fadeUp}>
        <Card title="Multi-IOC Correlation" description="Analyze multiple IOCs and find relationships" className="backdrop-blur-sm bg-white/50 dark:bg-surface-card/50">
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">IOC List</label>
              <div className="space-y-2 mt-2">
                {correlationIocs.map((ioc, idx) => (
                  <div key={idx} className="flex items-center gap-2 p-2 rounded-lg bg-slate-50/50 dark:bg-slate-800/30">
                    <select
                      value={ioc.type}
                      onChange={(e) => {
                        const newIocs = [...correlationIocs];
                        newIocs[idx].type = e.target.value;
                        setCorrelationIocs(newIocs);
                      }}
                      className="text-xs bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1"
                    >
                      {IOC_TYPE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={ioc.value}
                      onChange={(e) => {
                        const newIocs = [...correlationIocs];
                        newIocs[idx].value = e.target.value;
                        setCorrelationIocs(newIocs);
                      }}
                      className="flex-1 text-sm bg-transparent border-b border-slate-300 dark:border-slate-700 focus:border-cyan-400 outline-none"
                      placeholder="Enter IOC value..."
                    />
                    <button
                      onClick={() => handleRemoveCorrelationIoc(idx)}
                      className="text-red-400 hover:text-red-300"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              <button
                onClick={() => setCorrelationIocs([...correlationIocs, { value: '', type: '' }])}
                className="mt-2 text-xs text-cyan-400 hover:text-cyan-300"
              >
                + Add IOC
              </button>
            </div>

            <button
              onClick={handleCorrelate}
              disabled={correlationLoading || correlationIocs.length === 0}
              className="btn-cyber inline-flex items-center gap-2 text-sm"
            >
              {correlationLoading ? <Loader label="Correlating..." /> : <ChartBarIcon className="h-4 w-4" />}
              Correlate IOCs
            </button>

            {correlationResult && (
              <div className="mt-4">
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Correlation Results</h4>
                <div className="text-sm text-slate-300 space-y-2">
                  {correlationResult.results?.map((r, i) => (
                    <div key={i} className="p-2 rounded bg-slate-50/50 dark:bg-slate-800/30">
                      <span className="font-medium">{r.ioc}</span>
                      {' — '}
                      <Badge tone={classificationTone[r.classification] || 'neutral'}>{r.classification}</Badge>
                      {' '}Score: {r.reputationScore}
                    </div>
                  ))}
                  {correlationResult.correlation && (
                    <div className="p-3 rounded-xl bg-slate-50/50 dark:bg-slate-800/30 mt-2">
                      <p className="text-xs text-slate-400">Threat Priority: {correlationResult.correlation.threatPriority}</p>
                      <p className="text-xs text-slate-400">Confidence: {Math.round((correlationResult.correlation.confidenceScore || 0) * 100)}%</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </Card>
      </motion.div>
    </motion.div>
  );

  const renderHistory = () => (
    <motion.div initial="hidden" animate="show" variants={fadeUp} className="space-y-6">
      <Card title="IOC Analysis History" description="Previously analyzed IOCs" className="backdrop-blur-sm bg-white/50 dark:bg-surface-card/50">
        {historyLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
          </div>
        ) : iocHistory.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-400 border-b border-slate-200 dark:border-slate-700">
                  <th className="py-3 px-4 font-medium">IOC</th>
                  <th className="py-3 px-4 font-medium hidden sm:table-cell">Type</th>
                  <th className="py-3 px-4 font-medium">Reputation</th>
                  <th className="py-3 px-4 font-medium">Classification</th>
                  <th className="py-3 px-4 font-medium hidden md:table-cell">Threat Category</th>
                  <th className="py-3 px-4 font-medium hidden lg:table-cell">Date</th>
                </tr>
              </thead>
              <tbody>
                {iocHistory.map((ioc) => {
                  const Icon = IOC_ICONS[ioc.iocType] || MagnifyingGlassIcon;
                  return (
                    <tr
                      key={ioc.id}
                      className="border-b border-slate-200/50 dark:border-slate-800/50 hover:bg-slate-50/50 dark:hover:bg-slate-700/30 cursor-pointer transition-colors"
                      onClick={() => handleIocHistoryClick(ioc.id)}
                    >
                      <td className="py-3 px-4 font-mono text-xs flex items-center gap-2">
                        <Icon className="h-4 w-4 text-slate-400" />
                        {ioc.ioc}
                      </td>
                      <td className="py-3 px-4 hidden sm:table-cell capitalize">{ioc.iocType}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-bold">{ioc.reputationScore}</span>
                          <div className="h-2 w-12 rounded-full bg-slate-700 overflow-hidden">
                            <div className={`h-full rounded-full transition-all ${
                              ioc.reputationScore >= 80 ? 'bg-red-500' : ioc.reputationScore >= 40 ? 'bg-amber-500' : 'bg-green-500'
                            }`} style={{ width: `${Math.min(100, ioc.reputationScore)}%` }} />
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <Badge tone={classificationTone[ioc.classification] || 'neutral'}>{ioc.classification}</Badge>
                      </td>
                      <td className="py-3 px-4 hidden md:table-cell text-slate-400">{ioc.threatCategory}</td>
                      <td className="py-3 px-4 hidden lg:table-cell text-xs text-slate-500">
                        {ioc.createdAt ? new Date(ioc.createdAt).toLocaleDateString() : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <StateView type="empty" title="No IOC history" message="Analyze IOCs to see them here." />
        )}

        {historyTotal > 20 && (
          <div className="flex justify-center gap-2 mt-4">
            <button
              onClick={() => setHistoryPage(Math.max(1, historyPage - 1))}
              disabled={historyPage === 1 || historyLoading}
              className="btn btn-sm"
            >
              Previous
            </button>
            <span className="text-xs text-slate-400 flex items-center px-2">
              Page {historyPage} of {Math.ceil(historyTotal / 20)}
            </span>
            <button
              onClick={() => setHistoryPage(historyPage + 1)}
              disabled={historyPage >= Math.ceil(historyTotal / 20) || historyLoading}
              className="btn btn-sm"
            >
              Next
            </button>
          </div>
        )}
      </Card>
    </motion.div>
  );

  const renderDashboard = () => {
    if (dashboardLoading) {
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

    if (dashboardError || !dashboard) {
      return <StateView type="error" title="Couldn't load threat intelligence dashboard" message="Check your connection and try again." />;
    }

    const avgReputation = dashboard.avgReputation || 0;
    const riskColor = avgReputation >= 80 ? 'text-red-400' : avgReputation >= 40 ? 'text-amber-400' : 'text-green-400';

    return (
      <motion.div initial="hidden" animate="show" variants={stagger} className="space-y-6">
        <motion.div variants={fadeUp}>
          <StatCard title="Total IOCs Analyzed" value={dashboard.totalIocs || 0} icon={MagnifyingGlassIcon} accent="cyber" subtitle={`${dashboard.activeProviders.length} active providers`} />
        </motion.div>

        <motion.div variants={fadeUp} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card title="Classification Distribution" description="IOC verdict breakdown" className="backdrop-blur-sm bg-white/50 dark:bg-surface-card/50">
            <div className="h-56">
              <Doughnut
                data={classificationData}
                options={{ cutout: '60%', plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8' } } } }}
              />
            </div>
          </Card>

          <Card title="Threat Categories" description="Categories by IOC count" className="backdrop-blur-sm bg-white/50 dark:bg-surface-card/50">
            <div className="h-56">
              <Bar
                data={threatCategoryData}
                options={{
                  indexAxis: 'y',
                  plugins: { legend: { display: false } },
                  scales: {
                    x: { ticks: { color: '#94a3b8' } },
                    y: { ticks: { color: '#94a3b8' } },
                  },
                }}
              />
            </div>
          </Card>
        </motion.div>

        <motion.div variants={fadeUp}>
          <Card title="Reputation Trend" description="IOC analysis over time" className="backdrop-blur-sm bg-white/50 dark:bg-surface-card/50">
            <div className="h-56">
              <Line data={reputationTrendData} options={{ plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8' } } }, scales: { x: { ticks: { color: '#94a3b8' } }, y: { ticks: { color: '#94a3b8' } } } }} />
            </div>
          </Card>
        </motion.div>

        <motion.div variants={fadeUp}>
          <Card title="Recent IOCs" description="Latest analyzed indicators" className="backdrop-blur-sm bg-white/50 dark:bg-surface-card/50">
            {dashboard.recentIocs?.length > 0 ? (
              <div className="space-y-3">
                {dashboard.recentIocs.map((ioc) => {
                  const Icon = IOC_ICONS[ioc.iocType] || MagnifyingGlassIcon;
                  return (
                    <div key={ioc.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50/50 dark:bg-slate-800/30" onClick={() => handleIocHistoryClick(ioc.id)} style={{ cursor: 'pointer' }}>
                      <div className="flex items-center gap-3">
                        <Icon className="h-4 w-4 text-slate-400" />
                        <div>
                          <p className="text-sm font-medium font-mono">{ioc.ioc}</p>
                          <p className="text-xs text-slate-400 capitalize">{ioc.iocType}</p>
                        </div>
                      </div>
                      <Badge tone={classificationTone[ioc.classification] || 'neutral'}>{ioc.classification}</Badge>
                    </div>
                  );
                })}
              </div>
            ) : (
              <StateView type="empty" title="No IOCs analyzed yet" message="Use the Lookup tab to analyze an indicator of compromise." />
            )}
          </Card>
        </motion.div>

        <motion.div variants={fadeUp} className="bg-slate-50/50 dark:bg-slate-800/30 rounded-2xl p-4 border border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Average Reputation Score</h3>
            <span className={`text-2xl font-bold ${riskColor}`}>{avgReputation}</span>
          </div>
          <div className="h-2 rounded-full bg-slate-700 overflow-hidden">
            <div className={`h-full rounded-full transition-all duration-1000 ${
              avgReputation >= 80 ? 'bg-red-500' : avgReputation >= 40 ? 'bg-amber-500' : 'bg-green-500'
            }`} style={{ width: `${Math.min(100, avgReputation)}%` }} />
          </div>
        </motion.div>
      </motion.div>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <motion.div initial="hidden" animate="show" variants={fadeUp}>
        <div className="flex items-center gap-3 mb-1">
          <ShieldCheckIcon className="h-8 w-8 text-cyber-400" />
          <h1 className="text-2xl font-bold">Threat Intelligence Center</h1>
        </div>
        <p className="text-sm text-slate-400">
          Multi-provider IOC analysis with VirusTotal, AbuseIPDB, AlienVault OTX, NVD, and MITRE ATT&CK correlation.
        </p>
      </motion.div>

      <motion.div
        className="flex gap-2 border-b border-slate-200 dark:border-slate-700"
        initial="hidden"
        animate="show"
        variants={fadeUp}
      >
        {[
          { value: 'lookup', label: 'IOC Lookup', icon: MagnifyingGlassIcon },
          { value: 'correlation', label: 'Correlation', icon: ChartBarIcon },
          { value: 'history', label: 'IOC History', icon: ClockIcon },
          { value: 'dashboard', label: 'Dashboard', icon: GlobeAltIcon },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.value;
          return (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                isActive
                  ? 'bg-cyan-500/10 text-cyan-400 border-b-2 border-cyan-400'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </motion.div>

      {activeTab === 'lookup' && (
        <>
          <motion.div
            className="flex gap-3 items-end"
            initial="hidden"
            animate="show"
            variants={fadeUp}
          >
            <div className="flex-1">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">IOC Value</label>
              <input
                type="text"
                value={iocInput}
                onChange={(e) => setIocInput(e.target.value)}
                placeholder="Enter IP, domain, URL, hash, email, or CVE identifier"
                className="w-full px-4 py-2 rounded-xl bg-white dark:bg-surface-card border border-slate-200 dark:border-slate-700 focus:border-cyan-400 focus:outline-none text-sm"
                onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
              />
            </div>
            <div className="w-48">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Type</label>
              <select
                value={iocType}
                onChange={(e) => setIocType(e.target.value)}
                className="w-full px-4 py-2 rounded-xl bg-white dark:bg-surface-card border border-slate-200 dark:border-slate-700 focus:border-cyan-400 outline-none text-sm"
              >
                {IOC_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <button
              onClick={handleAnalyze}
              disabled={isAnalyzing || !iocInput.trim()}
              className="btn-cyber inline-flex items-center gap-2 px-4 py-2 text-sm"
            >
              {isAnalyzing ? <Loader label="Analyzing..." /> : <MagnifyingGlassIcon className="h-4 w-4" />}
              Analyze
            </button>
          </motion.div>

          {analysisResult ? (
            renderAnalysisResult()
          ) : (
            <motion.div initial="hidden" animate="show" variants={fadeUp}>
              <StateView type="info" title="Ready to analyze" message="Enter an IOC value and click Analyze to get reputation, classification, and threat intelligence from multiple providers." />
            </motion.div>
          )}
        </>
      )}

      {activeTab === 'correlation' && renderCorrelation()}

      {activeTab === 'history' && renderHistory()}

      {activeTab === 'dashboard' && renderDashboard()}
    </div>
  );
}


