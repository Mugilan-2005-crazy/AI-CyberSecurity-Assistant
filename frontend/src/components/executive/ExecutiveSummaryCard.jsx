/**
 * components/executive/ExecutiveSummaryCard.jsx
 * ------------------------------------------------------------
 * Executive AI Narrative card: Executive Summary, Business Risks,
 * Top Priorities, Recommended Actions, Forecast, and AI provider badge.
 */
import { memo } from 'react';
import ExecutiveCard from './ExecutiveCard.jsx';

const Section = ({ title, children }) => (
  <div className="mb-3">
    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">{title}</p>
    <div className="text-sm text-slate-200 leading-relaxed">{children}</div>
  </div>
);

export default memo(function ExecutiveSummaryCard({ data = {}, loading, error, onRetry, live }) {
  if (loading || error) {
    return <ExecutiveCard title="Executive Summary" loading={loading} error={error} onRetry={onRetry} live={live} />;
  }

  const { executiveSummary, businessRisks = [], topPriorities = [], recommendedActions = [], forecast, ai, generatedAt } = data;

  return (
    <ExecutiveCard title="Executive Summary" description={generatedAt ? new Date(generatedAt).toLocaleString() : ''} live={live}>
      <Section title="Executive Summary">
        <p>{executiveSummary || 'No summary available.'}</p>
      </Section>
      <Section title="Business Risks">
        <ul className="list-disc pl-5 space-y-1">
          {businessRisks.map((r, i) => <li key={i}>{r}</li>)}
        </ul>
      </Section>
      <Section title="Top Priorities">
        <ul className="list-disc pl-5 space-y-1">
          {topPriorities.map((p, i) => <li key={i}>{p}</li>)}
        </ul>
      </Section>
      <Section title="Recommended Actions">
        <ul className="list-disc pl-5 space-y-1">
          {recommendedActions.map((a, i) => <li key={i}>{a}</li>)}
        </ul>
      </Section>
      <Section title="Forecast">
        <p>{forecast || '—'}</p>
      </Section>
      {ai?.provider && (
        <div className="mt-3 flex items-center gap-2">
          <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 font-medium">
            {ai.provider}
          </span>
          <span className="text-xs text-slate-400">AI</span>
        </div>
      )}
    </ExecutiveCard>
  );
});