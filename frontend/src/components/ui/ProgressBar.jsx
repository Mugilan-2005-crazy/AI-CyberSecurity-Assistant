/**
 * components/ui/ProgressBar.jsx
 * ------------------------------------------------------------
 * Animated horizontal progress bar. Used for risk scores and
 * completion meters. Color shifts with the `tone` and animates
 * width on mount via framer-motion.
 */
import { motion } from 'framer-motion';

const COLORS = {
  safe: 'bg-cyber-500',
  warning: 'bg-warning',
  danger: 'bg-danger',
  info: 'bg-primary',
};

export default function ProgressBar({ value = 0, tone = 'info', className = '' }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className={`w-full h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden ${className}`}>
      <motion.div
        className={`h-full rounded-full ${COLORS[tone] || COLORS.info}`}
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      />
    </div>
  );
}
