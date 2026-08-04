/**
 * components/layout/ConnectionIndicator.jsx
 * ------------------------------------------------------------
 * Professional connection status banner showing real-time
 * Socket.IO connection state: Connected / Reconnecting / Offline.
 */
import { motion, AnimatePresence } from 'framer-motion';
import { WifiIcon, SignalSlashIcon, ArrowPathIcon } from '@heroicons/react/24/outline';

const STATES = {
  connected: {
    icon: WifiIcon,
    color: 'bg-green-500',
    text: 'Connected',
    textColor: 'text-green-400',
  },
  reconnecting: {
    icon: ArrowPathIcon,
    color: 'bg-amber-500',
    text: 'Reconnecting...',
    textColor: 'text-amber-400',
  },
  offline: {
    icon: SignalSlashIcon,
    color: 'bg-red-500',
    text: 'Offline',
    textColor: 'text-red-400',
  },
  connecting: {
    icon: ArrowPathIcon,
    color: 'bg-slate-400',
    text: 'Connecting...',
    textColor: 'text-slate-400',
  },
};

export default function ConnectionIndicator({ connectionState, reconnectAttempt, onReconnect }) {
  const state = STATES[connectionState] || STATES.offline;

  if (connectionState === 'connected') {
    return (
      <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
        <div className={`h-2 w-2 rounded-full ${state.color} animate-pulse`} />
        <span className={`text-xs font-medium ${state.textColor}`}>
          {state.text}
        </span>
      </div>
    );
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="flex items-center gap-2 px-3 py-1 rounded-lg bg-danger/10 border border-danger/30"
      >
        <div className={`h-2 w-2 rounded-full ${state.color} ${connectionState === 'reconnecting' ? 'animate-pulse' : ''}`} />
        <span className={`text-xs font-medium ${state.textColor}`}>
          {state.text}
        </span>
        {connectionState === 'reconnecting' && reconnectAttempt > 0 && (
          <span className="text-xs text-slate-400">({reconnectAttempt})</span>
        )}
        {connectionState === 'offline' && (
          <button
            onClick={onReconnect}
            className="text-xs underline hover:text-red-300"
          >
            Retry
          </button>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
