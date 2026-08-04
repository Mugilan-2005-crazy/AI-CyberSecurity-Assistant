/**
 * services/endpoints.js
 * ------------------------------------------------------------
 * Thin front-end API helpers for the dashboard/report/history
 * and profile features. Each wraps the shared `api` client (which
 * already injects the JWT and auto-refreshes). These call routes:
 *   GET  /api/scan/dashboard
 *   POST /api/scan/report   (blob PDF)
 *   GET  /api/scan/reports  (previous reports)
 *   GET  /api/admin/notifications
 *   GET  /api/auth/me
 *   PATCH /api/auth/me          (update display name)
 *   POST /api/auth/change-password
 */
import api from './api.js';

// Dashboard aggregate data (cards, charts, recent activity).
export const getDashboard = () => api.get('/scan/dashboard').then((r) => r.data);

// Trigger a PDF report download (returns a Blob).
export const downloadReport = (range = {}) =>
  api.post('/scan/report', range, { responseType: 'blob' }).then((blob) => {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `security-report-${Date.now()}.pdf`;
    a.click();
    window.URL.revokeObjectURL(url);
  });

// List previously generated reports.
export const listReports = () => api.get('/scan/reports').then((r) => r.reports || []);

// In-app notifications for the current user.
export const getNotifications = () => api.get('/admin/notifications').then((r) => r.notifications || []);

// Current user profile (identity + account stats).
export const getProfile = () => api.get('/auth/me').then((r) => r.user);

// Update the display name.
export const updateProfileName = (name) => api.patch('/auth/me', { name }).then((r) => r.user);

// Change the account password (current + new required).
export const changePassword = (currentPassword, newPassword) =>
  api.post('/auth/change-password', { currentPassword, newPassword });

// Chat history for the CyberSec Assistant.
export const getChatHistory = () => api.get('/chat/history').then((r) => r.sessions || []);
export const clearChatHistory = () => api.delete('/chat/history').then((r) => r);

// AI health status
export const getAIStatus = () => api.get('/chat/status').then((r) => r);

// AI Security Agent insights
export const getSecurityInsights = () => api.get('/agent/security-insights').then((r) => r.data);

// SOC Dashboard
export const getSOCDashboard = () => api.get('/soc/dashboard').then((r) => r.data);

// AI Incident Response
export const analyzeIncident = (incidentId) =>
  api.get(`/response/incidents/${incidentId}/analyze`).then((r) => r.data);

export const recommendResponse = (incidentId) =>
  api.post(`/response/incidents/${incidentId}/recommend`, {}).then((r) => r.data);

export const approveResponse = (incidentId, status) =>
  api.patch(`/response/incidents/${incidentId}/approve`, { status }).then((r) => r.data);

export const getResponseHistory = (params = {}) => {
  const query = new URLSearchParams(params).toString();
  return api.get(`/response/history${query ? `?${query}` : ''}`).then((r) => r.data);
};

export const getResponseById = (id) =>
  api.get(`/response/history/${id}`).then((r) => r.data);

// Executive Security Command Center API (Phase 4)
export const getExecutiveSummary = (params = {}) => {
  const query = new URLSearchParams(params).toString();
  return api.get(`/executive/summary${query ? `?${query}` : ''}`).then((r) => r.data);
};

export const getExecutiveAiSummary = (params = {}) => {
  const query = new URLSearchParams(params).toString();
  return api.get(`/executive/ai-summary${query ? `?${query}` : ''}`).then((r) => r.data);
};

export const getExecutiveReport = (params = {}) => {
  const query = new URLSearchParams(params).toString();
  return api.get(`/executive/report${query ? `?${query}` : ''}`).then((r) => r.data);
};

export const getExecutiveMetrics = () =>
  api.get('/executive/metrics').then((r) => r.data);

// AI Incident Report Center API (Phase 5)
export const generateIncidentReport = (incidentId) =>
  api.post(`/incident-reports/generate/${incidentId}`).then((r) => r.data);

