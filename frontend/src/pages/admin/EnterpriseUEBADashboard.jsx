import { useEffect, useState, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';
import {
  ShieldCheckIcon, ExclamationTriangleIcon, UserIcon,
  ClockIcon, ChartBarIcon, MapPinIcon, DeviceTabletIcon,
  CheckCircleIcon, SparklesIcon, ArrowRightIcon,
  FunnelIcon, MagnifyingGlassIcon, BellIcon,
} from '@heroicons/react/24/outline';
import endpoints from '../../services/endpoints.js';
import useUEBA from '../../hooks/useUEBA.js';
import StatCard from '../../components/ui/StatCard.jsx';
import Card from '../../components/ui/Card.jsx';
import Skeleton from '../../components/ui/Skeleton.jsx';
import StateView from '../../components/ui/StateView.jsx';
import Badge from '../../components/ui/Badge.jsx';
import Button from '../../components/ui/Button.jsx';
import RiskLevel from '../../components/ui/RiskLevel.jsx';
import { AnimatePresence } from 'framer-motion';

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

const stagger = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const severityColors = {
  Critical: 'bg-red-500/10 text-red-400 border-red-500/30',
  High: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
  Medium: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  Low: 'bg-green-500/10 text-green-400 border-green-500/30',
};

const categoryIcons = {
  authentication: ClockIcon,
  security_activity: ShieldCheckIcon,
  network_behavior: MapPinIcon,
  user_action: DeviceTabletIcon,
};

const rel = (iso) => {
  if (!iso) return '—';
  const diff = (Date.now() - new Date(iso)) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
};

export default function EnterpriseUEBADashboard() {
  const { t } = useTranslation();
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedAnomaly, setSelectedAnomaly] = useState(null);
  const [anomaliesPage, setAnomaliesPage] = useState(1);
  const [allAnomalies, setAllAnomalies] = useState([]);

  const { onAnomalyDetected, onRiskUpdated, onProfileUpdated } = useUEBA({
    onAnomalyDetected: useCallback((payload) => {
      toast.warn(`UEBA Anomaly: ${payload.title}`, { autoClose: 6000 });
      refreshData();
    }, []),
    onRiskUpdated: useCallback((payload) => {
      if (selectedUser?.userId?._id || selectedUser?.userId) {
        const uid = (selectedUser.userId._id || selectedUser.userId).toString();
        if (payload.userId === uid) {
          setSelectedUser((prev) => ({ ...prev, riskScore: payload.riskScore, riskLevel: payload.riskLevel }));
        }
      }
    }, [selectedUser]),
    onProfileUpdated: useCallback((payload) => {
      if (selectedUser) {
        const uid = (selectedUser.userId._id || selectedUser.userId).toString();
        if (payload.userId === uid) {
          setSelectedUser((prev) => ({ ...prev, ...payload }));
        }
      }
    }, [selectedUser]),
  });

  const refreshData = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const data = await endpoints.getUebaDashboard();
      setDashboard(data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  useEffect(() => {
    if (selectedUser?.userId) {
      fetchUserData(selectedUser.userId._id || selectedUser.userId);
    }
  }, [selectedUser?.userId]);

  const fetchUserData = useCallback(async (userId) => {
    try {
      const [profileRes, timelineRes, anomaliesRes, trendRes] = await Promise.all([
        endpoints.getUserBehaviorProfile(userId),
        endpoints.getUserTimeline(userId, { days: 7 }),
        endpoints.getUserAnomalies(userId, { page: 1 }),
        endpoints.getUserRiskTrend(userId, { days: 30 }),
      ]);

      setSelectedUser((prev) => ({
        ...prev,
        profile: profileRes,
        timeline: timelineRes,
        anomalies: anomaliesRes.events || [],
        trend: trendRes,
        anomaliesTotal: anomaliesRes.total || 0,
      }));
    } catch (err) {
      toast.error('Failed to load user data');
    }
  }, []);

  const handleViewUser = useCallback(async (user) => {
    setSelectedUser(user);
    setSelectedAnomaly(null);
    await fetchUserData(user.userId._id || user.userId);
  }, [fetchUserData]);

  const handleViewAnomaly = useCallback((anomaly) => {
    setSelectedAnomaly(anomaly);
  }, []);

  const handleResolveAnomaly = useCallback(async (anomalyId, status) => {
    try {
      await endpoints.resolveAnomaly(anomalyId, status);
      toast.success(`Anomaly ${status}`);
      refreshData();
      if (selectedUser) fetchUserData(selectedUser.userId._id || selectedUser.userId);
    } catch {
      toast.error('Failed to resolve anomaly');
    }
  }, [refreshData, selectedUser, fetchUserData]);

  const handleRunDetection = useCallback(async (userId) => {
    try {
      const result = await endpoints.runAnomalyDetection(userId);
      toast.success(`Detection complete: ${result.anomalyCount || 0} new anomalies`);
      refreshData();
    } catch {
      toast.error('Detection failed');
    }
  }, [refreshData]);

  const loadMoreAnomalies = useCallback(async () => {
    if (!selectedUser) return;
    const nextPage = anomaliesPage + 1;
    setAnomaliesPage(nextPage);
    try {
      const result = await endpoints.getUserAnomalies(selectedUser.userId._id || selectedUser.userId, { page: nextPage });
      setSelectedUser((prev) => ({ ...prev, anomalies: [...(prev.anomalies || []), ...(result.events || [])] }));
    } catch {
      toast.error('Failed to load more anomalies');
    }
  }, [anomaliesPage, selectedUser]);

  const riskRanking = dashboard?.riskRanking || [];
  const metrics = dashboard?.metrics || {};
  const riskTrendData = useMemo(() => {
    const trend = selectedUser?.trend || [];
    return {
      labels: trend.map((t) => t.date),
      datasets: [
        { label: 'Risk Score', data: trend.map((t) => t.riskScore), borderColor: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.1)', fill: true, tension: 0.4 },
      ],
    };
  }, [selectedUser]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
        </div>
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    );
  }

  if (error || !dashboard) {
    return <StateView type="error" title="Couldn't load UEBA dashboard" message="Check your connection and try again." />;
  }

  const renderRiskScoreRow = () => {
    const score = selectedUser?.profile?.riskScore || selectedUser?.riskScore || 0;
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-slate-50/50 dark:bg-slate-800/30">
          <p className="text-xs text-slate-400 mb-1">Risk Score</p>
          <p className="text-3xl font-bold text-red-400">{score}</p>
        </div>
        <div className="p-4 rounded-xl bg-slate-50/50 dark:bg-slate-800/30">
          <p className="text-xs text-slate-400 mb-1">Risk Level</p>
          <RiskLevel score={score} />
        </div>
        <div className="p-4 rounded-xl bg-slate-50/50 dark:bg-slate-800/30">
          <p className="text-xs text-slate-400 mb-1">Anomalies</p>
          <p className="text-3xl font-bold text-orange-400">{selectedUser?.profile?.anomalyCount || selectedUser?.anomalyCount || 0}</p>
        </div>
        <div className="p-4 rounded-xl bg-slate-50/50 dark:bg-slate-800/30">
          <p className="text-xs text-slate-400 mb-1">High-Risk</p>
          <p className="text-3xl font-bold text-red-400">{selectedUser?.profile?.highRiskAnomalyCount || selectedUser?.highRiskAnomalyCount || 0}</p>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl mx-auto">
      {/* Header */}
      <motion.div initial="hidden" animate="show" variants={fadeUp} className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Enterprise UEBA Dashboard</h1>
          <p className="text-sm text-slate-400">User Entity Behavior Analytics — anomaly detection, risk scoring, and threat prediction</p>
        </div>
        <Button variant="outline" size="sm" onClick={refreshData}>
          Refresh
        </Button>
      </motion.div>

      {/* Risk Distribution Cards */}
      <motion.div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" initial="hidden" animate="show" variants={stagger}>
        <motion.div variants={fadeUp}>
          <StatCard title="Total Users" value={metrics.totalUsers || 0} icon={UserIcon} accent="cyber" subtitle="Monitored accounts" />
        </motion.div>
        <motion.div variants={fadeUp}>
          <StatCard title="Active Anomalies" value={metrics.totalActiveEvents || 0} icon={ExclamationTriangleIcon} accent="danger" subtitle="Unresolved events" />
        </motion.div>
        <motion.div variants={fadeUp}>
          <StatCard title="Critical Events" value={metrics.totalCriticalEvents || 0} icon={ExclamationTriangleIcon} accent="danger" subtitle="Critical severity" />
        </motion.div>
        <motion.div variants={fadeUp}>
          <StatCard title="Avg Risk Score" value={metrics.averageRisk || 0} icon={ChartBarIcon} accent={metrics.overallRiskLevel === 'Critical' ? 'danger' : metrics.overallRiskLevel === 'High' ? 'warning' : 'success'} subtitle={metrics.overallRiskLevel || 'Low'} />
        </motion.div>
      </motion.div>

      <AnimatePresence>
        {!selectedUser ? (
          // ─── User Risk Ranking ───
          <motion.div key="ranking" initial="hidden" animate="show" variants={fadeUp}>
            <Card title="User Risk Ranking" description="Users ranked by risk score (highest first)" className="backdrop-blur-sm bg-white/50 dark:bg-surface-card/50 border border-slate-200 dark:border-slate-700">
              {riskRanking.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-slate-400 border-b border-slate-200 dark:border-slate-700">
                        <th className="py-3 px-4 font-medium">Rank</th>
                        <th className="py-3 px-4 font-medium">User</th>
                        <th className="py-3 px-4 font-medium">Role</th>
                        <th className="py-3 px-4 font-medium">Risk Score</th>
                        <th className="py-3 px-4 font-medium">Risk Level</th>
                        <th className="py-3 px-4 font-medium">Anomalies</th>
                        <th className="py-3 px-4 font-medium">Known Locations</th>
                        <th className="py-3 px-4 font-medium text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {riskRanking.map((u, i) => (
                        <tr key={u.userId?._id || i} className="border-b border-slate-200/50 dark:border-slate-800/50 hover:bg-slate-50/50 dark:hover:bg-slate-700/30 transition-colors">
                          <td className="py-3 px-4">
                            <span className={`inline-flex items-center justify-center h-6 w-6 rounded-full text-xs font-bold ${i === 0 ? 'bg-yellow-500/20 text-yellow-400' : i === 1 ? 'bg-slate-400/20 text-slate-400' : i === 2 ? 'bg-amber-700/20 text-amber-600' : 'bg-slate-500/10 text-slate-500'}`}>
                              #{i + 1}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <UserIcon className="h-5 w-5 text-slate-400" />
                              <div>
                                <p className="font-medium">{u.userName || 'Unknown'}</p>
                                <p className="text-xs text-slate-400">{u.userEmail}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4 capitalize">{u.userRole || '—'}</td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <span className="text-lg font-bold">{u.riskScore}</span>
                              <span className="text-xs text-slate-400">({u.averageRisk})</span>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <Badge tone={u.riskLevel === 'Critical' ? 'danger' : u.riskLevel === 'High' ? 'warning' : u.riskLevel === 'Medium' ? 'info' : 'success'}>{u.riskLevel}</Badge>
                          </td>
                          <td className="py-3 px-4">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${u.highRiskAnomalyCount > 0 ? 'bg-red-500/10 text-red-400' : 'bg-slate-500/10 text-slate-400'}`}>
                              {u.anomalyCount} total ({u.highRiskAnomalyCount} high)
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            {(u.knownLocations || []).map((loc) => (
                              <span key={loc} className="inline-flex items-center gap-1 text-xs text-slate-400 mr-2">
                                <MapPinIcon className="h-3 w-3" />
                                {loc.slice(0, 20)}
                              </span>
                            ))}
                            {(u.knownLocations || []).length === 0 && <span className="text-xs text-slate-500">—</span>}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <Button variant="outline" size="sm" onClick={() => handleViewUser(u)}>Investigate</Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <StateView type="empty" title="No user risk data" message="No user behavior profiles have been created yet." />
              )}
            </Card>
          </motion.div>
        ) : (
          // ─── User Investigation View ───
          <motion.div key="investigation" initial="hidden" animate="show" variants={fadeUp} className="space-y-6">
            <motion.div className="flex items-center justify-between flex-wrap gap-3" variants={fadeUp}>
              <div className="flex items-center gap-3">
                <button onClick={() => setSelectedUser(null)} className="text-slate-400 hover:text-slate-300">
                  ←
                </button>
                <h2 className="text-xl font-bold">{selectedUser.userName || selectedUser.profile?.userName || 'User'}</h2>
                <span className="text-sm text-slate-400">{selectedUser.userEmail || selectedUser.profile?.userEmail}</span>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => handleRunDetection(selectedUser.userId._id || selectedUser.userId)}>Run Detection</Button>
                <Button variant="outline" size="sm" onClick={() => setSelectedAnomaly(null)}>Close</Button>
              </div>
            </motion.div>

            {/* Risk Score Cards */}
            <motion.div variants={fadeUp}>
              {renderRiskScoreRow()}
            </motion.div>

            {/* Known Locations & Devices */}
            <motion.div className="grid grid-cols-1 lg:grid-cols-2 gap-4" variants={fadeUp}>
              <Card title="Known Locations" description="Trusted login locations" className="backdrop-blur-sm bg-white/50 dark:bg-surface-card/50 border border-slate-200 dark:border-slate-700">
                <div className="space-y-2">
                  {(selectedUser?.profile?.knownLocations || []).map((loc, i) => (
                    <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-slate-50/50 dark:bg-slate-800/30">
                      <MapPinIcon className="h-4 w-4 text-cyan-400" />
                      <span className="text-sm">{loc}</span>
                    </div>
                  ))}
                  {(selectedUser?.profile?.knownLocations || []).length === 0 && <p className="text-sm text-slate-400">No known locations recorded</p>}
                </div>
              </Card>
              <Card title="Known Devices" description="Trusted devices" className="backdrop-blur-sm bg-white/50 dark:bg-surface-card/50 border border-slate-200 dark:border-slate-700">
                <div className="space-y-2">
                  {(selectedUser?.profile?.knownDevices || []).map((dev, i) => (
                    <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-slate-50/50 dark:bg-slate-800/30">
                      <DeviceTabletIcon className="h-4 w-4 text-cyan-400" />
                      <span className="text-sm">{dev}</span>
                    </div>
                  ))}
                  {(selectedUser?.profile?.knownDevices || []).length === 0 && <p className="text-sm text-slate-400">No known devices recorded</p>}
                </div>
              </Card>
            </motion.div>

            {/* Baseline Info */}
            <motion.div variants={fadeUp}>
              <Card title="Behavioral Baseline" description="Normal activity patterns" className="backdrop-blur-sm bg-white/50 dark:bg-surface-card/50 border border-slate-200 dark:border-slate-700">
                {selectedUser?.profile?.baseline ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-3 rounded-lg bg-slate-50/50 dark:bg-slate-800/30">
                      <p className="text-xs text-slate-400">Login Hours</p>
                      <p className="font-medium">{selectedUser.profile.baseline.normalLoginHours?.start || 8}:00 – {selectedUser.profile.baseline.normalLoginHours?.end || 18}:00</p>
                    </div>
                    <div className="p-3 rounded-lg bg-slate-50/50 dark:bg-slate-800/30">
                      <p className="text-xs text-slate-400">Avg Activity Level</p>
                      <p className="font-medium">{selectedUser.profile.baseline.averageActivityLevel || 0} activities/day</p>
                    </div>
                    <div className="p-3 rounded-lg bg-slate-50/50 dark:bg-slate-800/30">
                      <p className="text-xs text-slate-400">Actions</p>
                      <p className="text-xs text-slate-400">
                        Scans: {selectedUser.profile.baseline.typicalSecurityActions?.scans || 0} ·
                        Investigations: {selectedUser.profile.baseline.typicalSecurityActions?.threatInvestigations || 0} ·
                        Reports: {selectedUser.profile.baseline.typicalSecurityActions?.reportGenerations || 0}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-slate-400">No baseline established yet</p>
                )}
              </Card>
            </motion.div>

            {/* Behavior Timeline + Anomalies Grid */}
            <motion.div className="grid grid-cols-1 xl:grid-cols-3 gap-4" variants={fadeUp}>
              {/* Behavior Timeline */}
              <div className="xl:col-span-2">
                <Card title="Behavior Timeline" description="Last 7 days of activity" className="backdrop-blur-sm bg-white/50 dark:bg-surface-card/50 border border-slate-200 dark:border-slate-700">
                  {(selectedUser?.timeline || []).length > 0 ? (
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {(selectedUser.timeline || []).map((item) => {
                        const Icon = categoryIcons[item.category] || ClockIcon;
                        return (
                          <div key={item.id} className="flex items-start gap-3 p-3 rounded-xl bg-slate-50/50 dark:bg-slate-800/30">
                            <div className="p-1.5 rounded-lg bg-slate-200/50 dark:bg-slate-700/50">
                              <Icon className="h-4 w-4 text-cyan-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-medium">{item.description}</p>
                                {item.riskScore > 0 && (
                                  <span className="text-xs px-1.5 py-0.5 rounded bg-red-500/10 text-red-400">risk {item.riskScore}</span>
                                )}
                                {item.anomalyMatched && (
                                  <Badge tone="danger" size="sm">{item.anomalyMatched}</Badge>
                                )}
                              </div>
                              <p className="text-xs text-slate-400">{item.category} · {rel(item.timestamp)}</p>
                              {item.details && Object.keys(item.details).length > 0 && (
                                <pre className="text-xs text-slate-500 mt-1 overflow-x-auto">
                                  {JSON.stringify(item.details).slice(0, 200)}
                                </pre>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <StateView type="empty" title="No activity" message="No behavioral activity recorded for this user." />
                  )}
                </Card>
              </div>

              {/* Anomaly Center */}
              <div>
                <Card title="Anomaly Center" description="Detected anomalies for this user" className="backdrop-blur-sm bg-white/50 dark:bg-surface-card/50 border border-slate-200 dark:border-slate-700">
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {(selectedUser?.anomalies || []).length > 0 ? (
                      (selectedUser.anomalies || []).map((a) => (
                        <div key={a.id} className={`p-3 rounded-xl border cursor-pointer transition-all ${severityColors[a.severity] || severityColors.Low} hover:scale-[1.02]`} onClick={() => handleViewAnomaly(a)}>
                          <div className="flex items-center justify-between mb-2">
                            <Badge tone={a.severity === 'Critical' ? 'danger' : a.severity === 'High' ? 'warning' : a.severity === 'Medium' ? 'info' : 'success'}>{a.severity}</Badge>
                            <span className="text-xs text-slate-400">{rel(a.createdAt)}</span>
                          </div>
                          <p className="text-sm font-medium">{a.title}</p>
                          <p className="text-xs text-slate-400 mt-1 line-clamp-2">{a.description}</p>
                          {a.aiExplanation?.explanation && (
                            <p className="text-xs text-slate-500 mt-2 italic line-clamp-3">"{a.aiExplanation.explanation.slice(0, 120)}…"</p>
                          )}
                          <div className="flex gap-2 mt-2">
                            <button onClick={(e) => { e.stopPropagation(); handleResolveAnomaly(a.id, 'resolved'); }} className="text-xs text-green-400 hover:text-green-300">Resolve</button>
                            <button onClick={(e) => { e.stopPropagation(); handleResolveAnomaly(a.id, 'dismissed'); }} className="text-xs text-slate-400 hover:text-slate-300">Dismiss</button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <StateView type="empty" title="No anomalies" message="No anomalies detected for this user." />
                    )}
                  </div>
                  {(selectedUser?.anomaliesTotal || 0) > (selectedUser?.anomalies?.length || 0) && (
                    <button onClick={loadMoreAnomalies} className="w-full text-xs text-cyan-400 hover:text-cyan-300 py-2">Load More</button>
                  )}
                </Card>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Anomaly Detail Modal */}
      {selectedAnomaly && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setSelectedAnomaly(null)}>
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-surface-card border border-slate-700 rounded-xl max-w-3xl w-full max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold">{selectedAnomaly.title}</h3>
                <Badge tone={selectedAnomaly.severity === 'Critical' ? 'danger' : selectedAnomaly.severity === 'High' ? 'warning' : selectedAnomaly.severity === 'Medium' ? 'info' : 'success'}>{selectedAnomaly.severity}</Badge>
              </div>

              <div className="space-y-4">
                <div>
                  <p className="text-xs text-slate-400 uppercase">Description</p>
                  <p className="text-sm text-slate-300 mt-1">{selectedAnomaly.description}</p>
                </div>

                <div>
                  <p className="text-xs text-slate-400 uppercase">Event Type</p>
                  <p className="font-mono text-sm mt-1">{selectedAnomaly.eventType}</p>
                </div>

                <div>
                  <p className="text-xs text-slate-400 uppercase">Risk Score</p>
                  <div className="flex items-center gap-3 mt-1">
                    <div className="flex-1 h-2 rounded-full bg-slate-700 overflow-hidden">
                      <div className="h-full rounded-full bg-red-500 transition-all" style={{ width: `${selectedAnomaly.riskScore}%` }} />
                    </div>
                    <span className="font-bold">{selectedAnomaly.riskScore}/100</span>
                  </div>
                </div>

                {selectedAnomaly.details && (
                  <div>
                    <p className="text-xs text-slate-400 uppercase mb-1">Detection Evidence</p>
                    <pre className="text-xs bg-slate-800/50 p-3 rounded-xl overflow-x-auto">{JSON.stringify(selectedAnomaly.details, null, 2)}</pre>
                  </div>
                )}

                {selectedAnomaly.aiExplanation && (
                  <div className="space-y-3 border-t border-slate-700 pt-4">
                    <p className="text-xs text-slate-400 uppercase">AI Explanation</p>
                    {selectedAnomaly.aiExplanation.explanation && (
                      <div><p className="text-xs text-slate-400">Why abnormal</p><p className="text-sm text-slate-300">{selectedAnomaly.aiExplanation.explanation}</p></div>
                    )}
                    {selectedAnomaly.aiExplanation.threatPossibility && (
                      <div><p className="text-xs text-slate-400">Threat Possibility</p><p className="text-sm text-slate-300">{selectedAnomaly.aiExplanation.threatPossibility}</p></div>
                    )}
                    {selectedAnomaly.aiExplanation.attackScenario && (
                      <div><p className="text-xs text-slate-400">Attack Scenario</p><p className="text-sm text-slate-300">{selectedAnomaly.aiExplanation.attackScenario}</p></div>
                    )}
                    {selectedAnomaly.aiExplanation.recommendedAction && (
                      <div><p className="text-xs text-slate-400">Recommended Action</p><p className="text-sm text-slate-300 whitespace-pre-line">{selectedAnomaly.aiExplanation.recommendedAction}</p></div>
                    )}
                    {selectedAnomaly.aiExplanation.provider && (
                      <p className="text-xs text-slate-500">AI Provider: {selectedAnomaly.aiExplanation.provider}</p>
                    )}
                  </div>
                )}
              </div>

              <div className="flex gap-3 mt-6 pt-4 border-t border-slate-700">
                <Button variant="cyber" size="sm" onClick={() => { handleResolveAnomaly(selectedAnomaly.id, 'resolved'); setSelectedAnomaly(null); }}>Resolve</Button>
                <Button variant="outline" size="sm" onClick={() => { handleResolveAnomaly(selectedAnomaly.id, 'investigating'); setSelectedAnomaly(null); }}>Mark Investigating</Button>
                <button onClick={() => setSelectedAnomaly(null)} className="text-sm text-slate-400 hover:text-slate-300">Close</button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}
