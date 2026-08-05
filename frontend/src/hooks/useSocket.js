/**
 * hooks/useSocket.js
 * ------------------------------------------------------------
 * Manages Socket.IO connection lifecycle for the React app.
 * Automatically connects on authentication, reconnects on
 * token changes, and provides connection state + event helpers.
 *
 * Features:
 *  - JWT token injection via auth handshake
 *  - Automatic reconnection with exponential backoff
 *  - Connection state: 'connected' | 'connecting' | 'reconnecting' | 'offline'
 *  - Heartbeat ping/pong
 *  - Listener tracking for memory leak prevention
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from 'react-toastify';

const SOCKET_PATH = '/api/socket.io';

const getSocketUrl = () => {
  const envUrl = import.meta.env.VITE_SOCKET_URL;
  if (envUrl) return envUrl;
  if (import.meta.env.DEV) return 'http://localhost:5000';
  return window.location.origin;
};

const connectionConfig = {
  path: SOCKET_PATH,
  withCredentials: true,
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 30000,
  randomizationFactor: 0.5,
  timeout: 10000,
  autoUpgrade: true,
};

const RECONNECT_BANNER_MS = 3000;

export const useSocket = (autoConnect = true) => {
  const { user, loading: authLoading } = useAuth();
  const socketRef = useRef(null);
  const listenersRef = useRef(new Map());
  const reconnectTimerRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [connectionState, setConnectionState] = useState('offline');
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const [error, setError] = useState(null);

  const token = localStorage.getItem('accessToken');

  const connect = useCallback(() => {
    if (!token || socketRef.current?.connected) return;

    setConnectionState('connecting');

    const socket = io(getSocketUrl(), {
      ...connectionConfig,
      auth: { token },
      reconnectionDelay: Math.min(1000 * Math.pow(2, reconnectAttempt), 30000),
    });

    socket.on('connect', () => {
      setConnected(true);
      setConnectionState('connected');
      setReconnectAttempt(0);
      setError(null);
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    });

    socket.on('connect_error', (err) => {
      setConnected(false);
      setConnectionState('offline');
      setError(err.message);
    });

    socket.on('disconnect', (reason) => {
      setConnected(false);
      if (reason === 'io server disconnected' || reason === 'transport error') {
        setConnectionState('offline');
      } else {
        setConnectionState('reconnecting');
      }
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
    });

    socket.on('reconnect_attempt', (attempt) => {
      setReconnectAttempt(attempt);
      setConnectionState('reconnecting');
    });

    socket.on('reconnect_failed', () => {
      setConnectionState('offline');
    });

    socket.on('reconnect', () => {
      setConnectionState('connected');
      setReconnectAttempt(0);
    });

    socket.on('heartbeat.pong', () => {
      if (socketRef.current) {
        socketRef.current.lastPong = Date.now();
      }
    });

    socket.on('offline', () => {
      setConnectionState('offline');
      setConnected(false);
    });

    socketRef.current = socket;
  }, [token, reconnectAttempt]);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    setConnected(false);
    setConnectionState('offline');
  }, []);

  const emit = useCallback((event, data) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit(event, data);
    }
  }, []);

  const on = useCallback((event, handler) => {
    const socket = socketRef.current;
    if (!socket) return;

    socket.on(event, handler);
    if (!listenersRef.current.has(event)) {
      listenersRef.current.set(event, new Set());
    }
    listenersRef.current.get(event).add(handler);
  }, []);

  const off = useCallback((event, handler) => {
    const socket = socketRef.current;
    if (!socket) return;

    socket.off(event, handler);
    if (listenersRef.current.has(event)) {
      const set = listenersRef.current.get(event);
      set.delete(handler);
      if (set.size === 0) listenersRef.current.delete(event);
    }
  }, []);

  const removeAllListeners = useCallback(() => {
    if (!socketRef.current) return;
    for (const [event, handlers] of listenersRef.current.entries()) {
      for (const handler of handlers) {
        socketRef.current.off(event, handler);
      }
    }
    listenersRef.current.clear();
  }, []);

  useEffect(() => {
    if (!autoConnect || authLoading || !token || !user) {
      if (!token) {
        setConnectionState('offline');
        setConnected(false);
      }
      return;
    }

    connect();

    return () => {
      removeAllListeners();
      disconnect();
    };
  }, [autoConnect, authLoading, token, user, connect, disconnect, removeAllListeners]);

  useEffect(() => {
    if (connectionState === 'reconnecting' && connected) {
      const timer = setTimeout(() => {
        if (!socketRef.current?.connected) {
          connect();
        }
      }, RECONNECT_BANNER_MS);
      return () => clearTimeout(timer);
    }
  }, [connectionState, connected, connect]);

  const ping = useCallback(() => {
    emit('heartbeat.ping', { ts: Date.now() });
  }, [emit]);

  const requestUnreadCount = useCallback(() => {
    emit('notification:get_unread');
  }, [emit]);

  return {
    socket: socketRef.current,
    connected,
    connectionState,
    reconnectAttempt,
    error,
    connect,
    disconnect,
    emit,
    on,
    off,
    removeAllListeners,
    ping,
    requestUnreadCount,
  };
};

export default useSocket;
