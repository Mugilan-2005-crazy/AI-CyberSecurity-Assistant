import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import {
  ShieldCheckIcon, ExclamationTriangleIcon, ChartBarIcon,
  MapPinIcon, DeviceTabletIcon, CheckCircleIcon,
  BellIcon,
} from '@heroicons/react/24/outline';
import endpoints from '../services/endpoints.js';
import useUEBA from '../hooks/useUEBA.js';
import StatCard from '../components/ui/StatCard.jsx';
import Card from '../components/ui/Card.jsx';
import Skeleton from '../components/ui/Skeleton.jsx';
import StateView from '../components/ui/StateView.jsx';
import Badge from '../components/ui/Badge.jsx';
import Button from '../components/ui/Button.jsx';
import RiskLevel from '../components/ui/RiskLevel.jsx';

const fadeUp = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.4 } } };
const stagger = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } };

const rel = (iso) => {
  if (!iso) return '—';
  const diff = (Date.now() - new Date(iso)) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
};

export default function UserUEBAView() {
  const [profile, setProfile] = useState(null);
  const [anomalies, setAnomalies] = useState([]);
  const [timeline, setTimeline] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const { onAnomalyDetected } = useUEBA({
    onAnomalyDetected: useCallback((payload) => {
      toast.warn(`Security alert: ${payload.title}`, { autoClose: 8000 });
      fetchData();
    }, []),
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const [profileRes, anomaliesRes, timelineRes] = await Promise.all([
        endpoints.getMyProfile(),
        endpoints.getMyAnomalies(),
        endpoints.getMyTimeline({ days: 7 }),
      ]);
      setProfile(profileRes);
      setAnomalies(anomaliesRes.events || []);
      setTimeline(timelineRes);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleResolve = useCallback(async (id, status) => {
    try {
      await endpoints.resolveAnomaly(id, status);
      setAnomalies((prev) => prev.filter((a) => a.id !== id));
      toast.success(`Anomaly ${status}`);
    } catch {
      toast.error('Failed to resolve anomaly');
    }
  }, []);

  const criticalAnomalies = anomalies.filter((a) => a.severity === 'Critical' || a.severity === 'High');
  const activeAnomalies = anomalies.filter((a) => a.status === 'active');

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
        </div>
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  if (error || !profile) {
    return <StateView type="error" title="Couldn't load UEBA data" message="Check your connection and try again." />;
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl mx-auto">
      <motion.div initial="hidden" animate="show" variants={fadeUp}>
        <h1 className="text-2xl font-bold">Security Behavior Analytics</h1>
        <p className="text-sm text-slate-400">Your user behavior profile and recent security activity</p>
      </motion.div>

      <motion.div className="grid grid-cols-1 sm:grid-cols-4 gap-4" initial="hidden" animate="show" variants={stagger}>
        <motion.div variants={fadeUp}><StatCard title="Risk Score" value={`${profile.riskScore || 0}`} icon={ChartBarIcon} accent="danger" subtitle={profile.riskLevel || 'Low'} /></motion.div>
        <motion.div variants={fadeUp}><StatCard title="Anomalies" value={profile.anomalyCount || 0} icon={ExclamationTriangleIcon} accent={criticalAnomalies.length > 0 ? 'danger' : 'success'} subtitle={`${criticalAnomalies.length} high-risk`} /></motion.div>
        <motion.div variants={fadeUp}><StatCard title="Active Alerts" value={activeAnomalies.length} icon={BellIcon} accent={activeAnomalies.length > 0 ? 'warning' : 'success'} subtitle="Unresolved" /></motion.div>
        <motion.div variants={fadeUp}><StatCard title="Known Locations" value={profile.knownLocations?.length || 0} icon={MapPinIcon} accent="cyan" subtitle={profile.knownLocations?.[0] || '—'} /></motion.div>
      </motion.div>

      <motion.div className="grid grid-cols-1 lg:grid-cols-3 gap-4" initial="hidden" animate="show" variants={stagger}>
        <motion.div variants={fadeUp}>
          <Card title="Risk Level" description="Your current security posture" className="backdrop-blur-sm bg-white/50 dark:bg-surface-card/50 border border-slate-200 dark:border-slate-700">
            <div className="flex flex-col items-center py-6">
              <RiskLevel score={profile.riskScore || 0} size={120} />
              <p className="text-2xl font-bold mt-4">{profile.riskLevel || 'Low'}</p>
              <p className="text-sm text-slate-400 mt-2">{profile.anomalyCount || 0} anomalies detected in total</p>
            </div>
          </Card>
        </motion.div>

        <motion.div variants={fadeUp} className="lg:col-span-2">
          <Card title="Known Locations" description="Trusted login locations" className="backdrop-blur-sm bg-white/50 dark:bg-surface-card/50 border border-slate-200 dark:border-slate-700">
            <div className="space-y-2">
              {(profile.knownLocations || []).map((loc, i) => (
                <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-slate-50/50 dark:bg-slate-800/30">
                  <MapPinIcon className="h-4 w-4 text-cyan-400" />
                  <span className="text-sm">{loc}</span>
                </div>
              ))}
              {(profile.knownLocations || []).length === 0 && <p className="text-sm text-slate-400">No locations recorded</p>}
            </div>
          </Card>
        </motion.div>
      </motion.div>

      <motion.div variants={fadeUp}>
        <Card title="Known Devices" description="Devices regularly used for login" className="backdrop-blur-sm bg-white/50 dark:bg-surface-card/50 border border-slate-200 dark:border-slate-700">
          <div className="space-y-2">
            {(profile.knownDevices || []).map((dev, i) => (
              <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-slate-50/50 dark:bg-slate-800/30">
                <DeviceTabletIcon className="h-4 w-4 text-cyan-400" />
                <span className="text-sm">{dev}</span>
              </div>
            ))}
            {(profile.knownDevices || []).length === 0 && <p className="text-sm text-slate-400">No devices recorded</p>}
          </div>
        </Card>
      </motion.div>

      <motion.div variants={fadeUp}>
        <Card title="Recent Anomalies" description={anomalies.length ? `${anomalies.length} anomalies detected` : 'No anomalies'} className="backdrop-blur-sm bg-white/50 dark:bg-surface-card/50 border border-slate-200 dark:border-slate-700">
          {anomalies.length > 0 ? (
            <div className="space-y-3">
              {anomalies.slice(0, 10).map((a) => (
                <div key={a.id} className="p-3 rounded-xl bg-slate-50/50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-700">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Badge tone={a.severity === 'Critical' ? 'danger' : a.severity === 'High' ? 'warning' : a.severity === 'Medium' ? 'info' : 'success'}>{a.severity}</Badge>
                      <span className="font-medium text-sm">{a.title}</span>
                    </div>
                    <span className="text-xs text-slate-400">{rel(a.createdAt)}</span>
                  </div>
                  <p className="text-xs text-slate-400 mb-2">{a.description}</p>
                  {a.aiExplanation?.explanation && (
                    <p className="text-xs text-slate-500 italic">"{a.aiExplanation.explanation.slice(0, 150)}…"</p>
                  )}
                  <div className="flex gap-2 mt-2">
                    <button onClick={() => handleResolve(a.id, 'resolved')} className="text-xs text-green-400 hover:text-green-300">Resolve</button>
                    <button onClick={() => handleResolve(a.id, 'investigating')} className="text-xs text-slate-400 hover:text-slate-300">Investigate</button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-slate-400">
              <CheckCircleIcon className="h-10 w-10 text-green-400 mb-2" />
              <p className="text-sm">No anomalies detected. Your behavior is within normal baseline.</p>
            </div>
          )}
        </Card>
      </motion.div>

      <motion.div variants={fadeUp}>
        <Card title="Behavior Timeline" description="Recent activity (last 7 days)" className="backdrop-blur-sm bg-white/50 dark:bg-surface-card/50 border border-slate-200 dark:border-slate-700">
          {(timeline || []).length > 0 ? (
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {timeline.map((item) => (
                <div key={item.id} className="flex items-start gap-3 p-3 rounded-xl bg-slate-50/50 dark:bg-slate-800/30">
                  <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400">
                    <ShieldCheckIcon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{item.description}</p>
                    <p className="text-xs text-slate-400">{item.category} · {rel(item.timestamp)}</p>
                  </div>
                  {item.riskScore > 0 && <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/10 text-red-400">risk {item.riskScore}</span>}
                </div>
              ))}
            </div>
          ) : (
            <StateView type="empty" title="No activity" message="No behavioral activity recorded yet." />
          )}
        </Card>
      </motion.div>
    </div>
  );
}
