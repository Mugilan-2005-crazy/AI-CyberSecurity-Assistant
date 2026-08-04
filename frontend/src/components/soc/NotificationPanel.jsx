/**
 * components/soc/NotificationPanel.jsx
 * Displays recent alerts with filtering and acknowledge actions.
 */

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import AlertCard from './AlertCard.jsx';

const severityFilters = ['all', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'];
const statusFilters = ['all', 'unread', 'read', 'acknowledged', 'resolved'];

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

export default function NotificationPanel({ alerts = [], onAcknowledge, loading = false }) {
  const [severityFilter, setSeverityFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const filtered = useMemo(() => {
    return alerts.filter((alert) => {
      const severityMatch = severityFilter === 'all' || alert.severity === severityFilter;
      const statusMatch = statusFilter === 'all' || alert.status === statusFilter;
      return severityMatch && statusMatch;
    });
  }, [alerts, severityFilter, statusFilter]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <span className="text-xs text-slate-400 mr-1">Severity:</span>
          {severityFilters.map((s) => (
            <button
              key={s}
              onClick={() => setSeverityFilter(s)}
              className={`text-xs px-2 py-1 rounded-lg transition-colors ${severityFilter === s ? 'bg-cyber-500/20 text-cyber-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <span className="text-xs text-slate-400 mr-1">Status:</span>
          {statusFilters.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`text-xs px-2 py-1 rounded-lg transition-colors ${statusFilter === s ? 'bg-cyber-500/20 text-cyber-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="p-4 rounded-xl bg-slate-50/50 dark:bg-slate-800/30 animate-pulse">
              <div className="h-4 w-3/4 bg-slate-200 dark:bg-slate-700 rounded mb-2" />
              <div className="h-3 w-full bg-slate-200 dark:bg-slate-700 rounded" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-8 text-slate-400">
          <p className="text-sm">No alerts match the selected filters</p>
        </div>
      ) : (
        <motion.div className="space-y-3" variants={fadeUp} initial="hidden" animate="show">
          {filtered.map((alert) => (
            <motion.div key={alert.id} variants={fadeUp}>
              <AlertCard alert={alert} onAcknowledge={onAcknowledge} />
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
}
