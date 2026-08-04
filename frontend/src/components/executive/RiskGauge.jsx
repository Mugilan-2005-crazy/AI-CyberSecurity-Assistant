/**
 * components/executive/RiskGauge.jsx
 * ------------------------------------------------------------
 * SVG arc gauge showing Organization Security Score 0–100
 * plus grade (A–F), trend delta, and live-update badge.
 */
import { useMemo } from 'react';

const GRADE_COLORS = {
  A: '#10b981',
  B: '#34d399',
  C: '#f59e0b',
  D: '#f97316',
  F: '#ef4444',
};

export default function RiskGauge({ score = 0, grade = 'F', delta = 0, live }) {
  const color = GRADE_COLORS[grade] || '#94a3b8';
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.max(0, Math.min(1, score / 100));
  const dash = pct * circumference;

  return (
    <div className="relative flex flex-col items-center justify-center p-4">
      <svg viewBox="0 0 140 140" className="h-44 w-44">
        <circle cx="70" cy="70" r={radius} fill="none" stroke="#1e293b" strokeWidth="10" />
        <circle
          cx="70" cy="70" r={radius} fill="none"
          stroke={color} strokeWidth="10"
          strokeDasharray={`${dash} ${circumference}`}
          strokeLinecap="round"
          transform="rotate(135 70 70)"
          className="transition-all duration-700 ease-out"
        />
        <text x="70" y="64" textAnchor="middle" className="fill-white text-2xl font-bold">
          {score}
        </text>
        <text x="70" y="84" textAnchor="middle" className={`fill-current text-sm font-bold`} style={{ color }}>
          Grade {grade}
        </text>
      </svg>
      <div className="mt-2 flex items-center gap-2">
        {delta !== 0 && (
          <span className={`text-xs font-semibold ${delta > 0 ? 'text-green-400' : 'text-red-400'}`}>
            {delta > 0 ? '+' : ''}{delta} pts
          </span>
        )}
        {live && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-cyber-500/10 text-cyber-400 font-medium animate-pulse">
            Live
          </span>
        )}
      </div>
    </div>
  );
}