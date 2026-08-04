/**
 * components/executive/CountryHeatMap.jsx
 * ------------------------------------------------------------
 * Lightweight SVG world heatmap for threat origin.
 * No external map library — pure SVG for Docker/build leanness.
 */
import { memo } from 'react';

const WORLD_PATHS = {
  US: 'M 180 120 L 220 120 L 220 150 L 180 150 Z', // placeholder simplified block representation
  CN: 'M 320 130 L 360 130 L 360 160 L 320 160 Z',
  RU: 'M 280 80 L 360 80 L 360 120 L 280 120 Z',
  DE: 'M 235 110 L 250 110 L 250 125 L 235 125 Z',
  BR: 'M 240 200 L 280 200 L 280 240 L 240 240 Z',
  IN: 'M 310 150 L 335 150 L 335 180 L 310 180 Z',
  GB: 'M 230 100 L 240 100 L 240 110 L 230 110 Z',
};

export default memo(function CountryHeatMap({ data = [] }) {
  const maxCount = Math.max(...data.map((d) => d.count), 1);
  const intensity = (count) => Math.round((count / maxCount) * 255);

  return (
    <div className="w-full overflow-hidden">
      <svg viewBox="0 0 500 300" className="w-full h-auto">
        {data.map((item, idx) => {
          const key = item.country || 'Unknown';
          const path = Object.entries(WORLD_PATHS).find(([k]) => k === key)?.[1];
          if (!path) return null;
          const r = intensity(item.count);
          const fill = `rgba(239, 68, 68, ${0.3 + (r / 255) * 0.7})`;
          return (
            <g key={key}>
              <path d={path} fill={fill} stroke="#1e293b" strokeWidth="1" />
              <text x={path.split(' ')[1] * 1} y={path.split(' ')[2] * 1 - 4} fill="#e2e8f0" fontSize="8" textAnchor="middle">
                {key}
              </text>
            </g>
          );
        })}
        {data.length === 0 && (
          <text x="250" y="150" textAnchor="middle" fill="#94a3b8" fontSize="12">No geo data available</text>
        )}
      </svg>
      <div className="mt-2 flex flex-wrap gap-2">
        {data.slice(0, 5).map((d) => (
          <span key={d.country} className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
            {d.country}: {d.count}
          </span>
        ))}
      </div>
    </div>
  );
});