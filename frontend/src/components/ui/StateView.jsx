/**
 * components/ui/StateView.jsx
 * ------------------------------------------------------------
 * Unified presentation for Empty, Error, and Success states so
 * every page shares a consistent, accessible pattern. `role` and
 * `aria-live` ensure screen readers announce status changes.
 */
import { motion } from 'framer-motion';

const ICONS = {
  empty: '🗂️',
  error: '⚠️',
  success: '✅',
  info: 'ℹ️',
};

export default function StateView({ type = 'empty', title, message, action, children }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      role={type === 'error' ? 'alert' : 'status'}
      aria-live={type === 'error' ? 'assertive' : 'polite'}
      className="flex flex-col items-center justify-center text-center py-12 px-4"
    >
      <div className="text-4xl mb-3" aria-hidden="true">{ICONS[type] || ICONS.info}</div>
      {title && <h3 className="text-lg font-semibold">{title}</h3>}
      {message && <p className="text-sm text-slate-400 mt-1 max-w-sm">{message}</p>}
      {children}
      {action && <div className="mt-4">{action}</div>}
    </motion.div>
  );
}
