/**
 * services/agent/recommendationEngine.js
 * ============================================================
 * MODULE X — Recommendation Engine.
 * ------------------------------------------------------------
 * Generates actionable security recommendations based on:
 *  - Threat analysis result (risk score, verdict, threats)
 *  - User security context (device, location, preferences)
 *  - Optional AI-generated personalized advice via the existing
 *    AI Router (Gemini / Ollama).
 *
 * Output is a plain array of recommendation objects.
 * No sensitive user data is exposed in recommendations.
 */

import { routeAI } from '../ai/aiRouter.js';
import { retrieveContext } from '../rag/vectorRetriever.js';
import { sanitizePrompt } from '../../utils/sanitizePrompt.js';
import logger from '../../utils/logger.js';

/**
 * Static recommendations keyed by risk verdict.
 * These ensure the agent always returns useful guidance even
 * when AI providers are unavailable.
 */
const STATIC_RECOMMENDATIONS = {
  safe: [
    { priority: 'low', action: 'Continue regular security hygiene', detail: 'Keep software updated and use unique passwords.' },
    { priority: 'low', action: 'Enable multi-factor authentication', detail: 'Add MFA to all critical accounts for stronger protection.' },
    { priority: 'low', action: 'Schedule periodic scans', detail: 'Run URL, email, and file scans weekly.' },
  ],
  'low-risk': [
    { priority: 'medium', action: 'Review flagged items', detail: 'Check the suspicious scans and take action on weak passwords or links.' },
    { priority: 'medium', action: 'Update passwords', detail: 'Change passwords for any accounts with weak or reused credentials.' },
    { priority: 'low', action: 'Enable MFA', detail: 'Protect accounts with multi-factor authentication.' },
  ],
  'medium-risk': [
    { priority: 'high', action: 'Immediate scan review', detail: 'Investigate all suspicious and malicious results immediately.' },
    { priority: 'high', action: 'Rotate compromised credentials', detail: 'Change passwords for any services showing risk.' },
    { priority: 'medium', action: 'Review active sessions', detail: 'Log out of unknown devices and review account activity.' },
    { priority: 'medium', action: 'Run full device scan', detail: 'Use antivirus/anti-malware tools on affected devices.' },
  ],
  'high-risk': [
    { priority: 'critical', action: 'Immediate containment', detail: 'Disconnect affected devices from the network and change all critical passwords.' },
    { priority: 'critical', action: 'Contact support', detail: 'Report the incident to your security team or service provider.' },
    { priority: 'high', action: 'Enable MFA everywhere', detail: 'Secure all accounts with multi-factor authentication immediately.' },
    { priority: 'high', action: 'Review financial accounts', detail: 'Check bank and payment accounts for unauthorized activity.' },
  ],
  critical: [
    { priority: 'critical', action: 'Emergency response', detail: 'Assume compromise. Isolate systems, reset credentials, and engage incident response.' },
    { priority: 'critical', action: 'Preserve evidence', detail: 'Do not power off affected devices; preserve logs for forensic analysis.' },
    { priority: 'critical', action: 'Notify stakeholders', detail: 'Inform affected parties, regulators, and customers as required.' },
    { priority: 'high', action: 'Engage forensic team', detail: 'Hand over to security professionals for root cause analysis.' },
  ],
};

/**
 * Build a prompt for the AI provider to generate personalized recommendations.
 * Sensitive data is redacted; only risk level and scan types are shared.
 * @param {object} assessment
 * @param {object} [userContext]
 * @param {string} [ragContext]
 * @returns {string}
 */
const buildRecommendationPrompt = (assessment, userContext = {}, ragContext = '') => {
  const threatTypes = [...new Set((assessment.threats || []).map((t) => t.type))];
  const redactedContext = {
    verdict: assessment.verdict,
    overallRiskScore: assessment.overallRiskScore,
    threatTypes,
    device: userContext.device || 'unknown',
    location: userContext.location || 'unknown',
  };

  let prompt = `You are a cybersecurity advisor. Based on the user's security assessment, provide 3 concise, actionable recommendations.

Assessment:
${JSON.stringify(redactedContext, null, 2)}

Summary: ${assessment.summary}`;

  if (ragContext && ragContext.trim().length > 0) {
    prompt += `\n\nRelevant Security Knowledge:\n${ragContext.slice(0, 1500)}`;
  }

  prompt += `\n\nRules:
- Do not ask for personal information.
- Do not reference any sensitive data.
- Keep each recommendation under 2 sentences.
- Format as a numbered list.`;

  return prompt;
};

/**
 * Generate security recommendations.
 * @param {object} assessment - threat analysis result
 * @param {object} [userContext]
 * @param {string} [language='en']
 * @returns {Promise<Array<{priority:string, action:string, detail:string, source:'ai'|'static'}>>}
 */
export const generateRecommendations = async (assessment = {}, userContext = {}, language = 'en') => {
  try {
    const verdict = assessment.verdict || 'safe';
    const staticRecs = STATIC_RECOMMENDATIONS[verdict] || STATIC_RECOMMENDATIONS.safe;

    let aiRecs = [];
    try {
      const query = `cybersecurity ${verdict} risk recommendations ${(assessment.threats || []).map((t) => t.type).join(' ') || 'general'}`;
      const { context: ragContext } = await retrieveContext(query, { topK: 3, minScore: 0.1 });

      const prompt = buildRecommendationPrompt(assessment, userContext, ragContext);
      const { text, flagged } = sanitizePrompt(prompt);

      if (flagged) {
        logger.warn('[recommendationEngine] Prompt injection flagged in recommendation request');
      }

      const result = await routeAI(text, [], language);
      if (result && result.response) {
        const lines = result.response
          .split('\n')
          .map((l) => l.trim())
          .filter((l) => l.length > 0 && /^\d+\./.test(l));

        aiRecs = lines.map((line, idx) => {
          const cleaned = line.replace(/^\d+\.\s*/, '').trim();
          return {
            priority: idx === 0 ? 'high' : 'medium',
            action: cleaned,
            detail: 'AI-generated recommendation',
            source: 'ai',
          };
        });
      }
    } catch (err) {
      logger.warn('[recommendationEngine] AI recommendation failed, using static only', { error: err.message });
    }

    const combined = [
      ...staticRecs.map((r) => ({ ...r, source: 'static' })),
      ...aiRecs,
    ];

    logger.info('[recommendationEngine] Recommendations generated', {
      count: combined.length,
      aiCount: aiRecs.length,
      verdict,
    });

    return combined;
  } catch (err) {
    logger.error('[recommendationEngine] Failed to generate recommendations', { error: err.message });
    return STATIC_RECOMMENDATIONS.safe.map((r) => ({ ...r, source: 'static' }));
  }
};

export default { generateRecommendations };
