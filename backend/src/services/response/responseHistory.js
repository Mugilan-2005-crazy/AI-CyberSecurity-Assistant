import IncidentResponse from '../../models/IncidentResponse.js';
import logger from '../../utils/logger.js';

export async function getResponseHistory(options = {}) {
  try {
    const { incidentId, userId, status, severity, page = 1, limit = 20 } = options;
    const filter = {};

    if (incidentId) filter.incidentId = incidentId;
    if (userId) filter.userId = userId;
    if (status) filter.status = status;
    if (severity) filter.priority = severity;

    const responses = await IncidentResponse.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .populate('approvedBy', 'name email')
      .populate('incidentId', 'threatType severity status');

    const total = await IncidentResponse.countDocuments(filter);

    return {
      responses: responses.map((r) => ({
        id: r._id,
        incidentId: r.incidentId,
        userId: r.userId,
        threatType: r.threatType,
        mitreTechnique: r.mitreTechnique,
        investigationSummary: r.investigationSummary,
        recommendedActions: r.recommendedActions,
        priority: r.priority,
        status: r.status,
        confidenceScore: r.confidenceScore,
        aiProvider: r.aiProvider,
        approvedBy: r.approvedBy,
        executedAt: r.executedAt,
        createdAt: r.createdAt,
      })),
      total,
      page: Number(page),
      totalPages: Math.ceil(total / limit),
    };
  } catch (err) {
    logger.error('[responseHistory] Failed to get response history', { error: err.message });
    throw err;
  }
}

export async function getResponseById(responseId) {
  try {
    const response = await IncidentResponse.findById(responseId)
      .populate('approvedBy', 'name email')
      .populate('incidentId', 'threatType severity status');

    if (!response) return null;

    return {
      id: response._id,
      incidentId: response.incidentId,
      userId: response.userId,
      threatType: response.threatType,
      mitreTechnique: response.mitreTechnique,
      investigationSummary: response.investigationSummary,
      recommendedActions: response.recommendedActions,
      priority: response.priority,
      status: response.status,
      confidenceScore: response.confidenceScore,
      aiProvider: response.aiProvider,
      approvedBy: response.approvedBy,
      executedAt: response.executedAt,
      createdAt: response.createdAt,
    };
  } catch (err) {
    logger.error('[responseHistory] Failed to get response by ID', { error: err.message });
    throw err;
  }
}

export async function updateResponseStatus(responseId, status, approvedBy = null) {
  try {
    const response = await IncidentResponse.findById(responseId);
    if (!response) return null;

    response.status = status;

    if (status === 'approved' && approvedBy) {
      response.approvedBy = approvedBy;
    }

    if (status === 'executed') {
      response.executedAt = new Date();
    }

    await response.save();

    logger.info('[responseHistory] Response status updated', { responseId, status });

    return {
      id: response._id,
      incidentId: response.incidentId,
      userId: response.userId,
      threatType: response.threatType,
      mitreTechnique: response.mitreTechnique,
      investigationSummary: response.investigationSummary,
      recommendedActions: response.recommendedActions,
      priority: response.priority,
      status: response.status,
      confidenceScore: response.confidenceScore,
      aiProvider: response.aiProvider,
      approvedBy: response.approvedBy,
      executedAt: response.executedAt,
      createdAt: response.createdAt,
    };
  } catch (err) {
    logger.error('[responseHistory] Failed to update response status', { error: err.message });
    throw err;
  }
}

export async function getResponsesByUser(userId, options = {}) {
  try {
    const { page = 1, limit = 20 } = options;
    const responses = await IncidentResponse.find({ userId })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .populate('incidentId', 'threatType severity status');

    const total = await IncidentResponse.countDocuments({ userId });

    return {
      responses: responses.map((r) => ({
        id: r._id,
        incidentId: r.incidentId,
        threatType: r.threatType,
        mitreTechnique: r.mitreTechnique,
        investigationSummary: r.investigationSummary,
        recommendedActions: r.recommendedActions,
        priority: r.priority,
        status: r.status,
        confidenceScore: r.confidenceScore,
        aiProvider: r.aiProvider,
        approvedBy: r.approvedBy,
        executedAt: r.executedAt,
        createdAt: r.createdAt,
      })),
      total,
      page: Number(page),
      totalPages: Math.ceil(total / limit),
    };
  } catch (err) {
    logger.error('[responseHistory] Failed to get user responses', { error: err.message });
    throw err;
  }
}

export default { getResponseHistory, getResponseById, updateResponseStatus, getResponsesByUser };