export const getIncidentReports = (params = {}) => {
  const query = new URLSearchParams(params).toString();
  return api.get(`/incident-reports${query ? `?${query}` : ''}`).then((r) => r.reports || []);
};

export const getIncidentReport = (id) =>
  api.get(`/incident-reports/${id}`).then((r) => r.data);

export const shareIncidentReport = (id, expiresInHours = 72) =>
  api.post(`/incident-reports/${id}/share`, { expiresInHours }).then((r) => r.data);

export const getSharedIncidentReport = (token) =>
  api.get(`/incident-reports/share/${token}`).then((r) => r.data);

export const emailIncidentReport = (id, email) =>
  api.post(`/incident-reports/${id}/email`, { email }).then((r) => r.data);

export const exportIncidentReport = (id, format = 'pdf') =>
  api.post(`/incident-reports/${id}/export?format=${format}`).then((r) => r.data);

// Security Knowledge Graph API (Phase 6)
export const buildKnowledgeGraph = () => api.post('/knowledge-graph/build').then((r) => r.data);
export const getKnowledgeGraph = (params = {}) => {
  const query = new URLSearchParams(params).toString();
  return api.get(`/knowledge-graph${query ? `?${query}` : ''}`).then((r) => r.data);
};
export const getGraphEntity = (id) => api.get(`/knowledge-graph/entity/${id}`).then((r) => r.data);
export const addGraphEntity = (entity) => api.post('/knowledge-graph/entity', entity).then((r) => r.data);
export const addGraphRelationship = (rel) => api.post('/knowledge-graph/relationship', rel).then((r) => r.data);
export const getAttackPaths = (source, target, maxDepth = 5) => {
  const query = new URLSearchParams({ source, target, maxDepth }).toString();
  return api.get(`/knowledge-graph/path?${query}`).then((r) => r.data);
};
export const searchKnowledgeGraph = (q) => {
  const query = new URLSearchParams({ q }).toString();
  return api.get(`/knowledge-graph/search?${query}`).then((r) => r.data);
};
export const getGraphInsights = () => api.get('/knowledge-graph/insights').then((r) => r.data);
export const deleteGraphEntity = (id) => api.delete(`/knowledge-graph/entity/${id}`).then((r) => r.data);
export const resetKnowledgeGraph = () => api.post('/knowledge-graph/reset').then((r) => r.data);

// UEBA API (Phase 7)
export const getUebaDashboard = () => api.get('/ueba/dashboard').then((r) => r.data);

export const getUserRiskRanking = (params = {}) => {
  const query = new URLSearchParams(params).toString();
  return api.get(`/ueba/users/risk-ranking${query ? `?${query}` : ''}`).then((r) => r.data);
};

export const getUserBehaviorProfile = (userId) => api.get(`/ueba/users/${userId}/profile`).then((r) => r.data);

export const getUserTimeline = (userId, params = {}) => {
  const query = new URLSearchParams(params).toString();
  return api.get(`/ueba/users/${userId}/timeline${query ? `?${query}` : ''}`).then((r) => r.data);
};

export const getUserAnomalies = (userId, params = {}) => {
  const query = new URLSearchParams(params).toString();
  return api.get(`/ueba/users/${userId}/anomalies${query ? `?${query}` : ''}`).then((r) => r.data);
};

export const getUserRiskTrend = (userId, params = {}) => {
  const query = new URLSearchParams(params).toString();
  return api.get(`/ueba/users/${userId}/risk-trend${query ? `?${query}` : ''}`).then((r) => r.data);
};

export const runAnomalyDetection = (userId) => api.post(`/ueba/users/${userId}/detect`).then((r) => r.data);

export const getAnomalyDetail = (id) => api.get(`/ueba/anomaly/${id}`).then((r) => r.data);

export const resolveAnomaly = (id, status) => api.patch(`/ueba/anomaly/${id}/resolve`, { status }).then((r) => r.data);

export const getAllAnomalies = (params = {}) => {
  const query = new URLSearchParams(params).toString();
  return api.get(`/ueba/anomalies${query ? `?${query}` : ''}`).then((r) => r.data);
};

