/**
 * components/dashboard/NotificationsPanel.jsx
 * ------------------------------------------------------------
 * Slide-in notifications panel for the dashboard. Lists the user's
 * in-app notifications with type-based icons and an unread dot.
 */
import { motion, AnimatePresence } from 'framer-motion';

const ICONS = { danger: '⚠️', warning: '🔔', success: '✅', info: 'ℹ️' };

export default function NotificationsPanel({ items = [], onClose }) {
  return (
    <motion.aside
      initial={{ x: 320, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 320, opacity: 0 }}
      className="fixed right-0 top-0 z-50 h-full w-80 bg-white dark:bg-surface-card shadow-2xl border-l border-slate-200 dark:border-slate-700 p-4"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold">Notifications</h3>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-200" aria-label="Close">✕</button>
      </div>
      <div className="space-y-2 overflow-y-auto h-[calc(100%-3rem)]">
        {!items.length && <p className="text-sm text-slate-400">You're all caught up.</p>}
        {items.map((n) => (
          <div key={n._id} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60">
            <div className="flex items-start gap-2">
              <span>{ICONS[n.type] || 'ℹ️'}</span>
              <div className="flex-1">
                <p className="text-sm font-medium">{n.title}</p>
                <p className="text-xs text-slate-400">{n.message}</p>
              </div>
              {!n.read && <span className="h-2 w-2 rounded-full bg-primary mt-1.5" />}
            </div>
          </div>
        ))}
      </div>
    </motion.aside>
  );
}
