/**
 * components/soc/AlertCard.jsx
 * Displays a single security alert with severity badge and timestamp.
 */

const severityColors = {
  CRITICAL: 'bg-red-500/10 text-red-400 border-red-500/20',
  HIGH: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  MEDIUM: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  LOW: 'bg-green-500/10 text-green-400 border-green-500/20',
  INFO: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
};

const statusColors = {
  unread: 'bg-slate-500/10 text-slate-400',
  read: 'bg-blue-500/10 text-blue-400',
  acknowledged: 'bg-amber-500/10 text-amber-400',
  resolved: 'bg-green-500/10 text-green-400',
};

export default function AlertCard({ alert, onAcknowledge }) {
  const rel = (iso) => {
    if (!iso) return '—';
    const diff = (Date.now() - new Date(iso)) / 1000;
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  return (
    <div className="p-4 rounded-xl bg-slate-50/50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-700 hover:bg-slate-100/50 dark:hover:bg-slate-700/30 transition-colors">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${severityColors[alert.severity] || severityColors.INFO}`}>
              {alert.severity}
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full font-medium border border-dotted border-slate-400 text-slate-400">
              {alert.alertType?.replace(/_/g, ' ') || 'alert'}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[alert.status] || statusColors.unread}`}>
              {alert.status}
            </span>
          </div>
          <h4 className="text-sm font-semibold truncate">{alert.title}</h4>
        </div>
        <span className="text-xs text-slate-400 whitespace-nowrap">{rel(alert.createdAt)}</span>
      </div>
      <p className="text-sm text-slate-400 line-clamp-2 mb-3">{alert.message}</p>
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-500">Source: {alert.source || 'system'}</span>
        {alert.status === 'unread' && onAcknowledge && (
          <button
            onClick={() => onAcknowledge(alert.id)}
            className="text-xs px-3 py-1.5 rounded-lg bg-cyber-500/10 text-cyber-400 hover:bg-cyber-500/20 transition-colors"
          >
            Acknowledge
          </button>
        )}
      </div>
    </div>
  );
}
