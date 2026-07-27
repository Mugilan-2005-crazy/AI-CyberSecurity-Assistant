/**
 * pages/Reports.jsx
 * ------------------------------------------------------------
 * Security Reports page. Lets the user export their scan history
 * as a PDF (backend-aggregated) and as a CSV (built client-side
 * from the existing dashboard aggregate). Uses only existing
 * backend APIs (endpoints.downloadReport + endpoints.getDashboard)
 * — no new endpoints.
 *
 * Both exports include: Scan Type, Target, Result, Risk Level,
 * Date & Time. Buttons disable while a report is generating and
 * surface success/error toasts. Empty history is handled gracefully.
 */
import { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';
import { DocumentArrowDownIcon, TableCellsIcon } from '@heroicons/react/24/outline';
import endpoints from '../services/endpoints.js';
import Card from '../components/ui/Card.jsx';
import Loader from '../components/ui/Loader.jsx';
import Badge from '../components/ui/Badge.jsx';

const CSV_COLUMNS = ['Scan Type', 'Target', 'Result', 'Risk Level', 'Date & Time'];

const csvField = (v) => {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const toCsv = (rows = []) => {
  const lines = [CSV_COLUMNS.join(',')];
  for (const r of rows) {
    lines.push(
      [r.type, r.input || '—', r.verdict, r.riskScore, new Date(r.createdAt).toLocaleString()]
        .map(csvField)
        .join(',')
    );
  }
  return lines.join('\n');
};

const downloadCsv = (csv, filename) => {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

export default function Reports() {
  const { t } = useTranslation();
  const [reports, setReports] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [busyKind, setBusyKind] = useState(null);
  const [range, setRange] = useState({ from: '', to: '' });

  // Load previous reports AND the recent scan history (for CSV + empty handling).
  const load = () => {
    setLoading(true);
    return Promise.all([
      endpoints.listReports().catch(() => []),
      endpoints.getDashboard().then((d) => d.recentActivity || []).catch(() => []),
    ])
      .then(([rs, recent]) => {
        setReports(rs);
        setHistory(recent);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const generatePdf = async () => {
    setBusy(true);
    setBusyKind('pdf');
    try {
      await endpoints.downloadReport(range);
      toast.success(t('reports.reportGenerated'));
      load();
    } catch {
      toast.error(t('reports.reportFailed'));
    } finally {
      setBusy(false);
      setBusyKind(null);
    }
  };

  const exportCsv = () => {
    if (!history.length) {
      toast.info(t('reports.noReports'));
      return;
    }
    setBusy(true);
    setBusyKind('csv');
    try {
      const csv = toCsv(history);
      downloadCsv(csv, `scan-history-${new Date().toISOString().slice(0, 10)}.csv`);
      toast.success('CSV exported');
    } catch {
      toast.error('Failed to export CSV');
    } finally {
      setBusy(false);
      setBusyKind(null);
    }
  };

  const hasHistory = history.length > 0;

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold">{t('reports.title')}</h1>

      <Card title={t('reports.generateReport')} description={t('reports.generateReport')}>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
          <div>
            <label className="text-sm">{t('common.search')}</label>
            <input type="date" className="input mt-1" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} />
          </div>
          <div>
            <label className="text-sm">{t('common.search')}</label>
            <input type="date" className="input mt-1" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} />
          </div>
          <div className="flex gap-2">
            <button className="btn-cyber flex-1 flex items-center justify-center gap-1.5" onClick={generatePdf} disabled={busy}>
              {busyKind === 'pdf' ? <Loader label="" /> : <DocumentArrowDownIcon className="h-4 w-4" />}
              <span>{busyKind === 'pdf' ? t('dashboard.generating') : t('reports.downloadPdf')}</span>
            </button>
          </div>
        </div>

        <div className="mt-4">
          <button className="btn flex items-center justify-center gap-1.5 w-full sm:w-auto" onClick={exportCsv} disabled={busy || !hasHistory}>
            {busyKind === 'csv' ? <Loader label="" /> : <TableCellsIcon className="h-4 w-4" />}
            <span>{busyKind === 'csv' ? t('common.loading') : 'Export CSV'}</span>
          </button>
          {!hasHistory && !loading && (
            <p className="text-xs text-slate-400 mt-2">No scans recorded yet — run a scan to enable CSV export.</p>
          )}
        </div>
      </Card>

      <Card title={t('reports.title')}>
        {loading ? <Loader /> : !reports.length ? (
          <p className="text-sm text-slate-400">{t('reports.noReports')}</p>
        ) : (
          <div className="space-y-2">
            {reports.map((r) => (
              <div key={r._id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                <div>
                  <p className="text-sm font-medium">{r.title}</p>
                  <p className="text-xs text-slate-400">
                    {r.summary?.totalScans ?? 0} scans · {r.summary?.threatsDetected ?? 0} threats · {new Date(r.createdAt).toLocaleString()}
                  </p>
                </div>
                <Badge tone="info">Saved</Badge>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
