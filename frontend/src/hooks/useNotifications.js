/**
 * hooks/useNotifications.js
 * ------------------------------------------------------------
 * Manages the notification center state: fetching, marking read,
 * deleting, filtering, and real-time updates via Socket.IO.
 * Provides an unread count badge and auto-refreshes on events.
 */
import { useEffect, useState, useCallback, useRef } from 'react';
import api from '../services/api.js';
import { useSocket } from './useSocket.js';
import { toast } from 'react-toastify';

const EVENTS = {
  NOTIFICATION_CREATED: 'notification.created',
  NOTIFICATION_UNREAD_COUNT: 'notification.unread_count',
  NOTIFICATION_READ: 'notification.read',
  NOTIFICATION_DELETED: 'notification.deleted',
};

export const useNotifications = (opts = {}) => {
  const { autoConnectSocket = true, initialFetch = true } = opts;
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(initialFetch);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({ category: null, severity: null, read: null });

  const socket = useSocket(autoConnectSocket);
  const listenersRef = useRef(new Map());
  const fetchedRef = useRef(false);

  const fetchNotifications = useCallback(async () => {
    if (fetchedRef.current && !initialFetch) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filters.category) params.set('category', filters.category);
      if (filters.severity) params.set('severity', filters.severity);
      if (filters.read !== null) params.set('read', filters.read);
      params.set('limit', 50);

      const res = await api.get(`/notifications?${params.toString()}`);
      setNotifications(res.notifications || []);
      setUnreadCount(res.unreadCount || 0);
      fetchedRef.current = true;
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, [filters, initialFetch]);

  const markRead = useCallback(async (id) => {
    try {
      await api.post(`/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      toast.error('Failed to mark notification as read');
    }
  }, []);

  const markAllRead = useCallback(async () => {
    try {
      await api.post('/notifications/mark-all-read');
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, read: true }))
      );
      setUnreadCount(0);
    } catch (err) {
      toast.error('Failed to mark all notifications as read');
    }
  }, []);

  const deleteNotification = useCallback(async (id) => {
    try {
      await api.delete(`/notifications/${id}`);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      setUnreadCount((prevCount) => {
        const deleted = notifications.find((n) => n.id === id);
        return deleted && !deleted.read ? Math.max(0, prevCount - 1) : prevCount;
      });
    } catch (err) {
      toast.error('Failed to delete notification');
    }
  }, [notifications]);

  const updateFilters = useCallback((newFilters) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({ category: null, severity: null, read: null });
  }, []);

  useEffect(() => {
    if (socket.connected && !fetchedRef.current) {
      socket.requestUnreadCount();
    }
  }, [socket.connected]);

  useEffect(() => {
    if (!socket.connected) return;

    const handleNewNotification = (data) => {
      setNotifications((prev) => {
        if (prev.find((n) => n.id === data.id)) return prev;
        return [data, ...prev];
      });
      setUnreadCount((prev) => prev + 1);
    };

    const handleUnreadCount = ({ count }) => {
      setUnreadCount(count);
    };

    const handleRead = ({ id, read }) => {
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read } : n))
      );
      if (read) {
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    };

    const handleDeleted = ({ id }) => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    };

    const handlers = {
      [EVENTS.NOTIFICATION_CREATED]: handleNewNotification,
      [EVENTS.NOTIFICATION_UNREAD_COUNT]: handleUnreadCount,
      [EVENTS.NOTIFICATION_READ]: handleRead,
      [EVENTS.NOTIFICATION_DELETED]: handleDeleted,
    };

    for (const [event, handler] of Object.entries(handlers)) {
      socket.on(event, handler);
      if (!listenersRef.current.has(event)) {
        listenersRef.current.set(event, new Set());
      }
      listenersRef.current.get(event).add(handler);
    }

    return () => {
      for (const [event, handler] of Object.entries(handlers)) {
        socket.off(event, handler);
        if (listenersRef.current.has(event)) {
          const set = listenersRef.current.get(event);
          set.delete(handler);
          if (set.size === 0) listenersRef.current.delete(event);
        }
      }
    };
  }, [socket.connected, socket.on, socket.off]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  return {
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
    refetch: fetchNotifications,
    connectionState: socket.connectionState,
  };
};

export default useNotifications;
