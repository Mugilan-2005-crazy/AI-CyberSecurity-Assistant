/**
 * components/ui/StatCard.jsx
 * Reusable animated statistic card used on the dashboard and
 * admin analytics. `icon` is any Heroicon component.
 */
import { motion } from 'framer-motion';

export default function StatCard({ title, value, icon: Icon, accent = 'primary', subtitle }) {
  const accents = {
    primary: 'text-primary bg-indigo-500/10',
    cyber: 'text-cyber-400 bg-cyber-500/10',
    danger: 'text-danger bg-red-500/10',
    warning: 'text-warning bg-amber-500/10',
  };
  return (
    <motion.div
      whileHover={{ y: -4 }}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="card flex items-center gap-4"
    >
      <div className={`p-3 rounded-xl ${accents[accent]}`}>
        {Icon && <Icon className="h-6 w-6" />}
      </div>
      <div>
        <p className="text-sm text-slate-500 dark:text-slate-400">{title}</p>
        <p className="text-2xl font-bold">{value}</p>
        {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
      </div>
    </motion.div>
  );
}
