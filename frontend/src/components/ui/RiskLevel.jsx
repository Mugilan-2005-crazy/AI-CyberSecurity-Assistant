/**
 * components/ui/RiskLevel.jsx
 * ------------------------------------------------------------
 * Maps a threat score (0–100) to a qualitative risk level
 * (Safe / Low / Medium / High / Critical) with a colored chip.
 * Used across dashboard module summaries and scan results.
 */
const LEVELS = [
  { min: 80, label: 'Critical', tone: 'danger' },
  { min: 60, label: 'High', tone: 'danger' },
  { min: 35, label: 'Medium', tone: 'warning' },
  { min: 15, label: 'Low', tone: 'info' },
  { min: 0, label: 'Safe', tone: 'safe' },
];

const TONES = {
  safe: 'bg-cyber-500/15 text-cyber-400',
  info: 'bg-sky-500/15 text-sky-400',
  warning: 'bg-amber-500/15 text-warning',
  danger: 'bg-red-500/15 text-danger',
};

export default function RiskLevel({ score = 0, showScore = true }) {
  const level = LEVELS.find((l) => score >= l.min) || LEVELS[LEVELS.length - 1];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${TONES[level.tone]}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {level.label}{showScore && ` · ${score}`}
    </span>
  );
}
