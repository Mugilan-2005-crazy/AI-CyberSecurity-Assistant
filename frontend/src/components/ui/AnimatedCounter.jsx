/**
 * components/ui/AnimatedCounter.jsx
 * ------------------------------------------------------------
 * Counts up from 0 to `value` on mount using requestAnimationFrame
 * (no extra deps). Used for dashboard KPI numbers. Respects
 * reduced-motion by jumping straight to the final value.
 */
import { useEffect, useRef, useState } from 'react';

export default function AnimatedCounter({ value = 0, duration = 900, className = '' }) {
  const [display, setDisplay] = useState(0);
  const raf = useRef();

  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { setDisplay(value); return; }

    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      // easeOutCubic for a natural deceleration.
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(eased * value));
      if (t < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [value, duration]);

  return <span className={className}>{display}</span>;
}
