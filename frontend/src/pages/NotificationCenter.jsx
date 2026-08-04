/**
 * pages/NotificationCenter.jsx
 * ------------------------------------------------------------
 * Dedicated Notification Center page with:
 *   - Notification list with filter/sort
 *   - Mark read / mark all read / delete / delete all read
 *   - Real-time updates via Socket.IO
 *   - Connection status indicator
 *   - Unread count badge
 */
import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import {
  BellIcon, CheckIcon, XMarkIcon, FunnelIcon,
  MagnifyingGlassIcon, ClockIcon, ShieldCheckIcon,
  ExclamationTriangleIcon, InformationCircleIcon,
  ArrowLeftIcon,
} from '@heroicons/react/24/outline';
import Card from '../components/ui/Card.jsx';
import Button from '../components/ui/Button.jsx';
import ConnectionIndicator from '../components/layout/ConnectionIndicator.jsx';
import useNotifications from '../hooks/useNotifications.js';

const SEVERITY_COLORS = {
  low: 'bg-blue-500',
  medium: 'bg-amber-500',
  high: 'bg-orange-500',
  critical: 'bg-red-500',
};

const CATEGORY_ICONS = {
  scan: ShieldCheckIcon,
  ai: InformationCircleIcon,
  threat: ExclamationTriangleIcon,
  incident: BellIcon,
  system: ClockIcon,
  report: InformationCircleIcon,
};

const relTime = (iso) => {
  if (!iso) return '—';
  const diff = (Date.now() - new Date(iso)) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
};

