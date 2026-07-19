/**
 * pages/ScanHistory.jsx
 * ------------------------------------------------------------
 * Scan History page (Phase 2 polish). Searchable, filterable,
 * paginated table with skeleton loading, empty/error states, and
 * a responsive layout. Reuses the dashboard aggregate's recent
 * activity (no new backend API).
 */
import { useEffect, useMemo, useState } from 'react';
import endpoints from '../services/endpoints.js';
import Card from '../components/ui/Card.jsx';
import VerdictBadge from '../components/ui/VerdictBadge.jsx';
import Skeleton from '../components/ui/Skeleton.jsx';
import StateView from '../components/ui/StateView.jsx';
import SearchInput from '../components/ui/SearchInput.jsx';

const MODULE_ICON = { url: '🔗', password: '🔑', email: '✉️', file: '📄', qr: '🔳' };
const PAGE = 10;

export default function ScanHistory() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');

  useEffect(() => {
    endpoints.getDashboard()
      .then((d) => setRows(d.recentActivity || []))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  // Memoized filtering: module filter + free-text search.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      const matchType = filter === 'all' || r.type === filter;
      const matchQuery = !q || (r.input || '').toLowerCase().includes(q) || r.type.includes(q);
      return matchType && matchQuery;
    });
  }, [rows, filter, query]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const view = filtered.slice((page - 1) * PAGE, page * PAGE);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Scan History</h1>
          <p className="text-sm text-slate-400">{filtered.length} scans</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <SearchInput value={query} onChange={(v) => { setQuery(v); setPage(1); }} placeholder="Search target…" ariaLabel="Search scan history" />
          <select className="input sm:max-w-[160px]" value={filter} onChange={(e) => { setFilter(e.target.value); setPage(1); }} aria-label="Filter by module">
            <option value="all">All modules</option>
            <option value="url">URL</option>
            <option value="password">Password</option>
            <option value="email">Email</option>
            <option value="file">File</option>
            <option value="qr">QR</option>
          </select>
        </div>
      </div>

      <Card>
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : error ? (
          <StateView type="error" title="Couldn't load history" message="Try again in a moment." />
        ) : !filtered.length ? (
          <StateView type="empty" title="No scans found" message={query || filter !== 'all' ? 'No scans match your filters.' : 'Run a scan to see it here.'} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-400 border-b border-slate-200 dark:border-slate-700">
                  <th className="py-2 pr-4">Module</th>
                  <th className="py-2 pr-4">Target</th>
                  <th className="py-2 pr-4">Verdict</th>
                  <th className="py-2 pr-4">Risk</th>
                  <th className="py-2">Time</th>
                </tr>
              </thead>
              <tbody>
                {view.map((r) => (
                  <tr key={r._id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="py-2 pr-4 whitespace-nowrap">{MODULE_ICON[r.type] || '•'} <span className="uppercase text-xs">{r.type}</span></td>
                    <td className="py-2 pr-4 max-w-[220px] truncate text-slate-500">{r.input || '—'}</td>
                    <td className="py-2 pr-4"><VerdictBadge verdict={r.verdict} /></td>
                    <td className="py-2 pr-4 font-mono">{r.riskScore}</td>
                    <td className="py-2 text-xs text-slate-400 whitespace-nowrap">{new Date(r.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && !error && pages > 1 && (
          <div className="flex items-center justify-between mt-4 text-sm">
            <span className="text-slate-400">Page {page} of {pages}</span>
            <div className="flex gap-2">
              <button className="btn" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Prev</button>
              <button className="btn" disabled={page === pages} onClick={() => setPage((p) => p + 1)}>Next</button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
