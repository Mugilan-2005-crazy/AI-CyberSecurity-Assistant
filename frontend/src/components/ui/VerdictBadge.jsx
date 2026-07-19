/**
 * components/ui/VerdictBadge.jsx
 * Color-coded pill for scan verdicts (safe/suspicious/malicious).
 */
const styles = {
  safe: 'bg-cyber-500/15 text-cyber-400',
  suspicious: 'bg-amber-500/15 text-warning',
  malicious: 'bg-red-500/15 text-danger',
  unknown: 'bg-slate-500/15 text-slate-400',
};

export default function VerdictBadge({ verdict }) {
  const v = (verdict || 'unknown').toLowerCase();
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${styles[v] || styles.unknown}`}>
      {v.toUpperCase()}
    </span>
  );
}
