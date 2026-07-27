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

// Web search for cybersecurity intelligence.
export const webSearch = (query, sessionId) =>
  api.post('/chat/web-search', { query, sessionId }).then((r) => r);

// Multimodal chat: send file + message for AI security analysis.
export const sendMultimodalMessage = async (file, message, sessionId) => {
  const form = new FormData();
  if (file) form.append('file', file);
  if (message) form.append('message', message);
  if (sessionId) form.append('sessionId', sessionId);
  console.log('[sendMultimodalMessage] selected file:', file ? { name: file.name, size: file.size, type: file.type } : null);
  console.log('[sendMultimodalMessage] FormData keys:', Array.from(form.keys()));
  const res = await api.post('/chat/upload', form);
  console.log('[sendMultimodalMessage] API response:', res);
  return res;
};

// Upload history for AI File Security Analyzer.
export const getUploadHistory = () => api.get('/ai/upload/history').then((r) => r.analyses || []);

export default {
  getDashboard, downloadReport, listReports, getNotifications,
  getProfile, updateProfileName, changePassword,
  getChatHistory, clearChatHistory,
  sendMultimodalMessage, getUploadHistory, webSearch, getAIStatus,
};
