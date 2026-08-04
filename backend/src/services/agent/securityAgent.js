/**
 * services/agent/securityAgent.js
 * ============================================================
 * MODULE X — Autonomous AI Security Agent.
 * ------------------------------------------------------------
 * High-level orchestrator that:
 *   1. Accepts user security context.
 *   2. Loads stored memory / recent scan history.
 *   3. Coordinates threat analysis.
 *   4. Generates recommendations via the Recommendation Engine.
 *   5. Returns a unified security assessment.
 *
 * Usage:
 *  const assessment = await runSecurityAgent(userId, userContext);
 *
 * Constraints:
 *  - Reuses existing AI Router (Gemini / Ollama).
 *  - Reuses existing logger, sanitizePrompt, and scan services.
 *  - Does not expose sensitive raw data in responses.
 *  - Does not modify existing chatbot or scanner flows.
 */

import { getContext, setContext, appendScan, getRecentScans, saveAssessment } from './agentMemory.js';
import { analyzeThreats } from './threatAnalyzer.js';
import { generateRecommendations } from './recommendationEngine.js';
import { recordScan } from '../scanService.js';
import { sanitizePrompt } from '../../utils/sanitizePrompt.js';
import logger from '../../utils/logger.js';

/**
 * Run the security agent for a user.
 * @param {string} userId
 * @param {object} [userContext]
 * @param {string} [userContext.device]
 * @param {string} [userContext.location]
 * @param {string} [userContext.language='en']
 * @param {Array<{type:string, riskScore:number, verdict:string, createdAt:Date}>} [externalScans]
 * @returns {Promise<{
 *   userId: string,
 *   assessment: object,
 *   recommendations: Array<object>,
 *   generatedAt: string
 * }>}
 */
export const runSecurityAgent = async (userId, userContext = {}, externalScans = []) => {
  try {
    if (!userId) {
      throw new Error('userId is required to run the security agent');
    }

    // Sanitize user context to prevent injection.
    const safeContext = {
      device: typeof userContext.device === 'string' ? userContext.device.slice(0, 120) : 'unknown',
      location: typeof userContext.location === 'string' ? userContext.location.slice(0, 120) : 'unknown',
      language: userContext.language || 'en',
    };

    // Load memory.
    const memory = await getContext(userId) || {};
    const recentScans = externalScans.length > 0 ? externalScans : await getRecentScans(userId, 20);

    // Update memory with fresh context.
    await setContext(userId, {
      ...memory,
      ...safeContext,
      lastInteraction: new Date(),
    });

    // Coordinate threat analysis.
    const assessment = analyzeThreats(recentScans, safeContext, true);

    // Generate recommendations.
    const recommendations = await generateRecommendations(assessment, safeContext, safeContext.language);

    // Persist assessment to MongoDB.
    await saveAssessment(userId, { ...assessment, recommendations });

    const result = {
      userId,
      assessment,
      recommendations,
      generatedAt: new Date().toISOString(),
    };

    logger.info('[securityAgent] Agent run completed', {
      userId,
      verdict: assessment.verdict,
      overallRiskScore: assessment.overallRiskScore,
      recommendationCount: recommendations.length,
    });

    return result;
  } catch (err) {
    logger.error('[securityAgent] Agent run failed', { error: err.message, userId });
    return {
      userId,
      assessment: {
        overallRiskScore: 0,
        verdict: 'safe',
        threats: [],
        summary: 'Agent analysis failed. Please try again later.',
      },
      recommendations: [],
      generatedAt: new Date().toISOString(),
      error: err.message,
    };
  }
};

/**
 * Feed a new scan result into the agent memory so the agent
 * can incorporate it into future assessments.
 * @param {string} userId
 * @param {object} scanResult
 * @param {string} scanResult.type
 * @param {number} scanResult.riskScore
 * @param {string} scanResult.verdict
 * @returns {Promise<void>}
 */
export const feedScanResult = async (userId, scanResult) => {
  try {
    if (!userId || !scanResult) return;
    appendScan(userId, {
      type: scanResult.type,
      riskScore: scanResult.riskScore ?? 0,
      verdict: scanResult.verdict ?? 'unknown',
    });
    await recordScan(userId, scanResult.type, '', scanResult, '');
  } catch (err) {
    logger.warn('[securityAgent] Failed to feed scan result', { error: err.message });
  }
};

export default { runSecurityAgent, feedScanResult };
