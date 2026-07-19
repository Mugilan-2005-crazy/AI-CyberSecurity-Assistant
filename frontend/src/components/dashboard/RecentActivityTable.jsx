/**
 * components/dashboard/RecentActivityTable.jsx
 * ------------------------------------------------------------
 * Recent activity table for the dashboard. Shows module, target
 * (redacted), verdict badge, risk score, and timestamp. Row hover
 * and responsive horizontal scroll on small screens.
 */
import VerdictBadge from '../ui/VerdictBadge.jsx';

const MODULE_ICON = { url: '🔗', password: '🔑', email: '✉️', file: '📄', qr: '🔳' };

export default function RecentActivityTable({ rows = [] }) {
  if (!rows.length) return <p className="text-sm text-slate-400">No recent activity yet.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-slate-400 border-b border-slate-200 dark:border-slate-700">
            <th className="py-2 pr-4 font-medium">Module</th>
            <th className="py-2 pr-4 font-medium">Target</th>
            <th className="py-2 pr-4 font-medium">Verdict</th>
            <th className="py-2 pr-4 font-medium">Risk</th>
            <th className="py-2 font-medium">Time</th>
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 8).map((r) => (
            <tr key={r._id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">
              <td className="py-2 pr-4 whitespace-nowrap">{MODULE_ICON[r.type] || '•'} <span className="uppercase text-xs">{r.type}</span></td>
              <td className="py-2 pr-4 max-w-[200px] truncate text-slate-500">{r.input || '—'}</td>
              <td className="py-2 pr-4"><VerdictBadge verdict={r.verdict} /></td>
              <td className="py-2 pr-4 font-mono">{r.riskScore}</td>
              <td className="py-2 text-xs text-slate-400 whitespace-nowrap">{new Date(r.createdAt).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
