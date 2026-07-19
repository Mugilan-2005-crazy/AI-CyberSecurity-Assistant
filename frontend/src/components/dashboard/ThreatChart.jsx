/**
 * components/dashboard/ThreatChart.jsx
 * ------------------------------------------------------------
 * "Weekly Threat Analysis" area/line chart (Chart.js). Shows the
 * threat score trend across the last 7 days. Data is derived
 * client-side from recent activity when the backend doesn't
 * supply a time series (graceful). Memoized to avoid re-renders.
 */
import { memo } from 'react';
import { Line } from 'react-chartjs-2';
import { Chart, registerables } from 'chart.js';
Chart.register(...registerables);

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// Build a 7-day series from recent scans (avg risk per day).
const buildSeries = (recent = []) => {
  const buckets = Array(7).fill(0).map(() => ({ sum: 0, n: 0 }));
  recent.forEach((s) => {
    const d = new Date(s.createdAt).getDay(); // 0=Sun..6=Sat
    const idx = (d + 6) % 7; // shift so Mon=0
    buckets[idx].sum += s.riskScore || 0;
    buckets[idx].n += 1;
  });
  return buckets.map((b) => (b.n ? Math.round(b.sum / b.n) : 0));
};

function ThreatChart({ recent = [] }) {
  const data = {
    labels: DAYS,
    datasets: [
      {
        label: 'Avg Threat Score',
        data: buildSeries(recent),
        borderColor: '#10b981',
        backgroundColor: 'rgba(16,185,129,0.15)',
        fill: true,
        tension: 0.4,
        pointRadius: 3,
      },
    ],
  };
  const options = {
    responsive: true,
    plugins: { legend: { display: false } },
    scales: {
      y: { min: 0, max: 100, grid: { color: 'rgba(148,163,184,0.1)' } },
      x: { grid: { display: false } },
    },
  };
  return <Line data={data} options={options} />;
}

export default memo(ThreatChart);
