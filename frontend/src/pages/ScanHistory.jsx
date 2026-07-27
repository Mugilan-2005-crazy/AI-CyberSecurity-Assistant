/**
 * pages/ScanHistory.jsx
 * ------------------------------------------------------------
 * Scan History page (Phase 2 polish). Searchable, filterable,
 * paginated table with skeleton loading, empty/error states, and
 * a responsive layout. Reuses the dashboard aggregate's recent
 * activity (no new backend API).
 */
import { useEffect, useMemo, useState } from 'react';
import { ChevronRightIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import endpoints from '../services/endpoints.js';
import Card from '../components/ui/Card.jsx';
import Modal from '../components/ui/Modal.jsx';
import VerdictBadge from '../components/ui/VerdictBadge.jsx';
import RiskMeter from '../components/ui/RiskMeter.jsx';
import RiskLevel from '../components/ui/RiskLevel.jsx';
import Skeleton from '../components/ui/Skeleton.jsx';
import StateView from '../components/ui/StateView.jsx';
import SearchInput from '../components/ui/SearchInput.jsx';

const MODULE_ICON = { url: '🔗', password: '🔑', email: '✉️', file: '📄', qr: '🔳' };
const MODULE_LABEL = { url: 'URL', password: 'Password', email: 'Email', file: 'File', qr: 'QR' };
const SUMMARY_FIELDS = ['input', 'host', 'scheme', 'domain', 'path', 'score', 'strength', 'entropy', 'verdict', 'valid', 'decoded'];
const PAGE = 8;

export default function ScanHistory() {
  const { t } = useTranslation();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(null);

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
          <h1 className="text-2xl font-bold">{t('history.title')}</h1>
          <p className="text-sm text-slate-400">{filtered.length} {t('common.scans')}</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <SearchInput value={query} onChange={(v) => { setQuery(v); setPage(1); }} placeholder={t('common.search')} ariaLabel={t('common.search')} />
          <select className="input sm:max-w-[160px]" value={filter} onChange={(e) => { setFilter(e.target.value); setPage(1); }} aria-label={t('history.filterByType')}>
            <option value="all">{t('history.allTypes')}</option>
            <option value="url">{t('history.url')}</option>
            <option value="password">{t('history.password')}</option>
            <option value="email">{t('history.email')}</option>
            <option value="file">{t('history.file')}</option>
            <option value="qr">{t('history.qr')}</option>
          </select>
        </div>
      </div>

      <Card>
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : error ? (
          <StateView type="error" title={t('errors.serverError')} message="Try again in a moment." />
        ) : !filtered.length ? (
          <StateView type="empty" title={t('history.noHistory')} message={query || filter !== 'all' ? 'No scans match your filters.' : 'Run a scan to see it here.'} />
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
                  <th className="py-2" aria-label="Details" />
                </tr>
              </thead>
              <tbody>
                {view.map((r) => (
                  <tr
                    key={r._id}
                    onClick={() => setSelected(r)}
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), setSelected(r))}
                    tabIndex={0}
                    role="button"
                    aria-label={`View details for ${MODULE_LABEL[r.type] || r.type} scan`}
                    className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                  >
                    <td className="py-2 pr-4 whitespace-nowrap">{MODULE_ICON[r.type] || '•'} <span className="uppercase text-xs">{r.type}</span></td>
                    <td className="py-2 pr-4 max-w-[220px] truncate text-slate-500">{r.input || '—'}</td>
                    <td className="py-2 pr-4"><VerdictBadge verdict={r.verdict} /></td>
                    <td className="py-2 pr-4 font-mono">{r.riskScore}</td>
                    <td className="py-2 text-xs text-slate-400 whitespace-nowrap">{new Date(r.createdAt).toLocaleString()}</td>
                    <td className="py-2 text-right"><ChevronRightIcon className="h-4 w-4 text-slate-400 inline" /></td>
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

      {/* Detailed result view for a single scan. */}
      <Modal open={!!selected} onClose={() => setSelected(null)} title="Scan Details">
        {selected && <ScanDetail scan={selected} />}
      </Modal>
    </div>
  );
}

// Renders the structured summary fields + any remaining detail keys.
function ScanDetail({ scan }) {
  const details = scan.details && typeof scan.details === 'object' ? scan.details : {};
  const summary = Object.entries(details).filter(([k]) => SUMMARY_FIELDS.includes(k));
  const extra = Object.entries(details).filter(([k]) => !SUMMARY_FIELDS.includes(k));

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row items-center gap-4">
        <RiskMeter score={scan.riskScore} />
        <div className="flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-lg">{MODULE_ICON[scan.type] || '•'}</span>
            <span className="font-semibold">{MODULE_LABEL[scan.type] || scan.type} scan</span>
            <VerdictBadge verdict={scan.verdict} />
          </div>
          <RiskLevel score={scan.riskScore} />
          <p className="text-xs text-slate-400">{new Date(scan.createdAt).toLocaleString()}</p>
        </div>
      </div>

      <div>
        <p className="text-xs uppercase tracking-wider text-slate-400 mb-1">Target</p>
        <p className="font-mono text-sm break-all bg-slate-100 dark:bg-slate-800 rounded-lg px-3 py-2">{scan.input || '—'}</p>
      </div>

      {summary.length > 0 && (
        <div className="grid grid-cols-2 gap-2 text-sm">
          {summary.map(([k, v]) => (
            <div key={k} className="bg-slate-100 dark:bg-slate-800 rounded-lg px-3 py-2">
              <p className="text-xs text-slate-400 capitalize">{k}</p>
              <p className="break-words">{String(v)}</p>
            </div>
          ))}
        </div>
      )}

      {extra.length > 0 && (
        <div>
          <p className="text-xs uppercase tracking-wider text-slate-400 mb-1">More</p>
          <div className="space-y-1 text-sm max-h-48 overflow-y-auto">
            {extra.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3 border-b border-slate-100 dark:border-slate-800 py-1">
                <span className="text-slate-400 capitalize">{k}</span>
                <span className="text-right break-words font-mono text-xs">{formatValue(v)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Compact, safe rendering of nested detail values (objects/arrays -> JSON).
function formatValue(v) {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}