// User self-service UEBA endpoints
export const getMyProfile = () => api.get('/ueba/me/profile').then((r) => r.data);

export const getMyAnomalies = (params = {}) => {
  const query = new URLSearchParams(params).toString();
  return api.get(`/ueba/me/anomalies${query ? `?${query}` : ''}`).then((r) => r.data);
};

export const getMyRiskScore = () => api.get('/ueba/me/risk-score').then((r) => r.data);

export const getMyTimeline = (params = {}) => {
  const query = new URLSearchParams(params).toString();
  return api.get(`/ueba/me/timeline${query ? `?${query}` : ''}`).then((r) => r.data);
};

export const runMyDetection = () => api.post('/ueba/me/detect').then((r) => r.data);

// Cloud Security Posture Management API (Phase 8)
export const getCloudProviders = () => api.get('/cloud-security/providers').then((r) => r.data);
export const addCloudProvider = (providerData) => api.post('/cloud-security/providers', providerData).then((r) => r.data);
export const removeCloudProvider = (id) => api.delete(`/cloud-security/providers/${id}`).then((r) => r);
export const triggerCloudScan = (provider) => api.post('/cloud-security/scan', { provider }).then((r) => r);
export const scanAllClouds = () => api.post('/cloud-security/scan/all').then((r) => r);
export const getCloudFindings = (params = {}) => {
  const query = new URLSearchParams(params).toString();
  return api.get(`/cloud-security/findings${query ? `?${query}` : ''}`).then((r) => r.data);
};
export const getCloudFinding = (id) => api.get(`/cloud-security/findings/${id}`).then((r) => r.data);
export const updateCloudFinding = (id, status) => api.patch(`/cloud-security/findings/${id}`, { status }).then((r) => r.data);
export const getCloudSecurityMetrics = () => api.get('/cloud-security/metrics').then((r) => r.data);
export const getCloudRiskScore = () => api.get('/cloud-security/risk-score').then((r) => r.data);
export const getCloudExecutiveSummary = () => api.get('/cloud-security/analysis/executive-summary').then((r) => r.data);
export const getCloudTechnicalFindings = () => api.get('/cloud-security/analysis/technical-findings').then((r) => r.data);
export const getCloudRemediationPlan = (findingIds = []) => api.post('/cloud-security/analysis/remediation-plan', { findingIds }).then((r) => r.data);
export const getCloudBusinessImpact = () => api.get('/cloud-security/analysis/business-impact').then((r) => r.data);
export const getCloudAttackPossibility = () => api.get('/cloud-security/analysis/attack-possibility').then((r) => r.data);
export const getCloudComplianceImpact = (standards = []) => api.post('/cloud-security/analysis/compliance-impact', { standards }).then((r) => r.data);
export const getCloudFullAnalysis = () => api.get('/cloud-security/analysis/full').then((r) => r.data);
export const getCloudResources = (params = {}) => {
  const query = new URLSearchParams(params).toString();
  return api.get(`/cloud-security/resources${query ? `?${query}` : ''}`).then((r) => r.data);
};
export const getCloudProviderDashboard = (provider) => api.get(`/cloud-security/providers/${provider}/dashboard`).then((r) => r.data);
export const buildCloudKnowledgeGraph = (params = {}) => api.post('/knowledge-graph/cloud/build', params).then((r) => r.data);
export const getCloudThreatPredictions = () => api.get('/knowledge-graph/cloud/threat-predictions').then((r) => r.data);

