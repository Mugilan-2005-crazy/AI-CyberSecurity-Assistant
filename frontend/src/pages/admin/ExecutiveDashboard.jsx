/**
 * pages/admin/ExecutiveDashboard.jsx
 * ------------------------------------------------------------
 * PHASE 4 — Executive Security Command Center.
 * Reuses: ExecutiveCard, RiskGauge, MetricTile, ExecutiveSummaryCard,
 *         CountryHeatMap, ComplianceCard, ReportPanel,
 *         useRealtimeDashboard, endpoints.executive, Chart.js.
 *
 * Features:
 *  - Organization Security Score (dynamic, weighted formula)
 *  - Executive AI Summary (routeAI via backend)
 *  - Risk Trends (period tabs)
 *  - Threat Categories
 *  - Country Heat Map
 *  - Attack Trends
 *  - Executive KPIs
 *  - Compliance
 *  - Reports & Export (PDF/Excel/CSV/Print)
 *  - Live updates via Socket.IO
 */
import { useEffect, useState, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Line, Doughnut, Bar } from 'react-chartjs-2';
import { useRealtimeDashboard } from '../../hooks/useRealtimeDashboard.js';
import endpoints from '../../services/endpoints.js';
import RiskGauge from '../../components/executive/RiskGauge.jsx';
import ExecutiveCard from '../../components/executive/ExecutiveCard.jsx';
import MetricTile from '../../components/executive/MetricTile.jsx';
import ExecutiveSummaryCard from '../../components/executive/ExecutiveSummaryCard.jsx';
import CountryHeatMap from '../../components/executive/CountryHeatMap.jsx';
import ComplianceCard from '../../components/executive/ComplianceCard.jsx';
import ReportPanel from '../../components/executive/ReportPanel.jsx';
import Skeleton from '../../components/ui/Skeleton.jsx';
import StateView from '../../components/ui/StateView.jsx';

const fadeUp = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.4 } } };
const stagger = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } };

