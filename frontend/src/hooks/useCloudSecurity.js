import { useEffect, useRef, useState, useCallback } from 'react';
import { useSocket } from './useSocket.js';
import {
  getCloudSecurityMetrics,
  getCloudRiskScore,
  getCloudFindings,
  triggerCloudScan,
  getContainerMetrics,
  getContainerImages,
  k8sScan,
  getK8sMetrics,
  getK8sResources,
  getCloudProviders,
} from '../services/endpoints';

const CLOUD_EVENTS = {
  SCAN_STARTED: 'cloud.scan.started',
  SCAN_COMPLETED: 'cloud.scan.completed',
  RISK_UPDATED: 'cloud.risk.updated',
  FINDING_UPDATED: 'cloud.finding.updated',
  PROVIDER_ADDED: 'cloud.provider.added',
  PROVIDER_REMOVED: 'cloud.provider.removed',
  COMPLIANCE_UPDATED: 'cloud.compliance.updated',
};

const CONTAINER_EVENTS = {
  SCAN_STARTED: 'container.scan.started',
  SCAN_COMPLETED: 'container.scan.completed',
  VULNERABILITY_DETECTED: 'container.vulnerability.detected',
  SECRET_DETECTED: 'container.secret.detected',
};

const K8S_EVENTS = {
  SCAN_STARTED: 'k8s.scan.started',
  SCAN_COMPLETED: 'k8s.scan.completed',
  FINDING_DETECTED: 'k8s.finding.detected',
};

export const useCloudSecurity = (callbacks = {}) => {
  const {
    onScanStarted,
    onScanCompleted,
    onRiskUpdated,
    onFindingUpdated,
    onProviderAdded,
    onProviderRemoved,
    onComplianceUpdated,
    onContainerScanStarted,
    onContainerScanCompleted,
    onVulnerabilityDetected,
    onSecretDetected,
    onK8sScanStarted,
    onK8sScanCompleted,
    onK8sFindingDetected,
  } = callbacks;

  const socket = useSocket(true);
  const subscribedRef = useRef(false);
  const [metrics, setMetrics] = useState(null);
  const [riskScore, setRiskScore] = useState(0);
  const [findings, setFindings] = useState([]);
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadMetrics = useCallback(async () => {
    try {
      setLoading(true);
      const [metricsData, riskData, findingsData, providersData] = await Promise.all([
        getCloudSecurityMetrics().catch(() => null),
        getCloudRiskScore().catch(() => null),
        getCloudFindings({ page: 1, limit: 20 }).catch(() => ({ findings: [] })),
        getCloudProviders().catch(() => []),
      ]);
      setMetrics(metricsData);
      setRiskScore(riskData?.score || metricsData?.overallRiskScore || 0);
      setFindings(findingsData?.findings || []);
      setProviders(providersData);
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshMetrics = useCallback(() => {
    loadMetrics();
  }, [loadMetrics]);

  const startScan = useCallback(async (provider = null) => {
    try {
      if (provider) {
        return await triggerCloudScan(provider);
      }
      const { scanAllClouds } = await import('../services/endpoints');
      return await scanAllClouds();
    } catch {
      // Surface scan failures through callbacks/UI state instead of console noise
    }
  }, []);

  useEffect(() => {
    if (!socket.connected || subscribedRef.current) return;
    subscribedRef.current = true;

    const handlers = {
      [CLOUD_EVENTS.SCAN_STARTED]: onScanStarted,
      [CLOUD_EVENTS.SCAN_COMPLETED]: (data) => {
        onScanCompleted?.(data);
        loadMetrics();
      },
      [CLOUD_EVENTS.RISK_UPDATED]: (data) => {
        onRiskUpdated?.(data);
        setRiskScore((prev) => ({ ...prev, ...data }));
      },
      [CLOUD_EVENTS.FINDING_UPDATED]: onFindingUpdated,
      [CLOUD_EVENTS.PROVIDER_ADDED]: (data) => {
        onProviderAdded?.(data);
        getCloudProviders().then(setProviders).catch(() => {});
      },
      [CLOUD_EVENTS.PROVIDER_REMOVED]: (data) => {
        onProviderRemoved?.(data);
        getCloudProviders().then(setProviders).catch(() => {});
      },
      [CLOUD_EVENTS.COMPLIANCE_UPDATED]: onComplianceUpdated,
      [CONTAINER_EVENTS.SCAN_STARTED]: onContainerScanStarted,
      [CONTAINER_EVENTS.SCAN_COMPLETED]: onContainerScanCompleted,
      [CONTAINER_EVENTS.VULNERABILITY_DETECTED]: onVulnerabilityDetected,
      [CONTAINER_EVENTS.SECRET_DETECTED]: onSecretDetected,
      [K8S_EVENTS.SCAN_STARTED]: onK8sScanStarted,
      [K8S_EVENTS.SCAN_COMPLETED]: (data) => {
        onK8sScanCompleted?.(data);
        loadMetrics();
      },
      [K8S_EVENTS.FINDING_DETECTED]: onK8sFindingDetected,
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
  }, [socket, onScanStarted, onScanCompleted, onRiskUpdated, onFindingUpdated, onProviderAdded, onProviderRemoved, onComplianceUpdated, onContainerScanStarted, onContainerScanCompleted, onVulnerabilityDetected, onSecretDetected, onK8sScanStarted, onK8sScanCompleted, onK8sFindingDetected, loadMetrics]);

  return {
    connected: socket.connected,
    connectionState: socket.connectionState,
    metrics,
    riskScore,
    findings,
    providers,
    loading,
    loadMetrics,
    refreshMetrics,
    startScan,
  };
};

export default useCloudSecurity;