// Container Security API (Phase 8)
export const scanContainerImage = (imageName) => api.post('/container-security/scan/image', { imageName }).then((r) => r);
export const scanRunningContainers = () => api.post('/container-security/scan/containers').then((r) => r);
export const scanDockerCompose = (composePath) => api.post('/container-security/scan/compose', { composePath }).then((r) => r);
export const getContainerImages = (params = {}) => {
  const query = new URLSearchParams(params).toString();
  return api.get(`/container-security/images${query ? `?${query}` : ''}`).then((r) => r.data);
};
export const getContainerImage = (id) => api.get(`/container-security/images/${id}`).then((r) => r.data);
export const getContainerMetrics = () => api.get('/container-security/metrics').then((r) => r.data);
export const k8sScan = (options = {}) => api.post('/container-security/k8s/scan', options).then((r) => r);
export const getK8sClusters = () => api.get('/container-security/k8s/clusters').then((r) => r.data);
export const getK8sResources = (params = {}) => {
  const query = new URLSearchParams(params).toString();
  return api.get(`/container-security/k8s/resources${query ? `?${query}` : ''}`).then((r) => r.data);
};
export const getK8sMetrics = () => api.get('/container-security/k8s/metrics').then((r) => r.data);
export const getK8sResourceDetail = (id) => api.get(`/container-security/k8s/resources/${id}`).then((r) => r.data);
export const getContainerDashboard = () => api.get('/container-security/dashboard').then((r) => r.data);
export const getExecutiveCloudDashboard = () => api.get('/executive/cloud-dashboard').then((r) => r.data);

// Web search for cybersecurity intelligence.
export const webSearch = (query, sessionId) =>
  api.post('/chat/web-search', { query, sessionId }).then((r) => r);

// Multimodal chat: send file + message for AI security analysis.
export const sendMultimodalMessage = async (file, message, sessionId) => {
  const form = new FormData();
  if (file) form.append('file', file);
  if (message) form.append('message', message);
  if (sessionId) form.append('sessionId', sessionId);
  if (import.meta.env.DEV) {
    console.log('[sendMultimodalMessage] selected file:', file ? { name: file.name, size: file.size, type: file.type } : null);
  }
  if (import.meta.env.DEV) {
    console.log('[sendMultimodalMessage] FormData keys:', Array.from(form.keys()));
  }
  const res = await api.post('/chat/upload', form);
  if (import.meta.env.DEV) {
    console.log('[sendMultimodalMessage] API response:', res);
  }
  return res;
};

// Upload history for AI File Security Analyzer.
export const getUploadHistory = () => api.get('/ai/upload/history').then((r) => r.analyses || []);

// Alerts API
export const getAlerts = (params = {}) => {
  const query = new URLSearchParams(params).toString();
  return api.get(`/alerts${query ? `?${query}` : ''}`).then((r) => r.data);
};

export const getAlertById = (id) => api.get(`/alerts/${id}`).then((r) => r.data);

export const acknowledgeAlert = (id) => api.patch(`/alerts/${id}/acknowledge`).then((r) => r.data);

export const getUserAlerts = (params = {}) => {
  const query = new URLSearchParams(params).toString();
  return api.get(`/alerts/user${query ? `?${query}` : ''}`).then((r) => r.data);
};

export const getDashboardAlerts = (params = {}) => {
  const query = new URLSearchParams(params).toString();
  return api.get(`/alerts/dashboard${query ? `?${query}` : ''}`).then((r) => r);
};

// AI SOC Analysis
export const getAIAnalysisHistory = (params = {}) => {
  const query = new URLSearchParams(params).toString();
  return api.get(`/ai/soc/history${query ? `?${query}` : ''}`).then((r) => r.data);
};

export const getAIAnalysisById = (id) =>
  api.get(`/ai/soc/${id}`).then((r) => r.data);

export const analyzeScanWithAI = (scanId) =>
  api.post(`/ai/soc/scan/${scanId}/analyze`).then((r) => r.data);

export const reopenAIAnalysis = (id) =>
  api.post(`/ai/soc/${id}/reopen`).then((r) => r.data);

export const getAIAnalysisStats = () =>
  api.get('/ai/soc/stats').then((r) => r.data);

// Threat Intelligence API
export const getThreatIntelDashboard = () => api.get('/threat-intel/dashboard').then((r) => r.data);

export const analyzeIoc = (ioc, iocType) =>
  api.post('/threat-intel/analyze', { ioc, iocType }).then((r) => r.data);

export const getIocHistory = (params = {}) => {
  const query = new URLSearchParams(params).toString();
  return api.get(`/threat-intel/iocs${query ? `?${query}` : ''}`).then((r) => r.data);
};

