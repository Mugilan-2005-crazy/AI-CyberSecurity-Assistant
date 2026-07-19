/**
 * components/ui/Card.jsx
 * ------------------------------------------------------------
 * Reusable surface card used across the enterprise UI. Provides
 * a consistent rounded, elevated container with optional title,
 * description, and action slot. Honors dark mode via Tailwind
 * classes. Used by dashboard, settings, history, etc.
 */
import { motion } from 'framer-motion';

export default function Card({ title, description, action, children, className = '', delay = 0 }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay }}
      className={`bg-white dark:bg-surface-card border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm p-5 ${className}`}
    >
      {(title || action) && (
        <header className="flex items-start justify-between mb-4">
          <div>
            {title && <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{title}</h3>}
            {description && <p className="text-xs text-slate-400 mt-0.5">{description}</p>}
          </div>
          {action}
        </header>
      )}
      {children}
    </motion.section>
  );
}
