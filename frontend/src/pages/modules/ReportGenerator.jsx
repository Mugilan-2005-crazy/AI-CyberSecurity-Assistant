/**
 * pages/modules/ReportGenerator.jsx
 * Module 7 — Security Report Generator (Phase 2 polish).
 * Reuses POST /scan/report (PDF). Adds glass shell, skeleton,
 * success/error toasts, and a clear explanation. Uses the shared
 * endpoints helper so it matches the Reports page behavior.
 */
import { useState } from 'react';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';
import { DocumentTextIcon } from '@heroicons/react/24/outline';
import endpoints from '../../services/endpoints.js';
import ScanShell from '../../components/modules/ScanShell.jsx';
import Skeleton from '../../components/ui/Skeleton.jsx';
import StateView from '../../components/ui/StateView.jsx';

export default function ReportGenerator() {
  const { t } = useTranslation();
  const [range, setRange] = useState({ from: '', to: '' });
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    setLoading(true);
    try {
      await endpoints.downloadReport(range);
      toast.success(t('reports.reportGenerated'));
    } catch {
      toast.error(t('reports.reportFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScanShell title={t('modules.reportGenerator.title')} description={t('modules.reportGenerator.description')} icon={DocumentTextIcon}>
      <p className="text-sm text-slate-400">{t('modules.reportGenerator.description')}</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
        <div>
          <label htmlFor="from" className="text-sm">{t('common.search')}</label>
          <input id="from" type="date" className="input mt-1" value={range.from}
            onChange={(e) => setRange({ ...range, from: e.target.value })} />
        </div>
        <div>
          <label htmlFor="to" className="text-sm">{t('common.search')}</label>
          <input id="to" type="date" className="input mt-1" value={range.to}
            onChange={(e) => setRange({ ...range, to: e.target.value })} />
        </div>
      </div>

      <button className="btn-cyber w-full mt-4" onClick={generate} disabled={loading}>
        {loading ? t('dashboard.generating') : t('modules.reportGenerator.generateBtn')}
      </button>

      {loading && (
        <div className="mt-5 space-y-3" aria-busy="true">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>
      )}

      {!loading && (
        <StateView type="info" title={t('common.info')} message={t('modules.reportGenerator.tip')} />
      )}
    </ScanShell>
  );
}
