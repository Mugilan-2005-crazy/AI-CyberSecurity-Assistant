/**
 * pages/Reports.jsx
 * ------------------------------------------------------------
 * Reports page. Lets the user generate a downloadable PDF security
 * report (date-range optional) and lists previously generated
 * reports. Uses endpoints.downloadReport / listReports which call
 * existing backend routes (no backend changes).
 */
import { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import endpoints from '../services/endpoints.js';
import Card from '../components/ui/Card.jsx';
import Loader from '../components/ui/Loader.jsx';
import Badge from '../components/ui/Badge.jsx';

export default function Reports() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [range, setRange] = useState({ from: '', to: '' });

  const load = () => endpoints.listReports().then(setReports).catch(() => []).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const generate = async () => {
    setBusy(true);
    try {
      await endpoints.downloadReport(range);
      toast.success('Report downloaded');
      load();
    } catch {
      toast.error('Failed to generate report');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold">Reports</h1>

      <Card title="Generate Security Report" description="Aggregates all modules into a downloadable PDF.">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
          <div>
            <label className="text-sm">From</label>
            <input type="date" className="input mt-1" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} />
          </div>
          <div>
            <label className="text-sm">To</label>
            <input type="date" className="input mt-1" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} />
          </div>
          <button className="btn-cyber" onClick={generate} disabled={busy}>{busy ? 'Generating…' : 'Download PDF'}</button>
        </div>
      </Card>

      <Card title="Previous Reports">
        {loading ? <Loader /> : !reports.length ? (
          <p className="text-sm text-slate-400">No reports generated yet.</p>
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
