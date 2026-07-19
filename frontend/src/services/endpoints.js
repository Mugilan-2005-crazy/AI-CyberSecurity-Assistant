/**
 * services/endpoints.js
 * ------------------------------------------------------------
 * Thin front-end API helpers for the dashboard/report/history
 * features. Each wraps the shared `api` client (which already
 * injects the JWT and auto-refreshes). No backend changes needed;
 * these only call existing routes:
 *   GET  /api/scan/dashboard
 *   POST /api/scan/report   (blob PDF)
 *   GET  /api/scan/reports  (previous reports)
 *   GET  /api/admin/notifications
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

export default { getDashboard, downloadReport, listReports, getNotifications };
