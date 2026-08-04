import { useEffect, useState, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Line, Doughnut, Bar, Gauge } from 'react-chartjs-2';
import { useObservability } from '../../../hooks/observability/useObservability.js';
import endpoints from '../../../services/endpoints.js';
import StatCard from '../../../components/ui/StatCard.jsx';
import Card from '../../../components/ui/Card.jsx';
import Skeleton from '../../../components/ui/Skeleton.jsx';
import StateView from '../../../components/ui/StateView.jsx';
import Badge from '../../../components/ui/Badge.jsx';

const fadeUp = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.4 } } };

export default function SystemOverview() {
  const { metrics, health, alerts, dashboardData, loading, error, acknowledgeAlert, resolveAlert } = useObservability();

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
    return <StateView type="error" title="Failed to load System Overview" message="Check your connection and try again." />;
  }

  const snapshot = metrics?.data || metrics;
  const cpuUsage = snapshot.cpu?.usage || 0;
  const memUsage = snapshot.memory ? Math.round(snapshot.memory.heapUsed / Math.max(1, snapshot.memory.heapTotal) * 100) : 0;
  const diskUsage = snapshot.disk?.usagePercent || 0;
  const uptime = snapshot.system?.uptime || 0;
  const activeAlerts = alerts?.data?.length || alerts?.count || 0;
  const healthStatus = health?.data?.status || 'unknown';

  return (
    <div className="space-y-6 animate-fade-in">
      <motion.h1 initial="hidden" animate="show" variants={fadeUp} className="text-2xl font-bold">System Overview</motion.h1>

      <motion.div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" initial="hidden" animate="show" variants={{ hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } }}>
        <StatCard title="CPU Usage" value={`${cpuUsage}%`} status={cpuUsage > 90 ? 'critical' : cpuUsage > 70 ? 'warning' : 'healthy'} />
        <StatCard title="Memory Usage" value={`${memUsage}%`} status={memUsage > 90 ? 'critical' : memUsage > 75 ? 'warning' : 'healthy'} />
        <StatCard title="Disk Usage" value={`${diskUsage}%`} status={diskUsage > 90 ? 'critical' : diskUsage > 70 ? 'warning' : 'healthy'} />
        <StatCard title="Uptime" value={`${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m`} status="healthy" />
      </motion.div>

      <motion.div className="grid grid-cols-1 lg:grid-cols-2 gap-4" initial="hidden" animate="show" variants={fadeUp}>
        <Card title="Health Status">
          <div className="flex items-center gap-3">
            <Badge variant={healthStatus === 'healthy' ? 'success' : healthStatus === 'critical' ? 'danger' : 'warning'}>{healthStatus.toUpperCase()}</Badge>
            <span className="text-sm text-slate-400">{health?.data?.checks?.length || 0} checks</span>
          </div>
        </Card>
        <Card title="Active Alerts">
          <div className="flex items-center gap-3">
            <Badge variant={activeAlerts > 0 ? 'warning' : 'success'}>{activeAlerts} active</Badge>
            <span className="text-sm text-slate-400">{alerts?.data?.length || 0} total</span>
          </div>
        </Card>
      </motion.div>

      <motion.div className="grid grid-cols-1 lg:grid-cols-2 gap-4" initial="hidden" animate="show" variants={fadeUp}>
        <Card title="CPU Usage Trend">
          <div className="h-48"><Line data={{ labels: ['Now'], datasets: [{ label: 'CPU %', data: [cpuUsage], borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.1)', fill: true }] }} options={{ plugins: { legend: { display: false } }, scales: { y: { ticks: { color: '#94a3b8' }, min: 0, max: 100 } } }} /></div>
        </Card>
        <Card title="Memory Usage Trend">
          <div className="h-48"><Line data={{ labels: ['Now'], datasets: [{ label: 'Memory %', data: [memUsage], borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.1)', fill: true }] }} options={{ plugins: { legend: { display: false } }, scales: { y: { ticks: { color: '#94a3b8' }, min: 0, max: 100 } } }} /></div>
        </Card>
      </motion.div>

      <motion.div initial="hidden" animate="show" variants={fadeUp}>
        <Card title="Active Alerts">
          <div className="space-y-2">
            {(alerts?.data || []).slice(0, 10).map((alert) => (
              <div key={alert.id || alert._id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50/50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-700">
                <div>
                  <p className="text-sm font-medium">{alert.name}</p>
                  <p className="text-xs text-slate-400">{alert.message}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={alert.severity === 'CRITICAL' ? 'danger' : alert.severity === 'WARNING' ? 'warning' : 'info'}>{alert.severity}</Badge>
                  <button onClick={() => acknowledgeAlert(alert.id)} className="text-xs btn-cyber px-2 py-1">Ack</button>
                  <button onClick={() => resolveAlert(alert.id)} className="text-xs btn-cyber px-2 py-1">Resolve</button>
                </div>
              </div>
            ))}
            {(!alerts?.data || alerts.data.length === 0) && <p className="text-sm text-slate-400 text-center py-4">No active alerts</p>}
          </div>
        </Card>
      </motion.div>
    </div>
  );
}