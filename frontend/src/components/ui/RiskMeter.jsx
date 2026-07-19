/**
 * components/ui/RiskMeter.jsx
 * Circular risk-score gauge (0-100). Color shifts from green
 * to red as risk increases. Pure SVG, no dependencies.
 */
export default function RiskMeter({ score = 0, size = 120 }) {
  const stroke = 10;
  const radius = (size - stroke) / 2;
  const circ = 2 * Math.PI * radius;
  const offset = circ - (score / 100) * circ;
  const color = score >= 70 ? '#ef4444' : score >= 35 ? '#f59e0b' : '#10b981';

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} stroke="#334155" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
      </svg>
      <div className="absolute text-center">
        <p className="text-2xl font-bold" style={{ color }}>{score}</p>
        <p className="text-xs text-slate-400">Risk</p>
      </div>
    </div>
  );
}
