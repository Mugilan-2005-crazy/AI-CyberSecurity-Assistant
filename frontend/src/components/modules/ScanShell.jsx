/**
 * components/modules/ScanShell.jsx
 * ------------------------------------------------------------
 * Shared layout wrapper for the six scanner modules so they share
 * a consistent glass card, title, icon, and result/state slots.
 * Reduces duplication and enforces uniform spacing/animation.
 */
import { motion } from 'framer-motion';

export default function ScanShell({ title, description, icon: Icon, children, max = 'max-w-2xl' }) {
  return (
    <div className={`space-y-6 animate-fade-in ${max} mx-auto`}>
      <div className="flex items-center gap-3">
        {Icon && (
          <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
            <Icon className="h-6 w-6" />
          </div>
        )}
        <div>
          <h1 className="text-2xl font-bold">{title}</h1>
          {description && <p className="text-sm text-slate-400">{description}</p>}
        </div>
      </div>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass rounded-2xl shadow-lg p-5 border border-slate-200 dark:border-slate-700"
      >
        {children}
      </motion.div>
    </div>
  );
}
