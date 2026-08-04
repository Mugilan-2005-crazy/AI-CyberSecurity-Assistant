/**
 * hooks/useRealtimeDashboard.js
 * ------------------------------------------------------------
 * Subscribes to real-time Socket.IO events that affect dashboard
 * data (scans, AI analysis, threat intel, incidents) and merges
 * them into the local state. Provides update callbacks that
 * consumers can use to react to live events.
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { useSocket } from './useSocket.js';

const SCAN_EVENTS = {
  STARTED: 'scan.started',
  PROGRESS: 'scan.progress',
  COMPLETED: 'scan.completed',
  FAILED: 'scan.failed',
};

const AI_EVENTS = {
  STARTED: 'ai.started',
  PROGRESS: 'ai.progress',
  COMPLETED: 'ai.completed',
  FAILED: 'ai.failed',
};

const THREAT_EVENTS = {
  ANALYSIS_STARTED: 'threat.analysis.started',
  ANALYSIS_COMPLETED: 'threat.analysis.completed',
  FEED_UPDATE: 'threat.feed.update',
};

const INCIDENT_EVENTS = {
  CREATED: 'incident.created',
  UPDATED: 'incident.updated',
  CLOSED: 'incident.closed',
};

const DASHBOARD_EVENTS = {
  REFRESH: 'dashboard.refresh',
  STATS_UPDATE: 'dashboard.stats_update',
};

const NOTIFICATION_EVENTS = {
  CREATED: 'notification.created',
  UNREAD_COUNT: 'notification.unread_count',
  READ: 'notification.read',
  DELETED: 'notification.deleted',
};

export const useRealtimeDashboard = (callbacks = {}) => {
  const {
    onScanStarted,
    onScanProgress,
    onScanCompleted,
    onScanFailed,
    onAIStarted,
    onAIProgress,
    onAICompleted,
    onAIFailed,
    onThreatAnalysisCompleted,
    onThreatFeedUpdate,
    onIncidentCreated,
    onIncidentUpdated,
    onIncidentClosed,
    onDashboardUpdate,
    onNotificationCreated,
  } = callbacks;

  const socket = useSocket(true);
  const subscribedRef = useRef(false);

  const subscribe = useCallback(() => {
    if (!socket.connected || subscribedRef.current) return;
    subscribedRef.current = true;

    const handlers = {
      [SCAN_EVENTS.STARTED]: onScanStarted,
      [SCAN_EVENTS.PROGRESS]: onScanProgress,
      [SCAN_EVENTS.COMPLETED]: onScanCompleted,
      [SCAN_EVENTS.FAILED]: onScanFailed,
      [AI_EVENTS.STARTED]: onAIStarted,
      [AI_EVENTS.PROGRESS]: onAIProgress,
      [AI_EVENTS.COMPLETED]: onAICompleted,
      [AI_EVENTS.FAILED]: onAIFailed,
      [THREAT_EVENTS.ANALYSIS_COMPLETED]: onThreatAnalysisCompleted,
      [THREAT_EVENTS.FEED_UPDATE]: onThreatFeedUpdate,
      [INCIDENT_EVENTS.CREATED]: onIncidentCreated,
      [INCIDENT_EVENTS.UPDATED]: onIncidentUpdated,
      [INCIDENT_EVENTS.CLOSED]: onIncidentClosed,
      [DASHBOARD_EVENTS.STATS_UPDATE]: onDashboardUpdate,
      [NOTIFICATION_EVENTS.CREATED]: onNotificationCreated,
    };

    for (const [event, handler] of Object.entries(handlers)) {
      if (handler) socket.on(event, handler);
    }

    return () => {
      for (const [event, handler] of Object.entries(handlers)) {
        if (handler) socket.off(event, handler);
      }
      subscribedRef.current = false;
    };
  }, [socket.connected, socket.on, socket.off, onScanStarted, onScanProgress, onScanCompleted, onScanFailed, onAIStarted, onAIProgress, onAICompleted, onAIFailed, onThreatAnalysisCompleted, onThreatFeedUpdate, onIncidentCreated, onIncidentUpdated, onIncidentClosed, onDashboardUpdate, onNotificationCreated]);

  useEffect(() => {
    const cleanup = subscribe();
    return () => cleanup?.();
  }, [subscribe]);

  return {
    connected: socket.connected,
    connectionState: socket.connectionState,
    reconnectAttempt: socket.reconnectAttempt,
    error: socket.error,
    emit: socket.emit,
    on: socket.on,
    off: socket.off,
  };
};

export default useRealtimeDashboard;
