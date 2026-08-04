/**
 * services/agent/agentMemory.js
 * ============================================================
 * MODULE X — Agent Memory.
 * ------------------------------------------------------------
 * Persistent MongoDB-backed store for user security context.
 * Replaces the previous in-memory Map implementation with
 * Mongoose-backed persistence.
 *
 * Stores:
 *  - Recent scan summaries
 *  - Risk trends and overall risk scores
 *  - User-provided context (device, location, preferences)
 *  - Assessment history
 *
 * No sensitive raw data (passwords, URLs, file contents)
 * is persisted here, only redacted metadata.
 */

import AgentMemory from '../../models/AgentMemory.js';
import logger from '../../utils/logger.js';

const SCAN_LIMIT = 20;
const ASSESSMENT_LIMIT = 50;

/**
 * Upsert user security context.
 * @param {string} userId
 * @param {object} context
 * @param {Array<{type:string, riskScore:number, verdict:string, createdAt:Date}>} [context.recentScans]
 * @param {string} [context.device]
 * @param {string} [context.location]
 * @param {number} [context.overallRisk]
 * @param {string} [context.lastInteraction]
 * @returns {Promise<void>}
 */
export const setContext = async (userId, context) => {
  if (!userId || !context) return;
  try {
    const update = {
      $set: {
        ...(context.device && { device: context.device.slice(0, 120) }),
        ...(context.location && { location: context.location.slice(0, 120) }),
        ...(typeof context.overallRisk === 'number' && { overallRisk: context.overallRisk }),
        lastInteraction: new Date(),
        updatedAt: new Date(),
      },
    };

    if (Array.isArray(context.recentScans)) {
      update.$set.recentScans = context.recentScans.slice(-SCAN_LIMIT).map((s) => ({
        type: s.type,
        riskScore: s.riskScore ?? 0,
        verdict: s.verdict ?? 'unknown',
        createdAt: s.createdAt || new Date(),
      }));
    }

    await AgentMemory.findOneAndUpdate({ user: userId }, update, { upsert: true, new: true });
  } catch (err) {
    logger.warn('[agentMemory] setContext failed', { error: err.message, userId });
  }
};

/**
 * Retrieve user security context.
 * @param {string} userId
 * @returns {Promise<object|undefined>}
 */
export const getContext = async (userId) => {
  if (!userId) return undefined;
  try {
    const doc = await AgentMemory.findOne({ user: userId }).lean();
    return doc || undefined;
  } catch (err) {
    logger.warn('[agentMemory] getContext failed', { error: err.message, userId });
    return undefined;
  }
};

/**
 * Remove user security context.
 * @param {string} userId
 * @returns {Promise<void>}
 */
export const clearContext = async (userId) => {
  if (!userId) return;
  try {
    await AgentMemory.deleteOne({ user: userId });
  } catch (err) {
    logger.warn('[agentMemory] clearContext failed', { error: err.message, userId });
  }
};

/**
 * Append a scan summary to the user's recent scan list.
 * Keeps only the last N scans to avoid unbounded growth.
 * @param {string} userId
 * @param {object} scan
 * @param {number} [limit=20]
 * @returns {Promise<void>}
 */
export const appendScan = async (userId, scan, limit = SCAN_LIMIT) => {
  if (!userId || !scan) return;
  try {
    const entry = {
      type: scan.type,
      riskScore: scan.riskScore ?? 0,
      verdict: scan.verdict ?? 'unknown',
      createdAt: new Date(),
    };

    await AgentMemory.findOneAndUpdate(
      { user: userId },
      {
        $push: { recentScans: { $each: [entry], $slice: -limit } },
        $set: { lastInteraction: new Date(), updatedAt: new Date() },
      },
      { upsert: true, new: true }
    );
  } catch (err) {
    logger.warn('[agentMemory] appendScan failed', { error: err.message, userId });
  }
};

/**
 * Get recent scans for a user.
 * @param {string} userId
 * @param {number} [limit=10]
 * @returns {Promise<Array<object>>}
 */
export const getRecentScans = async (userId, limit = 10) => {
  if (!userId) return [];
  try {
    const doc = await AgentMemory.findOne({ user: userId }).lean();
    if (!doc || !Array.isArray(doc.recentScans)) return [];
    return doc.recentScans.slice(-limit);
  } catch (err) {
    logger.warn('[agentMemory] getRecentScans failed', { error: err.message, userId });
    return [];
  }
};

