/**
 * components/executive/ReportPanel.jsx
 * ------------------------------------------------------------
 * Report generation + export panel.
 * Supports PDF, Excel (CSV-compatible), CSV, and Print.
 * Audit-logged by backend.
 */
import { memo, useState } from 'react';
import ExecutiveCard from './ExecutiveCard.jsx';
import Button from '../ui/Button.jsx';

export default memo(function ReportPanel({ onGenerate, loading }) {
  const [period, setPeriod] = useState('month');
  const [format, setFormat] = useState('pdf');

  const handleGenerate = () => onGenerate?.({ period, format });

  return (
    <ExecutiveCard title="Reports & Export" description="Generate and export executive reports" live>
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={period} onChange={(e) => setPeriod(e.target.value)}
          className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-surface-card px-3 py-2 text-sm"
          aria-label="Report period"
        >
          <option value="week">Weekly</option>
          <option value="month">Monthly</option>
          <option value="quarter">Quarterly</option>
        </select>
        <select
          value={format} onChange={(e) => setFormat(e.target.value)}
          className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-surface-card px-3 py-2 text-sm"
          aria-label="Export format"
        >
          <option value="pdf">PDF</option>
          <option value="excel">Excel</option>
          <option value="csv">CSV</option>
          <option value="print">Print</option>
        </select>
        <Button variant="cyber" size="sm" onClick={handleGenerate} loading={loading}>
          Generate
        </Button>
        <Button variant="outline" size="sm" onClick={() => onGenerate?.({ period, format: 'print' })}>
          Print
        </Button>
      </div>
    </ExecutiveCard>
  );
});