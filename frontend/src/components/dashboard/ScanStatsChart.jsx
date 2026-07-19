/**
 * components/dashboard/ScanStatsChart.jsx
 * ------------------------------------------------------------
 * "Scan Statistics" bar chart (Chart.js). Shows scan counts per
 * module (url, password, email, file, qr) from typeBreakdown.
 * Memoized to avoid re-renders when parent re-renders.
 */
import { memo } from 'react';
import { Bar } from 'react-chartjs-2';
import { Chart, registerables } from 'chart.js';
Chart.register(...registerables);

const MODULES = ['url', 'password', 'email', 'file', 'qr'];
const LABELS = ['URL', 'Password', 'Email', 'File', 'QR'];

function ScanStatsChart({ breakdown = [] }) {
  const counts = MODULES.map((m) => breakdown.find((b) => b._id === m)?.count || 0);
  const data = {
    labels: LABELS,
    datasets: [{ label: 'Scans', data: counts, backgroundColor: '#6366f1', borderRadius: 6 }],
  };
  const options = {
    responsive: true,
    plugins: { legend: { display: false } },
    scales: { y: { beginAtZero: true, grid: { color: 'rgba(148,163,184,0.1)' } }, x: { grid: { display: false } } },
  };
  return <Bar data={data} options={options} />;
}

export default memo(ScanStatsChart);