export default function NotificationCenter() {
  const {
    notifications,
    unreadCount,
    loading,
    error,
    filters,
    markRead,
    markAllRead,
    deleteNotification,
    updateFilters,
    clearFilters,
    refetch,
    connectionState,
    reconnectAttempt,
  } = useNotifications({ autoConnectSocket: true, initialFetch: true });

  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');
  const [selectedIds, setSelectedIds] = useState(new Set());

  const filtered = notifications
    .filter((n) => {
      if (filters.category && n.category !== filters.category) return false;
      if (filters.severity && n.severity !== filters.severity) return false;
      if (filters.read !== null && filters.read !== undefined && n.read !== filters.read) return false;
      if (searchQuery && !n.title?.toLowerCase().includes(searchQuery.toLowerCase()) && !n.message?.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    })
    .sort((a, b) => {
      let aVal = a[sortBy];
      let bVal = b[sortBy];
      if (sortBy === 'createdAt' || sortBy === 'updatedAt') {
        aVal = new Date(aVal).getTime();
        bVal = new Date(bVal).getTime();
      }
      if (sortOrder === 'asc') return aVal - bVal;
      return bVal - aVal;
    });

  const handleSelect = useCallback((id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((n) => n.id)));
    }
  }, [filtered, selectedIds]);

  const handleMarkReadSelected = useCallback(async () => {
    if (selectedIds.size === 0) return;
    for (const id of selectedIds) {
      await markRead(id);
    }
    setSelectedIds(new Set());
    refetch();
  }, [selectedIds, markRead, refetch]);

  const handleDeleteSelected = useCallback(async () => {
    if (selectedIds.size === 0) return;
    for (const id of selectedIds) {
      await deleteNotification(id);
    }
    setSelectedIds(new Set());
    refetch();
  }, [selectedIds, deleteNotification, refetch]);

  useEffect(() => {
    if (error) {
      toast.error(error);
    }
  }, [error]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <ConnectionIndicator />

        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Notification Center</h1>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => window.history.back()}
          >
            <ArrowLeftIcon className="w-4 h-4 mr-2" />
            Back
          </Button>
        </div>

        <div className="flex items-center gap-4 mb-4">
          <div className="relative flex-1">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search notifications..."
              className="w-full pl-10 pr-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <select
            className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            value={`${filters.category || 'all'}-${filters.severity || 'all'}`}
            onChange={(e) => {
              const [category, severity] = e.target.value.split('-');
              updateFilters({
                category: category === 'all' ? null : category,
                severity: severity === 'all' ? null : severity,
              });
            }}
          >
            <option value="all-all">All Categories</option>
            <option value="scan-all">Scans</option>
            <option value="ai-all">AI Analysis</option>
            <option value="threat-all">Threat Intel</option>
            <option value="incident-all">Incidents</option>
          </select>

          <select
            className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            value={`${filters.read === null ? 'all' : filters.read ? 'read' : 'unread'}`}
            onChange={(e) => {
              const val = e.target.value;
              updateFilters({
                read: val === 'all' ? null : val === 'read',
              });
            }}
          >
            <option value="all">All Status</option>
            <option value="unread">Unread Only</option>
            <option value="read">Read Only</option>
          </select>

          <Button
            variant="outline"
            size="sm"
            onClick={clearFilters}
          >
            <FunnelIcon className="w-4 h-4 mr-1" />
            Clear
          </Button>
        </div>

        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500 dark:text-slate-400">
              {selectedIds.size} selected
            </span>
            {selectedIds.size > 0 && (
              <>
                <Button variant="ghost" size="sm" onClick={handleMarkReadSelected}>
                  Mark Read
                </Button>
                <Button variant="ghost" size="sm" onClick={handleDeleteSelected} className="text-red-500 hover:text-red-700">
                  Delete
                </Button>
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <Button variant="primary" size="sm" onClick={markAllRead}>
                <CheckIcon className="w-4 h-4 mr-1" />
                Mark All Read
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={refetch} disabled={loading}>
              Refresh
            </Button>
          </div>
        </div>

        <Card className="overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={filtered.length > 0 && selectedIds.size === filtered.length}
                onChange={handleSelectAll}
                className="rounded border-slate-300 dark:border-slate-600 text-cyan-500 focus:ring-cyan-500"
              />
              <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
                Select All
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
              <ClockIcon className="w-4 h-4" />
              {filtered.length} notifications
            </div>
          </div>

          <div className="divide-y divide-slate-200 dark:divide-slate-700">
            <AnimatePresence>
              {filtered.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="p-8 text-center text-slate-500 dark:text-slate-400"
                >
                  <BellIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No notifications found</p>
                </motion.div>
              ) : (
                filtered.map((n) => {
                  const Icon = CATEGORY_ICONS[n.category || 'system'] || BellIcon;
                  const severityColor = SEVERITY_COLORS[n.severity || 'low'] || 'bg-slate-500';

                  return (
                    <motion.div
                      key={n.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className={`p-4 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer ${
                        !n.read ? 'bg-cyan-50 dark:bg-cyan-900/20 border-l-2 border-cyan-500' : ''
                      }`}
                      onClick={() => handleSelect(n.id)}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(n.id)}
                            onChange={(e) => {
                              e.stopPropagation();
                              handleSelect(n.id);
                            }}
                            className="rounded border-slate-300 dark:border-slate-600 text-cyan-500 focus:ring-cyan-500"
                          />
                          <div className={`p-1.5 rounded-lg ${severityColor} bg-opacity-20`}>
                            <Icon className={`w-4 h-4 text-${n.severity === 'critical' ? 'red' : n.severity === 'high' ? 'orange' : n.severity === 'medium' ? 'amber' : 'blue'}-500`} />
                          </div>
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between">
                            <div>
                              <h3 className={`font-medium ${
                                !n.read ? 'text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-300'
                              }`}>
                                {n.title}
                              </h3>
                              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                                {n.message}
                              </p>
                              {n.metadata && (
                                <div className="mt-2 text-xs text-slate-400 dark:text-slate-500">
                                  {Object.entries(n.metadata).map(([k, v]) => (
                                    <span key={k} className="inline-block mr-3">
                                      {k}: {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>

                            <div className="flex items-center gap-2 ml-4">
                              {!n.read && (
                                <span className="w-2 h-2 bg-cyan-500 rounded-full" title="Unread" />
                              )}
                              <span className="text-xs text-slate-400 dark:text-slate-500 whitespace-nowrap">
                                {n.createdAt ? relTime(n.createdAt) : '—'}
                              </span>
                              {!n.read && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    markRead(n.id);
                                  }}
                                  title="Mark as read"
                                >
                                  <CheckIcon className="w-4 h-4" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteNotification(n.id);
                                }}
                                title="Delete"
                                className="text-red-500 hover:text-red-700"
                              >
                                <XMarkIcon className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </AnimatePresence>
          </div>
        </Card>
      </div>
    </div>
  );
}