/**
 * Compute simple risk trend from recent scans.
 * @param {string} userId
 * @returns {Promise<{ trend: 'improving'|'stable'|'declining', avgRisk: number }>}
 */
export const getRiskTrend = async (userId) => {
  const scans = await getRecentScans(userId, 10);
  if (scans.length === 0) return { trend: 'stable', avgRisk: 0 };

  const avgRisk = Math.round(scans.reduce((sum, s) => sum + (s.riskScore || 0), 0) / scans.length);
  const recent = scans.slice(-3);
  const older = scans.slice(0, -3);
  const recentAvg = recent.length ? recent.reduce((sum, s) => sum + (s.riskScore || 0), 0) / recent.length : avgRisk;
  const olderAvg = older.length ? older.reduce((sum, s) => sum + (s.riskScore || 0), 0) / older.length : avgRisk;

  if (recentAvg > olderAvg + 10) return { trend: 'declining', avgRisk };
  if (recentAvg < olderAvg - 10) return { trend: 'improving', avgRisk };
  return { trend: 'stable', avgRisk };
};

/**
 * Save a security assessment to the user's history.
 * @param {string} userId
 * @param {object} assessment
 * @param {number} assessment.overallRiskScore
 * @param {string} assessment.verdict
 * @param {string} assessment.summary
 * @param {Array} assessment.threats
 * @param {Array} assessment.recommendations
 * @returns {Promise<void>}
 */
export const saveAssessment = async (userId, assessment) => {
  if (!userId || !assessment) return;
  try {
    const entry = {
      overallRiskScore: assessment.overallRiskScore ?? 0,
      verdict: assessment.verdict || 'unknown',
      summary: assessment.summary || '',
      threatCount: Array.isArray(assessment.threats) ? assessment.threats.length : 0,
      maliciousCount: Array.isArray(assessment.threats) ? assessment.threats.filter((t) => t.severity === 'high').length : 0,
      suspiciousCount: Array.isArray(assessment.threats) ? assessment.threats.filter((t) => t.severity === 'medium').length : 0,
      recommendations: Array.isArray(assessment.recommendations) ? assessment.recommendations.slice(0, 10) : [],
      createdAt: new Date(),
    };

    await AgentMemory.findOneAndUpdate(
      { user: userId },
      {
        $push: { assessments: { $each: [entry], $slice: -ASSESSMENT_LIMIT } },
        $set: { lastInteraction: new Date(), updatedAt: new Date() },
      },
      { upsert: true, new: true }
    );
  } catch (err) {
    logger.warn('[agentMemory] saveAssessment failed', { error: err.message, userId });
  }
};

/**
 * Get previous assessments for a user.
 * @param {string} userId
 * @param {number} [limit=10]
 * @returns {Promise<Array<object>>}
 */
export const getPreviousAssessments = async (userId, limit = 10) => {
  if (!userId) return [];
  try {
    const doc = await AgentMemory.findOne({ user: userId }).lean();
    if (!doc || !Array.isArray(doc.assessments)) return [];
    return doc.assessments.slice(-limit);
  } catch (err) {
    logger.warn('[agentMemory] getPreviousAssessments failed', { error: err.message, userId });
    return [];
  }
};

/**
 * Compare current vs previous security status.
 * @param {string} userId
 * @returns {Promise<{ current: object, previous: object|undefined, change: string }>}
 */
export const compareStatus = async (userId) => {
  try {
    const doc = await AgentMemory.findOne({ user: userId }).lean();
    if (!doc) return { current: null, previous: null, change: 'no-data' };

    const assessments = doc.assessments || [];
    const current = assessments[assessments.length - 1];
    const previous = assessments.length > 1 ? assessments[assessments.length - 2] : undefined;

    let change = 'stable';
    if (current && previous) {
      const diff = (current.overallRiskScore || 0) - (previous.overallRiskScore || 0);
      if (diff > 5) change = 'worsening';
      else if (diff < -5) change = 'improving';
    }

    return { current, previous, change };
  } catch (err) {
    logger.warn('[agentMemory] compareStatus failed', { error: err.message, userId });
    return { current: null, previous: null, change: 'error' };
  }
};

export default {
  setContext,
  getContext,
  clearContext,
  appendScan,
  getRecentScans,
  getRiskTrend,
  saveAssessment,
  getPreviousAssessments,
  compareStatus,
};