const escapeCsv = (v) => {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

const buildPdf = async (data) => {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF();
  const pageW = doc.internal.pageSize.getWidth();
  let y = 14;

  doc.setFontSize(18);
  doc.text('Executive Security Command Center', 14, y);
  y += 8;
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Generated: ${new Date(data.generatedAt).toLocaleString()}`, 14, y);
  doc.text(`Period: ${data.period}`, pageW - 14, y, { align: 'right' });
  y += 10;

  doc.setFontSize(13);
  doc.setTextColor(0);
  doc.text('Security Score', 14, y);
  y += 7;
  doc.setFontSize(12);
  doc.text(`${data.organizationScore}/100 (Grade ${data.grade})`, 14, y);
  y += 10;

  doc.setFontSize(13);
  doc.text('Executive Summary', 14, y);
  y += 7;
  doc.setFontSize(10);
  const summaryLines = doc.splitTextToSize(data.executiveSummary || '', pageW - 28);
  doc.text(summaryLines, 14, y);
  y += summaryLines.length * 5 + 6;

  doc.setFontSize(13);
  doc.text('Key Metrics', 14, y);
  y += 7;
  doc.setFontSize(10);
  const kpiEntries = Object.entries(data.kpis || {});
  kpiEntries.forEach(([key, value]) => {
    if (y > 280) { doc.addPage(); y = 14; }
    doc.text(`${key}: ${value}`, 14, y);
    y += 6;
  });
  y += 4;

  doc.setFontSize(13);
  doc.text('Risk Trends', 14, y);
  y += 7;
  doc.setFontSize(10);
  (data.riskTrends || []).forEach((t) => {
    if (y > 280) { doc.addPage(); y = 14; }
    doc.text(`${t.date}: scans=${t.totalScans}, threats=${t.threats}, avgRisk=${t.avgRiskScore}`, 14, y);
    y += 6;
  });
  y += 4;

  doc.setFontSize(13);
  doc.text('Compliance', 14, y);
  y += 7;
  doc.setFontSize(10);
  doc.text(`Overall Compliance: ${data.compliance?.overallCompliance ?? 0}%`, 14, y);
  y += 6;
  (data.compliance?.frameworks || []).forEach((fw) => {
    if (y > 280) { doc.addPage(); y = 14; }
    doc.text(`${fw.name}: ${fw.score}%`, 14, y);
    y += 6;
  });
  y += 4;

  doc.setFontSize(13);
  doc.text('Business Metrics', 14, y);
  y += 7;
  doc.setFontSize(10);
  const biz = data.businessMetrics || {};
  doc.text(`Risk Reduction: ${biz.riskReduction}%`, 14, y); y += 6;
  doc.text(`Threat Growth: ${biz.threatGrowth}%`, 14, y); y += 6;
  doc.text(`Incident Resolution: ${biz.incidentResolution}%`, 14, y); y += 6;
  doc.text(`SOC Efficiency: ${biz.socEfficiency}%`, 14, y); y += 6;
  doc.text(`Analyst Productivity: ${biz.analystProductivity}`, 14, y);

  doc.save(`executive-report-${data.period}-${Date.now()}.pdf`);
};

const buildExcel = async (data) => {
  const ExcelJS = await import('exceljs');
  const wb = new ExcelJS.default.Workbook();

  const summaryRows = [
    ['Executive Security Command Center'],
    [],
    ['Generated', new Date(data.generatedAt).toLocaleString()],
    ['Period', data.period],
    ['Security Score', `${data.organizationScore}/100`],
    ['Grade', data.grade],
    [],
    ['Executive Summary'],
    [data.executiveSummary],
    [],
    ['Business Risks'],
    ...(data.businessRisks || []).map((r) => [r]),
    [],
    ['Top Priorities'],
    ...(data.topPriorities || []).map((p) => [p]),
    [],
    ['Recommended Actions'],
    ...(data.recommendedActions || []).map((a) => [a]),
    [],
    ['Forecast'],
    [data.forecast],
  ];
  const summarySheet = wb.addWorksheet('Executive Summary');
  summaryRows.forEach((row) => summarySheet.addRow(row));

  const kpiRows = [
    ['Metric', 'Value'],
    ...Object.entries(data.kpis || {}).map(([k, v]) => [k, v]),
  ];
  const kpiSheet = wb.addWorksheet('KPIs');
  kpiRows.forEach((row) => kpiSheet.addRow(row));

  const threatRows = [
    ['Category', 'Count', 'Avg Risk Score'],
    ...(data.threatCategories || []).map((c) => [c.category, c.count, c.avgRiskScore]),
  ];
  const threatSheet = wb.addWorksheet('Threat Trends');
  threatRows.forEach((row) => threatSheet.addRow(row));

  const complianceRows = [
    ['Framework', 'Score', 'Controls'],
    ...(data.compliance?.frameworks || []).map((fw) => [
      fw.name,
      fw.score,
      (fw.controls || []).map((c) => `${c.id} ${c.name} (${c.score}%)`).join('; '),
    ]),
  ];
  const complianceSheet = wb.addWorksheet('Compliance');
  complianceRows.forEach((row) => complianceSheet.addRow(row));

  const riskRows = [
    ['Date', 'Total Scans', 'Threats', 'Avg Risk Score'],
    ...(data.riskTrends || []).map((t) => [t.date, t.totalScans, t.threats, t.avgRiskScore]),
  ];
  const riskSheet = wb.addWorksheet('Risk Data');
  riskRows.forEach((row) => riskSheet.addRow(row));

  await wb.xlsx.writeFile(`executive-report-${data.period}-${Date.now()}.xlsx`);
};

const buildCsv = (data) => {
  const lines = [];
  lines.push(['Section', 'Metric', 'Value'].map(escapeCsv).join(','));

  (data.kpis || {}).forEach((v, k) => lines.push(['KPI', escapeCsv(k), escapeCsv(v)].join(',')));
  (data.threatCategories || []).forEach((c) => lines.push(['Threat Category', escapeCsv(c.category), escapeCsv(c.count)].join(',')));
  (data.riskTrends || []).forEach((t) => lines.push(['Risk Trend', escapeCsv(t.date), `${t.totalScans},${t.threats},${t.avgRiskScore}`].join(',')));

  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, `executive-report-${data.period}-${Date.now()}.csv`);
};

export default function ExecutiveDashboard() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [aiNarrative, setAiNarrative] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [period, setPeriod] = useState('month');

  const fetchSummary = useCallback((p = period) => {
    setLoading(true);
    setError(false);
    endpoints.getExecutiveSummary({ period: p })
      .then((r) => setSummary(r))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [period]);

  useEffect(() => { fetchSummary(period); }, [fetchSummary, period]);

  useRealtimeDashboard({
    onScanCompleted: useCallback((payload) => {
      setSummary((prev) => {
        if (!prev) return prev;
        return { ...prev, kpis: { ...prev.kpis, threatsDetected: (prev.kpis.threatsDetected || 0) + 1 } };
      });
    }, []),
    onIncidentCreated: useCallback((payload) => {
      setSummary((prev) => {
        if (!prev) return prev;
        return { ...prev, kpis: { ...prev.kpis, openIncidents: (prev.kpis.openIncidents || 0) + 1 } };
      });
    }, []),
    onAICompleted: useCallback((payload) => {
      setSummary((prev) => {
        if (!prev) return prev;
        return { ...prev, kpis: { ...prev.kpis, aiAnalyses: (prev.kpis.aiAnalyses || 0) + 1 } };
      });
    }, []),
  });

  const handleAiSummary = useCallback(async () => {
    setAiLoading(true);
    try {
      const r = await endpoints.getExecutiveAiSummary({ period });
      setAiNarrative(r.data);
    } catch {
      setAiNarrative({ error: true });
    } finally {
      setAiLoading(false);
    }
  }, [period]);

  const handleReport = useCallback(async ({ period: p, format }) => {
    setReportLoading(true);
    try {
      const r = await endpoints.getExecutiveReport({ period: p, format });
      const data = r.data || r;
      setReportData(data);

      if (format === 'pdf') await buildPdf(data);
      else if (format === 'excel') await buildExcel(data);
      else if (format === 'csv') buildCsv(data);
      else if (format === 'print') setTimeout(() => window.print(), 300);
    } catch {
      setReportData({ error: true });
    } finally {
      setReportLoading(false);
    }
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
        </div>
        <Skeleton className="h-72 rounded-2xl" />
      </div>
    );
  }

  if (error || !summary) {
    return <StateView type="error" title="Couldn't load Executive Dashboard" message="Check your connection and try again." />;
  }

  const score = summary.securityScore;
  const kpis = summary.kpis;
  const trendData = useMemo(() => ({
    labels: summary.riskTrends.map((t) => t.date.slice(5)),
    datasets: [
      { label: 'Total Scans', data: summary.riskTrends.map((t) => t.totalScans), borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.1)', fill: true, tension: 0.4 },
      { label: 'Threats', data: summary.riskTrends.map((t) => t.threats), borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,0.1)', fill: true, tension: 0.4 },
    ],
  }), [summary.riskTrends]);

  const categoryData = useMemo(() => ({
    labels: summary.threatCategories.map((c) => c.category),
    datasets: [{ data: summary.threatCategories.map((c) => c.count), backgroundColor: ['#ef4444', '#f59e0b', '#6366f1', '#10b981', '#f97316', '#06b6d4'], borderWidth: 1 }],
  }), [summary.threatCategories]);

  const peakData = useMemo(() => ({
    labels: summary.attackTrends?.peakHours?.map((h) => `${h.hour}:00`) || [],
    datasets: [{ label: 'Attacks', data: summary.attackTrends?.peakHours?.map((h) => h.attacks) || [], backgroundColor: '#6366f1' }],
  }), [summary.attackTrends]);

  return (
    <div className="space-y-6 animate-fade-in">
      <motion.div initial="hidden" animate="show" variants={fadeUp} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Executive Security Command Center</h1>
          <p className="text-sm text-slate-400">Organization posture, KPIs, compliance, and AI narrative</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={period} onChange={(e) => setPeriod(e.target.value)} className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-surface-card px-3 py-2 text-sm" aria-label="Period">
            <option value="day">Daily</option>
            <option value="week">Weekly</option>
            <option value="month">Monthly</option>
            <option value="quarter">Quarterly</option>
          </select>
          <button onClick={handleAiSummary} disabled={aiLoading} className="btn-cyber text-sm">AI Summary</button>
        </div>
      </motion.div>

      {/* Score + Executive Summary */}
      <motion.div className="grid grid-cols-1 lg:grid-cols-3 gap-4" initial="hidden" animate="show" variants={stagger}>
        <motion.div variants={fadeUp}>
          <ExecutiveCard title="Organization Security Score" live>
            <RiskGauge score={score.score} grade={score.grade} delta={0} live />
          </ExecutiveCard>
        </motion.div>
        <motion.div variants={fadeUp} className="lg:col-span-2">
          <ExecutiveSummaryCard data={aiNarrative || {}} loading={aiLoading} error={aiNarrative?.error} onRetry={handleAiSummary} live />
        </motion.div>
      </motion.div>

      {/* KPIs */}
      <motion.div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" initial="hidden" animate="show" variants={stagger}>
        {[
          { title: 'Active Threats', value: kpis.threatsDetected },
          { title: 'Critical Incidents', value: kpis.criticalAlerts },
          { title: 'Open Incidents', value: kpis.openIncidents },
          { title: 'Scans Today', value: kpis.totalScans },
          { title: 'IOC Analyses', value: kpis.iocAnalyses },
          { title: 'AI Analyses', value: kpis.aiAnalyses },
          { title: 'Blocked Threats', value: kpis.blockedThreats },
          { title: 'Avg Response (hrs)', value: kpis.avgResponseHours },
        ].map((kpi) => (
          <motion.div key={kpi.title} variants={fadeUp}>
            <MetricTile {...kpi} live />
          </motion.div>
        ))}
      </motion.div>

      {/* Trends + Categories */}
      <motion.div className="grid grid-cols-1 lg:grid-cols-3 gap-4" initial="hidden" animate="show" variants={fadeUp}>
        <div className="lg:col-span-2">
          <ExecutiveCard title="Risk Trends" description="Scans and threats">
            <div className="h-64">
              <Line data={trendData} options={{ plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8' } } }, scales: { x: { ticks: { color: '#94a3b8' } }, y: { ticks: { color: '#94a3b8' } } } }} />
            </div>
          </ExecutiveCard>
        </div>
        <ExecutiveCard title="Threat Categories" description="Top detected categories">
          <div className="h-64">
            <Doughnut data={categoryData} options={{ cutout: '60%', plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8' } } } }} />
          </div>
        </ExecutiveCard>
      </motion.div>

      {/* Geo + Attack Trends */}
      <motion.div className="grid grid-cols-1 lg:grid-cols-2 gap-4" initial="hidden" animate="show" variants={fadeUp}>
        <ExecutiveCard title="Country Heat Map" description="Threat origin density">
          <CountryHeatMap data={summary.countryThreats} />
        </ExecutiveCard>
        <ExecutiveCard title="Attack Trends" description="Peak hours">
          <div className="h-64">
            <Bar data={peakData} options={{ plugins: { legend: { display: false } }, scales: { x: { ticks: { color: '#94a3b8' } }, y: { ticks: { color: '#94a3b8' } } } }} />
          </div>
        </ExecutiveCard>
      </motion.div>

      {/* Compliance + Business Metrics */}
      <motion.div className="grid grid-cols-1 lg:grid-cols-2 gap-4" initial="hidden" animate="show" variants={fadeUp}>
        <ComplianceCard data={summary.compliance} live />
        <ExecutiveCard title="Business Metrics" live>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Risk Reduction', value: `${summary.businessMetrics.riskReduction}%` },
              { label: 'Threat Growth', value: `${summary.businessMetrics.threatGrowth}%` },
              { label: 'Incident Resolution', value: `${summary.businessMetrics.incidentResolution}%` },
              { label: 'SOC Efficiency', value: `${summary.businessMetrics.socEfficiency}%` },
              { label: 'Analyst Productivity', value: summary.businessMetrics.analystProductivity },
            ].map((m) => (
              <div key={m.label} className="p-3 rounded-xl bg-slate-50/50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-700">
                <p className="text-xs text-slate-400">{m.label}</p>
                <p className="text-lg font-bold text-cyber-400">{m.value}</p>
              </div>
            ))}
          </div>
        </ExecutiveCard>
      </motion.div>

      {/* Reports */}
      <motion.div initial="hidden" animate="show" variants={fadeUp}>
        <ReportPanel onGenerate={handleReport} loading={reportLoading} />
        {reportData && !reportData.error && (
          <div className="mt-4 p-4 rounded-2xl border border-green-200 dark:border-green-900 bg-green-50/50 dark:bg-green-950/20">
            <p className="text-sm text-green-600 dark:text-green-400 font-medium">Report generated successfully</p>
            <p className="text-xs text-slate-400 mt-1">Format: {reportData.format} | Score: {reportData.organizationScore}/100 | Grade: {reportData.grade}</p>
          </div>
        )}
        {reportData?.error && (
          <div className="mt-4 p-4 rounded-2xl border border-red-200 dark:border-red-900 bg-red-50/50 dark:bg-red-950/20">
            <p className="text-sm text-red-600 dark:text-red-400 font-medium">Report generation failed</p>
          </div>
        )}
      </motion.div>
    </div>
  );
}