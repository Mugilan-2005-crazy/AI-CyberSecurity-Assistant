/**
 * components/dashboard/ActivityTimeline.jsx
 * ------------------------------------------------------------
 * Vertical animated timeline of recent scans. Each item shows the
 * module icon, redacted target, verdict, and relative time.
 * Used on the dashboard in place of a plain table for a more
 * "live feed" enterprise feel.
 */
import { motion } from 'framer-motion';
import VerdictBadge from '../ui/VerdictBadge.jsx';

const ICON = { url: '🔗', password: '🔑', email: '✉️', file: '📄', qr: '🔳' };

const rel = (iso) => {
  const diff = (Date.now() - new Date(iso)) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
};

export default function ActivityTimeline({ rows = [] }) {
  if (!rows.length) return <p className="text-sm text-slate-400">No activity yet.</p>;
  return (
    <ol className="relative border-l border-slate-200 dark:border-slate-700 ml-3 space-y-4">
      {rows.slice(0, 8).map((r, i) => (
        <motion.li
          key={r._id}
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.04 }}
          className="ml-4"
        >
          <span className="absolute -left-[9px] mt-1 h-4 w-4 rounded-full bg-primary border-2 border-white dark:border-surface-card" />
          <div className="flex items-center justify-between">
            <p className="text-sm">
              <span aria-hidden="true">{ICON[r.type] || '•'}</span>{' '}
              <span className="uppercase text-xs text-slate-400">{r.type}</span>{' '}
              <span className="text-slate-500 truncate max-w-[180px] inline-block align-middle">{r.input || '—'}</span>
            </p>
            <VerdictBadge verdict={r.verdict} />
          </div>
          <p className="text-xs text-slate-400 mt-0.5">{rel(r.createdAt)} · risk {r.riskScore}</p>
        </motion.li>
      ))}
    </ol>
  );
}
