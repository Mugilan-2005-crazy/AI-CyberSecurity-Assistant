/**
 * components/executive/ComplianceCard.jsx
 * ------------------------------------------------------------
 * Compliance radar + missing controls + recommendations.
 */
import { memo } from 'react';
import ExecutiveCard from './ExecutiveCard.jsx';

export default memo(function ComplianceCard({ data = {}, loading, error, onRetry, live }) {
  if (loading || error) {
    return <ExecutiveCard title="Compliance" loading={loading} error={error} onRetry={onRetry} live={live} />;
  }

  const { frameworks = [], recommendations = [] } = data;

  return (
    <ExecutiveCard title="Compliance" description={`Overall: ${data.overallCompliance ?? 0}%`} live={live}>
      <div className="grid grid-cols-2 gap-3">
        {frameworks.map((fw) => (
          <div key={fw.id} className="p-3 rounded-xl bg-slate-50/50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-700">
            <p className="text-xs font-semibold text-slate-300">{fw.name}</p>
            <p className="text-lg font-bold text-cyber-400">{fw.score}%</p>
            <div className="mt-2 h-1.5 rounded-full bg-slate-700 overflow-hidden">
              <div className="h-full rounded-full bg-cyber-500 transition-all" style={{ width: `${fw.score}%` }} />
            </div>
          </div>
        ))}
      </div>
      {recommendations.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Recommendations</p>
          <ul className="list-disc pl-5 space-y-1 text-sm text-slate-300">
            {recommendations.map((r, i) => <li key={i}>{r}</li>)}
          </ul>
        </div>
      )}
    </ExecutiveCard>
  );
});