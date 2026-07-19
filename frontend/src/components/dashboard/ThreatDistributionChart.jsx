/**
 * components/dashboard/ThreatDistributionChart.jsx
 * ------------------------------------------------------------
 * "Threat Distribution" doughnut chart (Chart.js). Splits recent
 * scans into Safe / Suspicious / Malicious for a quick posture view.
 * Memoized to avoid re-renders when the parent re-renders.
 */
import { memo } from 'react';
import { Doughnut } from 'react-chartjs-2';
import { Chart, registerables } from 'chart.js';
Chart.register(...registerables);

function ThreatDistributionChart({ recent = [] }) {
  const count = (v) => recent.filter((s) => s.verdict === v).length;
  const data = {
    labels: ['Safe', 'Suspicious', 'Malicious'],
    datasets: [
      {
        data: [count('safe'), count('suspicious'), count('malicious')],
        backgroundColor: ['#10b981', '#f59e0b', '#ef4444'],
        borderWidth: 0,
      },
    ],
  };
  const options = { responsive: true, cutout: '68%', plugins: { legend: { position: 'bottom' } } };
  return <Doughnut data={data} options={options} />;
}

export default memo(ThreatDistributionChart);
