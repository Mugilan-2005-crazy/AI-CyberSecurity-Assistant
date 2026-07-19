/**
 * components/ui/SecurityGauge.jsx
 * ------------------------------------------------------------
 * Premium circular security-score gauge for the dashboard. An
 * animated arc fills to the score (0–100); the center shows the
 * number plus a qualitative label (Excellent→Critical). Color
 * shifts green→amber→red with risk. Pure SVG + framer-motion.
 */
import { motion } from 'framer-motion';

const band = (score) => {
  if (score >= 80) return { color: '#10b981', label: 'Excellent' };
  if (score >= 60) return { color: '#84cc16', label: 'Good' };
  if (score >= 40) return { color: '#f59e0b', label: 'Fair' };
  if (score >= 20) return { color: '#f97316', label: 'Poor' };
  return { color: '#ef4444', label: 'Critical' };
};

export default function SecurityGauge({ score = 0, size = 200 }) {
  const stroke = 14;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const { color, label } = band(score);

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }} role="img" aria-label={`Security score ${score} out of 100, ${label}`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(148,163,184,0.18)" strokeWidth={stroke} fill="none" />
        <motion.circle
          cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none"
          strokeLinecap="round" strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: circ - (score / 100) * circ }}
          transition={{ duration: 1, ease: 'easeOut' }}
          style={{ filter: `drop-shadow(0 0 6px ${color}66)` }}
        />
      </svg>
      <div className="absolute text-center">
        <p className="text-4xl font-bold" style={{ color }}>{score}</p>
        <p className="text-xs font-medium" style={{ color }}>{label}</p>
      </div>
    </div>
  );
}
