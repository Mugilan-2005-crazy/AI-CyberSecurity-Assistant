/**
 * components/dashboard/StatCard.jsx
 * ------------------------------------------------------------
 * Enterprise KPI tile for the dashboard. Shows an icon, label,
 * big value, delta trend, and a subtle accent bar. Reused for the
 * six required cards: Total Scans, Threat Score, Safe Files,
 * Phishing Emails, Malware Detected, QR Scans.
 */
import { motion } from 'framer-motion';

const ACCENTS = {
  primary: 'from-primary/20 to-primary/0 text-primary',
  cyber: 'from-cyber-500/20 to-cyber-500/0 text-cyber-400',
  danger: 'from-red-500/20 to-red-500/0 text-danger',
  warning: 'from-amber-500/20 to-amber-500/0 text-warning',
  info: 'from-sky-500/20 to-sky-500/0 text-sky-400',
};

export default function StatCard({ icon: Icon, label, value, sub, trend, accent = 'primary', delay = 0, children }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay }}
      className="relative overflow-hidden bg-white dark:bg-surface-card border border-slate-200 dark:border-slate-700 rounded-2xl p-5 shadow-sm"
    >
      <div className={`absolute inset-0 bg-gradient-to-br ${ACCENTS[accent]} opacity-60`} />
      <div className="relative flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
          {/* Prefer animated counter (children); fall back to static value. */}
          {children ?? <p className="text-3xl font-bold mt-1">{value}</p>}
          {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
        </div>
        {Icon && (
          <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800">
            <Icon className="h-6 w-6" />
          </div>
        )}
      </div>
      {trend != null && (
        <p className={`relative mt-3 text-xs font-medium ${trend >= 0 ? 'text-cyber-400' : 'text-danger'}`}>
          {trend >= 0 ? '▲' : '▼'} {Math.abs(trend)}% vs last week
        </p>
      )}
    </motion.div>
  );
}
