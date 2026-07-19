/**
 * pages/modules/ReportGenerator.jsx
 * Module 7 — Security Report Generator (Phase 2 polish).
 * Reuses POST /scan/report (PDF). Adds glass shell, skeleton,
 * success/error toasts, and a clear explanation. Uses the shared
 * endpoints helper so it matches the Reports page behavior.
 */
import { useState } from 'react';
import { toast } from 'react-toastify';
import { DocumentTextIcon } from '@heroicons/react/24/outline';
import endpoints from '../../services/endpoints.js';
import ScanShell from '../../components/modules/ScanShell.jsx';
import Skeleton from '../../components/ui/Skeleton.jsx';
import StateView from '../../components/ui/StateView.jsx';

export default function ReportGenerator() {
  const [range, setRange] = useState({ from: '', to: '' });
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    setLoading(true);
    try {
      await endpoints.downloadReport(range);
      toast.success('Report downloaded');
    } catch {
      toast.error('Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScanShell title="Security Report Generator" description="Compile all module activity into a downloadable PDF." icon={DocumentTextIcon}>
      <p className="text-sm text-slate-400">Generate a PDF summarizing your scan activity across every module.</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
        <div>
          <label htmlFor="from" className="text-sm">From</label>
          <input id="from" type="date" className="input mt-1" value={range.from}
            onChange={(e) => setRange({ ...range, from: e.target.value })} />
        </div>
        <div>
          <label htmlFor="to" className="text-sm">To</label>
          <input id="to" type="date" className="input mt-1" value={range.to}
            onChange={(e) => setRange({ ...range, to: e.target.value })} />
        </div>
      </div>

      <button className="btn-cyber w-full mt-4" onClick={generate} disabled={loading}>
        {loading ? 'Generating PDF...' : 'Generate & Download PDF'}
      </button>

      {loading && (
        <div className="mt-5 space-y-3" aria-busy="true">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>
      )}

      {!loading && (
        <StateView type="info" title="Tip" message="Reports aggregate your latest scans. Use date ranges to focus on a period." />
      )}
    </ScanShell>
  );
}
