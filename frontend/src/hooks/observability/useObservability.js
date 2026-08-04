import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../../services/api.js';
import { useSocket } from '../../hooks/useSocket.js';

export function useObservability() {
  const [metrics, setMetrics] = useState(null);
  const [health, setHealth] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const socket = useSocket(true);
  const intervalRef = useRef(null);

  const fetchMetrics = useCallback(async () => {
    try {
      const res = await api.get('/observability/metrics');
      setMetrics(res.data);
    } catch (err) {
      setError(err);
    }
  }, []);

  const fetchHealth = useCallback(async () => {
    try {
      const res = await api.get('/observability/health');
      setHealth(res.data);
    } catch (err) {
      setError(err);
    }
  }, []);

  const fetchAlerts = useCallback(async () => {
    try {
      const res = await api.get('/observability/alerts/active');
      setAlerts(res.data);
    } catch (err) {
      setError(err);
    }
  }, []);

  const fetchDashboard = useCallback(async (type = 'system') => {
    try {
      const res = await api.get(`/observability/dashboard/${type}`);
      setDashboardData(res.data);
    } catch (err) {
      setError(err);
    }
  }, []);

  const fetchSnapshot = useCallback(async () => {
    try {
      const res = await api.get('/observability/metrics/snapshot');
      setMetrics(res.data);
    } catch (err) {
      setError(err);
    }
  }, []);

  const acknowledgeAlert = useCallback(async (alertId) => {
    try {
      await api.patch(`/observability/alerts/${alertId}/acknowledge`);
      await fetchAlerts();
    } catch (err) {
      setError(err);
    }
  }, [fetchAlerts]);

  const resolveAlert = useCallback(async (alertId) => {
    try {
      await api.patch(`/observability/alerts/${alertId}/resolve`);
      await fetchAlerts();
    } catch (err) {
      setError(err);
    }
  }, [fetchAlerts]);

  const fetchLogs = useCallback(async (params = {}) => {
    try {
      const query = new URLSearchParams(params).toString();
      const res = await api.get(`/observability/logs${query ? `?${query}` : ''}`);
      return res.data;
    } catch (err) {
      setError(err);
      return null;
    }
  }, []);

  const fetchAuditLogs = useCallback(async (params = {}) => {
    try {
      const query = new URLSearchParams(params).toString();
      const res = await api.get(`/observability/logs/audit${query ? `?${query}` : ''}`);
      return res.data;
    } catch (err) {
      setError(err);
      return null;
    }
  }, []);

  useEffect(() => {
    const loadAll = async () => {
      setLoading(true);
      await Promise.all([fetchMetrics(), fetchHealth(), fetchAlerts(), fetchDashboard()]);
      setLoading(false);
    };
    loadAll();
  }, [fetchMetrics, fetchHealth, fetchAlerts, fetchDashboard]);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      fetchSnapshot();
      fetchHealth();
      fetchAlerts();
    }, 15000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchSnapshot, fetchHealth, fetchAlerts]);

  useEffect(() => {
    if (!socket.connected) return;

    socket.on('metrics.updated', (data) => {
      setMetrics((prev) => ({ ...prev, ...data }));
    });

    socket.on('health.updated', (data) => {
      setHealth((prev) => ({ ...prev, ...data }));
    });

    socket.on('alert.created', (data) => {
      setAlerts((prev) => [data, ...prev]);
    });

    socket.on('performance.updated', (data) => {
      setDashboardData((prev) => ({ ...prev, performance: data }));
    });

    socket.on('dashboard.updated', (data) => {
      setDashboardData((prev) => ({ ...prev, ...data }));
    });

    return () => {
      socket.off('metrics.updated');
      socket.off('health.updated');
      socket.off('alert.created');
      socket.off('performance.updated');
      socket.off('dashboard.updated');
    };
  }, [socket.connected, socket.on, socket.off]);

  return {
    metrics,
    health,
    alerts,
    dashboardData,
    loading,
    error,
    fetchMetrics,
    fetchHealth,
    fetchAlerts,
    fetchDashboard,
    fetchSnapshot,
    acknowledgeAlert,
    resolveAlert,
    fetchLogs,
    fetchAuditLogs,
  };
}

export default useObservability;