export const getIocReport = (id) => api.get(`/threat-intel/iocs/${id}`).then((r) => r.data);

export const correlateIocs = (iocs) =>
  api.post('/threat-intel/correlation', { iocs }).then((r) => r.data);

export const refreshThreatIntelCache = () =>
  api.post('/threat-intel/cache/refresh').then((r) => r);

export const getThreatFeeds = () => api.get('/threat-intel/feeds').then((r) => r.data);

export const searchCVE = (query) => api.get(`/threat-intel/cve/search?q=${encodeURIComponent(query)}`).then((r) => r.data);

export const getCVEById = (id) => api.get(`/threat-intel/cve/${id}`).then((r) => r.data);

// Notification Center API (Phase 3 — Real-time Security Operations)
export const getNotificationsList = (params = {}) => {
  const query = new URLSearchParams(params).toString();
  return api.get(`/notifications${query ? `?${query}` : ''}`).then((r) => r);
};

export const getUnreadCount = () => api.get('/notifications/unread-count').then((r) => r);

export const markNotificationRead = (id) => api.post(`/notifications/${id}/read`).then((r) => r);

export const markAllNotificationsRead = () => api.post('/notifications/mark-all-read').then((r) => r);

export const deleteNotification = (id) => api.delete(`/notifications/${id}`).then((r) => r);

export const deleteAllReadNotifications = () => api.delete('/notifications/read').then((r) => r);

export default {
  getDashboard, downloadReport, listReports, getNotifications,
  getProfile, updateProfileName, changePassword,
  getChatHistory, clearChatHistory,
  sendMultimodalMessage, getUploadHistory, webSearch, getAIStatus, getSecurityInsights,
  getSOCDashboard,
  getAlerts, getAlertById, acknowledgeAlert, getUserAlerts, getDashboardAlerts,
  getAIAnalysisHistory, getAIAnalysisById, analyzeScanWithAI, reopenAIAnalysis, getAIAnalysisStats,
  getThreatIntelDashboard, analyzeIoc, getIocHistory, getIocReport, correlateIocs, refreshThreatIntelCache,
  getThreatFeeds, searchCVE, getCVEById,
  getNotificationsList, getUnreadCount, markNotificationRead, markAllNotificationsRead, deleteNotification, deleteAllReadNotifications,
  getExecutiveSummary, getExecutiveAiSummary, getExecutiveReport, getExecutiveMetrics,
  generateIncidentReport, getIncidentReports, getIncidentReport, shareIncidentReport, getSharedIncidentReport, emailIncidentReport, exportIncidentReport,
  buildKnowledgeGraph, getKnowledgeGraph, getGraphEntity, addGraphEntity, addGraphRelationship, getAttackPaths, searchKnowledgeGraph, getGraphInsights, deleteGraphEntity,   resetKnowledgeGraph,
   getUebaDashboard, getUserRiskRanking, getUserBehaviorProfile, getUserTimeline, getUserAnomalies, getUserRiskTrend, runAnomalyDetection, getAnomalyDetail, resolveAnomaly, getAllAnomalies,   getMyProfile, getMyAnomalies, getMyRiskScore, getMyTimeline, runMyDetection,
   getCloudProviders, addCloudProvider, removeCloudProvider, triggerCloudScan, scanAllClouds, getCloudFindings, getCloudFinding, updateCloudFinding, getCloudSecurityMetrics, getCloudRiskScore, getCloudExecutiveSummary, getCloudTechnicalFindings, getCloudRemediationPlan, getCloudBusinessImpact, getCloudAttackPossibility, getCloudComplianceImpact, getCloudFullAnalysis, getCloudResources, getCloudProviderDashboard, buildCloudKnowledgeGraph, getCloudThreatPredictions,
   scanContainerImage, scanRunningContainers, scanDockerCompose, getContainerImages, getContainerImage, getContainerMetrics, k8sScan, getK8sClusters, getK8sResources, getK8sMetrics, getK8sResourceDetail, getContainerDashboard, getExecutiveCloudDashboard,
};
