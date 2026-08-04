import SecurityAlert from '../../models/SecurityAlert.js';
import Notification from '../../models/Notification.js';
import { sendEmail } from '../../utils/email.js';
import logger from '../../utils/logger.js';
import { createNotification as createRealtimeNotification } from '../../socket/realtimeNotificationService.js';

export async function notify({ userId, alertId, severity, title, message }) {
  try {
    const alert = await SecurityAlert.findById(alertId).populate('userId', 'email name');
    if (!alert) {
      logger.warn('[notificationService] Alert not found for notification', { alertId });
      return { channel: 'none', status: 'skipped' };
    }

    const user = alert.userId;
    const results = {};

    const dashboardResult = await sendDashboardNotification(alert);
    results.dashboard = dashboardResult;

    await createRealtimeNotification(user?._id || alert.userId, {
      title: alert.title,
      message: alert.message,
      type: severity === 'CRITICAL' ? 'danger' : severity === 'HIGH' ? 'danger' : severity === 'MEDIUM' ? 'warning' : 'info',
      category: 'threat',
      severity: severity === 'CRITICAL' ? 'critical' : severity === 'HIGH' ? 'high' : severity === 'MEDIUM' ? 'medium' : 'low',
      metadata: { alertId: alert._id, source: alert.source, alertType: alert.alertType },
    }).catch((err) => logger.warn(`[notificationService] Realtime notification failed: ${err.message}`));

    if (['HIGH', 'CRITICAL'].includes(severity) && user?.email) {
      const emailResult = await sendEmailNotification(user.email, severity, title, message);
      results.email = emailResult;
    }

    logger.info('[notificationService] Notification dispatched', { alertId, channels: Object.keys(results) });
    return { channel: 'multi', status: 'dispatched', channels: results };
  } catch (err) {
    logger.error('[notificationService] Notification failed', { error: err.message, alertId });
    return { channel: 'none', status: 'failed', error: err.message };
  }
}

export async function sendDashboardNotification(alert) {
  try {
    if (typeof globalThis.io !== 'undefined' && globalThis.io) {
      const room = `user_${alert.userId}`;
      globalThis.io.to(room).emit('alert', {
        alertId: alert._id,
        severity: alert.severity,
        title: alert.title,
        message: alert.message,
        createdAt: alert.createdAt,
      });
    }
    return { channel: 'dashboard', status: 'delivered' };
  } catch (err) {
    logger.warn(`[notificationService] Dashboard notification failed: ${err.message}`);
    return { channel: 'dashboard', status: 'failed', error: err.message };
  }
}

export async function sendEmailNotification(to, severity, title, message) {
  try {
    const subject = `[${severity}] ${title}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: ${severity === 'CRITICAL' ? '#ef4444' : '#f59e0b'};">${severity} Security Alert</h2>
        <p><strong>${title}</strong></p>
        <p>${message}</p>
        <hr style="border-color: #334155;" />
        <p style="font-size: 12px; color: #94a3b8;">This is an automated alert from the Cyber Security Assistant.</p>
      </div>
    `;

    await sendEmail({ to, subject, html });
    logger.info('[notificationService] Email sent', { to, severity });
    return { channel: 'email', status: 'sent' };
  } catch (err) {
    logger.error(`[notificationService] Email failed: ${err.message}`);
    return { channel: 'email', status: 'failed', error: err.message };
  }
}

export async function acknowledgeAlert(alertId, userId) {
  try {
    const alert = await SecurityAlert.findOne({ _id: alertId, userId });
    if (!alert) return false;

    alert.status = 'acknowledged';
    alert.acknowledgedAt = new Date();
    await alert.save();

    logger.info('[notificationService] Alert acknowledged', { alertId, userId });
    return true;
  } catch (err) {
    logger.error('[notificationService] Acknowledge failed', { error: err.message });
    return false;
  }
}

export async function getNotificationHistory(userId, options = {}) {
  try {
    const { status, severity, page = 1, limit = 20 } = options;
    const filter = { userId };
    if (status) filter.status = status;
    if (severity) filter.severity = severity;

    const alerts = await SecurityAlert.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const total = await SecurityAlert.countDocuments(filter);

    return {
      alerts: alerts.map((a) => ({
        id: a._id,
        alertType: a.alertType,
        severity: a.severity,
        title: a.title,
        message: a.message,
        source: a.source,
        status: a.status,
        createdAt: a.createdAt,
        acknowledgedAt: a.acknowledgedAt,
      })),
      total,
      page: Number(page),
      totalPages: Math.ceil(total / limit),
    };
  } catch (err) {
    logger.error('[notificationService] History fetch failed', { error: err.message });
    return { alerts: [], total: 0, page: 1, totalPages: 0 };
  }
}

export default { notify, sendDashboardNotification, sendEmailNotification, acknowledgeAlert, getNotificationHistory };
