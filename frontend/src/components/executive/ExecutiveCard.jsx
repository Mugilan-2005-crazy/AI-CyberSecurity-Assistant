/**
 * components/executive/ExecutiveCard.jsx
 * ------------------------------------------------------------
 * Reusable glass card wrapper for executive widgets.
 * Supports: title, description, loading skeleton, empty state,
 * error state, live badge, and optional action buttons.
 */
import { memo } from 'react';

const STATES = {
  LOADING: 'loading',
  EMPTY: 'empty',
  ERROR: 'error',
};

export default memo(function ExecutiveCard({
  title,
  description,
  loading = false,
  empty,
  error,
  onRetry,
  live,
  className = '',
  children,
  actions,
}) {
  if (loading) {
    return (
      <div className={`rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-surface-card/50 p-4 ${className}`}>
        <div className="animate-pulse space-y-3">
          <div className="h-5 w-40 rounded bg-slate-200 dark:bg-slate-700" />
          <div className="h-4 w-64 rounded bg-slate-200 dark:bg-slate-700" />
          <div className="h-40 w-full rounded-xl bg-slate-200 dark:bg-slate-700" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`rounded-2xl border border-red-200 dark:border-red-900 bg-red-50/50 dark:bg-red-950/20 p-6 ${className}`}>
        <p className="text-sm text-red-600 dark:text-red-400 font-medium">Failed to load</p>
        <p className="text-xs text-slate-400 mt-1">{error}</p>
        {onRetry && (
          <button onClick={onRetry} className="btn-primary mt-3 text-xs">Retry</button>
        )}
      </div>
    );
  }

  return (
    <div className={`rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-surface-card/50 backdrop-blur-sm ${className}`}>
      {(title || description || live || actions) && (
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
          <div>
            {title && <h3 className="text-sm font-semibold text-slate-100">{title}</h3>}
            {description && <p className="text-xs text-slate-400 mt-0.5">{description}</p>}
          </div>
          <div className="flex items-center gap-2">
            {live && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-cyber-500/10 text-cyber-400 font-medium animate-pulse">
                Live
              </span>
            )}
            {actions}
          </div>
        </div>
      )}
      <div className="p-4">
        {empty ? (
          <div className="flex flex-col items-center justify-center py-8 text-slate-400">
            <p className="text-sm">{empty}</p>
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
});