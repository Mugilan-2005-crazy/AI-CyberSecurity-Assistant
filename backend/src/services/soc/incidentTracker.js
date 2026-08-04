import SecurityIncident from '../../models/SecurityIncident.js';
import logger from '../../utils/logger.js';
import { emitIncidentCreated, emitIncidentUpdated, emitIncidentClosed } from '../../socket/realtimeNotificationService.js';

export async function createIncident(incidentData) {
  try {
    if (!incidentData || !incidentData.userId || !incidentData.threatType) {
      throw new Error('userId and threatType are required to create an incident');
    }

    const incident = new SecurityIncident({
      userId: incidentData.userId,
      threatType: incidentData.threatType,
      mitreTechnique: incidentData.mitreTechnique || {},
      severity: incidentData.severity || 'Medium',
      status: incidentData.status || 'open',
      description: incidentData.description || '',
      metadata: incidentData.metadata || {},
    });

    await incident.save();

    logger.info('[incidentTracker] Incident created', {
      incidentId: incident._id,
      userId: incident.userId,
      threatType: incident.threatType,
      severity: incident.severity,
    });

    emitIncidentCreated(incident.userId, incident).catch((err) => {
      logger.warn(`[incidentTracker] Failed to emit incident.created: ${err.message}`);
    });

    return incident;
  } catch (err) {
    logger.error('[incidentTracker] Failed to create incident', { error: err.message });
    throw err;
  }
}

export async function getIncidentById(incidentId) {
  try {
    const incident = await SecurityIncident.findById(incidentId).populate('userId', 'name email');
    if (!incident) return null;
    return incident;
  } catch (err) {
    logger.error('[incidentTracker] Failed to get incident', { error: err.message });
    throw err;
  }
}

export async function getIncidentsByUser(userId, options = {}) {
  try {
    const { status, severity, page = 1, limit = 20 } = options;
    const filter = { userId };
    if (status) filter.status = status;
    if (severity) filter.severity = severity;

    const incidents = await SecurityIncident.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .populate('userId', 'name email');

    const total = await SecurityIncident.countDocuments(filter);

    return {
      incidents: incidents.map((inc) => ({
        id: inc._id,
        userId: inc.userId,
        threatType: inc.threatType,
        mitreTechnique: inc.mitreTechnique,
        severity: inc.severity,
        status: inc.status,
        description: inc.description,
        createdAt: inc.createdAt,
        resolvedAt: inc.resolvedAt,
      })),
      total,
      page: Number(page),
      totalPages: Math.ceil(total / limit),
    };
  } catch (err) {
    logger.error('[incidentTracker] Failed to get incidents by user', { error: err.message });
    throw err;
  }
}

export async function updateIncidentStatus(incidentId, status, resolvedAt = null) {
  try {
    const incident = await SecurityIncident.findById(incidentId);
    if (!incident) return null;

    const previousStatus = incident.status;
    incident.status = status;
    if (status === 'resolved' || status === 'closed') {
      incident.resolvedAt = resolvedAt || new Date();
    } else {
      incident.resolvedAt = undefined;
    }

    await incident.save();

    logger.info('[incidentTracker] Incident updated', {
      incidentId,
      status,
      resolvedAt: incident.resolvedAt,
    });

    if (previousStatus !== status) {
      emitIncidentUpdated(incident.userId, incident).catch((err) => {
        logger.warn(`[incidentTracker] Failed to emit incident.updated: ${err.message}`);
      });

      if (status === 'closed') {
        emitIncidentClosed(incident.userId, incident).catch((err) => {
          logger.warn(`[incidentTracker] Failed to emit incident.closed: ${err.message}`);
        });
      }
    }

    return incident;
  } catch (err) {
    logger.error('[incidentTracker] Failed to update incident', { error: err.message });
    throw err;
  }
}

export async function getAllIncidents(options = {}) {
  try {
    const { status, severity, userId, page = 1, limit = 20 } = options;
    const filter = {};
    if (status) filter.status = status;
    if (severity) filter.severity = severity;
    if (userId) filter.userId = userId;

    const incidents = await SecurityIncident.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .populate('userId', 'name email');

    const total = await SecurityIncident.countDocuments(filter);

    return {
      incidents: incidents.map((inc) => ({
        id: inc._id,
        userId: inc.userId,
        threatType: inc.threatType,
        mitreTechnique: inc.mitreTechnique,
        severity: inc.severity,
        status: inc.status,
        description: inc.description,
        createdAt: inc.createdAt,
        resolvedAt: inc.resolvedAt,
      })),
      total,
      page: Number(page),
      totalPages: Math.ceil(total / limit),
    };
  } catch (err) {
    logger.error('[incidentTracker] Failed to get all incidents', { error: err.message });
    throw err;
  }
}

export default { createIncident, getIncidentById, getIncidentsByUser, updateIncidentStatus, getAllIncidents };