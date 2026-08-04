/**
 * components/executive/MetricTile.jsx
 * ------------------------------------------------------------
 * KPI tile for the Executive dashboard: value, delta, icon, label.
 * Supports live badge and optional sparkline data.
 */
import { memo } from 'react';

export default memo(function MetricTile({ title, value, delta, icon: Icon, live, sparkline = [] }) {
  const deltaSign = delta > 0 ? '+' : '';
  const deltaColor = delta > 0 ? 'text-green-400' : delta < 0 ? 'text-red-400' : 'text-slate-400';

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-surface-card/50 p-4 relative">
      {live && (
        <span className="absolute top-3 right-3 text-xs px-2 py-0.5 rounded-full bg-cyber-500/10 text-cyber-400 font-medium animate-pulse">
          Live
        </span>
      )}
      <div className="flex items-center gap-3">
        {Icon && <Icon className="h-5 w-5 text-cyber-400" />}
        <p className="text-xs text-slate-400">{title}</p>
      </div>
      <p className="text-2xl font-bold mt-2">{value ?? '—'}</p>
      <div className="mt-2 flex items-center justify-between">
        <span className={`text-xs font-semibold ${deltaColor}`}>{delta !== undefined ? `${deltaSign}${delta}` : '—'}</span>
        {sparkline.length > 1 && (
          <svg viewBox="0 0 60 24" className="h-6 w-16 opacity-80">
            <polyline
              fill="none" stroke="#10b981" strokeWidth="2"
              points={sparkline.map((v, i) => `${(i / (sparkline.length - 1)) * 60},${24 - (v / Math.max(...sparkline, 1)) * 24}`).join(' ')}
            />
          </svg>
        )}
      </div>
    </div>
  );
});