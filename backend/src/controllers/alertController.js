import ApiError from '../utils/ApiError.js';
import SecurityAlert from '../models/SecurityAlert.js';
import logger from '../utils/logger.js';

export async function getAlerts(req, res, next) {
  try {
    const { severity, status, page = 1, limit = 20 } = req.query;
    const filter = {};

    if (req.user.role === 'user') {
      filter.userId = req.user.id;
    }

    if (severity) filter.severity = severity;
    if (status) filter.status = status;

    const alerts = await SecurityAlert.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .populate('userId', 'name email');

    const total = await SecurityAlert.countDocuments(filter);

    res.json({
      success: true,
      data: alerts.map((a) => ({
        id: a._id,
        userId: a.userId,
        alertType: a.alertType,
        severity: a.severity,
        title: a.title,
        message: a.message,
        source: a.source,
        relatedIncident: a.relatedIncident,
        status: a.status,
        createdAt: a.createdAt,
        acknowledgedAt: a.acknowledgedAt,
      })),
      total,
      page: Number(page),
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    logger.error('[alertController] Failed to get alerts', { error: err.message });
    next(err);
  }
}

export async function getAlertById(req, res, next) {
  try {
    const alert = await SecurityAlert.findById(req.params.id).populate('userId', 'name email');
    if (!alert) {
      throw new ApiError(404, 'Alert not found');
    }

    if (req.user.role === 'user' && alert.userId._id.toString() !== req.user.id) {
      throw new ApiError(403, 'Not authorized to view this alert');
    }

    res.json({ success: true, data: alert });
  } catch (err) {
    logger.error('[alertController] Failed to get alert', { error: err.message });
    next(err);
  }
}

export async function acknowledgeAlert(req, res, next) {
  try {
    const alert = await SecurityAlert.findById(req.params.id);
    if (!alert) throw new ApiError(404, 'Alert not found');

    if (req.user.role === 'user' && alert.userId.toString() !== req.user.id) {
      throw new ApiError(403, 'Not authorized to acknowledge this alert');
    }

    alert.status = 'acknowledged';
    alert.acknowledgedAt = new Date();
    await alert.save();

    logger.info('[alertController] Alert acknowledged', { alertId: alert._id, userId: req.user.id });
    res.json({ success: true, data: alert, message: 'Alert acknowledged' });
  } catch (err) {
    logger.error('[alertController] Acknowledge failed', { error: err.message });
    next(err);
  }
}

export async function getAlertsByUser(req, res, next) {
  try {
    const { status, severity, page = 1, limit = 20 } = req.query;
    const userId = req.user.id;

    const filter = { userId };
    if (status) filter.status = status;
    if (severity) filter.severity = severity;

    const alerts = await SecurityAlert.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const total = await SecurityAlert.countDocuments(filter);

    res.json({
      success: true,
      data: alerts.map((a) => ({
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
    });
  } catch (err) {
    logger.error('[alertController] Failed to get user alerts', { error: err.message });
    next(err);
  }
}

export async function getDashboardAlerts(req, res, next) {
  try {
    const { timeframe = '24h' } = req.query;

    const cutoff = new Date();
    if (timeframe === '1h') cutoff.setHours(cutoff.getHours() - 1);
    else if (timeframe === '7d') cutoff.setDate(cutoff.getDate() - 7);
    else if (timeframe === '30d') cutoff.setDate(cutoff.getDate() - 30);
    else cutoff.setHours(cutoff.getHours() - 24);

    const recentAlerts = await SecurityAlert.find({ createdAt: { $gte: cutoff } })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate('userId', 'name email');

    const criticalCount = recentAlerts.filter((a) => a.severity === 'CRITICAL').length;
    const highCount = recentAlerts.filter((a) => a.severity === 'HIGH').length;
    const unreadCount = recentAlerts.filter((a) => a.status === 'unread').length;

    const alerts = recentAlerts.map((a) => ({
      id: a._id,
      alertType: a.alertType,
      severity: a.severity,
      title: a.title,
      message: a.message,
      source: a.source,
      status: a.status,
      createdAt: a.createdAt,
      acknowledgedAt: a.acknowledgedAt,
      user: a.userId,
    }));

    res.json({
      success: true,
      data: {
        alerts,
        summary: {
          total: alerts.length,
          critical: criticalCount,
          high: highCount,
          unread: unreadCount,
        },
      },
    });
  } catch (err) {
    logger.error('[alertController] Dashboard alerts failed', { error: err.message });
    next(err);
  }
}

export default { getAlerts, getAlertById, acknowledgeAlert, getAlertsByUser, getDashboardAlerts };
