/**
 * pages/admin/AdminAnalytics.jsx
 * Admin — Analytics dashboard with platform-wide metrics and
 * charts (users, scans, verdict distribution, module usage).
 */
import { useEffect, useState } from 'react';
import { Bar, Doughnut } from 'react-chartjs-2';
import { UsersIcon, ShieldCheckIcon } from '@heroicons/react/24/outline';
import api from '../../services/api.js';
import Loader from '../../components/ui/Loader.jsx';
import StatCard from '../../components/ui/StatCard.jsx';

export default function AdminAnalytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/admin/analytics').then((r) => setData(r.data)).finally(() => setLoading(false));
  }, []);

  if (loading || !data) return <Loader />;

  const verdicts = Object.fromEntries((data.verdicts || []).map((v) => [v._id, v.count]));
  const doughnut = {
    labels: ['Safe', 'Suspicious', 'Malicious'],
    datasets: [{ data: [verdicts.safe || 0, verdicts.suspicious || 0, verdicts.malicious || 0], backgroundColor: ['#10b981', '#f59e0b', '#ef4444'] }],
  };
  const bar = {
    labels: (data.scansByType || []).map((t) => t._id),
    datasets: [{ label: 'Scans', data: (data.scansByType || []).map((t) => t.count), backgroundColor: '#10b981' }],
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-2xl font-bold">Platform Analytics</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard title="Total Users" value={data.totalUsers} icon={UsersIcon} accent="primary" />
        <StatCard title="Total Scans" value={data.totalScans} icon={ShieldCheckIcon} accent="cyber" />
        <StatCard title="Threats" value={(verdicts.malicious || 0) + (verdicts.suspicious || 0)} icon={ShieldCheckIcon} accent="danger" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card"><p className="font-semibold mb-3">Verdict Distribution</p><Doughnut data={doughnut} /></div>
        <div className="card"><p className="font-semibold mb-3">Scans by Module</p><Bar data={bar} options={{ plugins: { legend: { display: false } } }} /></div>
      </div>
    </div>
  );
}
