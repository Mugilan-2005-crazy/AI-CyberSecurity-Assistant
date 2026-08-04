import { useEffect, useRef, useState, useCallback } from 'react';
import { useSocket } from './useSocket.js';

const UEBA_EVENTS = {
  ANOMALY_DETECTED: 'ueba.anomaly.detected',
  RISK_UPDATED: 'ueba.risk.updated',
  PROFILE_UPDATED: 'ueba.profile.updated',
  ANOMALY_ACKNOWLEDGED: 'ueba:anomaly.acknowledged',
  GET_RISK_SCORE: 'ueba:get_risk_score',
};

export const useUEBA = (callbacks = {}) => {
  const {
    onAnomalyDetected,
    onRiskUpdated,
    onProfileUpdated,
    onAnomalyAcknowledged,
  } = callbacks;

  const socket = useSocket(true);
  const subscribedRef = useRef(false);
  const [riskScore, setRiskScore] = useState({ riskScore: 0, riskLevel: 'Low', anomalyCount: 0 });

  const requestRiskScore = useCallback(() => {
    socket.emit(UEBA_EVENTS.GET_RISK_SCORE);
  }, [socket.emit]);

  useEffect(() => {
    if (!socket.connected || subscribedRef.current) return;
    subscribedRef.current = true;

    const handlers = {
      [UEBA_EVENTS.ANOMALY_DETECTED]: onAnomalyDetected,
      [UEBA_EVENTS.RISK_UPDATED]: (payload) => {
        setRiskScore(payload || {});
        onRiskUpdated?.(payload);
      },
      [UEBA_EVENTS.PROFILE_UPDATED]: onProfileUpdated,
      [UEBA_EVENTS.ANOMALY_ACKNOWLEDGED]: onAnomalyAcknowledged,
    };

    for (const [event, handler] of Object.entries(handlers)) {
      if (handler) socket.on(event, handler);
    }

    requestRiskScore();

    return () => {
      for (const [event, handler] of Object.entries(handlers)) {
        if (handler) socket.off(event, handler);
      }
      subscribedRef.current = false;
    };
  }, [socket, onAnomalyDetected, onRiskUpdated, onProfileUpdated, onAnomalyAcknowledged, requestRiskScore]);

  return {
    connected: socket.connected,
    connectionState: socket.connectionState,
    riskScore,
    setRiskScore,
    requestRiskScore,
    emit: socket.emit,
    on: socket.on,
    off: socket.off,
  };
};

export default useUEBA;
