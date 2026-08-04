import { routeAI } from '../ai/aiRouter.js';
import logger from '../../utils/logger.js';

export async function generateAnomalyExplanation(anomaly) {
  try {
    const prompt = `You are an enterprise UEBA (User Entity Behavior Analytics) security analyst.

Analyze the following behavioral anomaly detected for a user and provide a structured response. Be concise and technical but accessible to a security analyst.

ANOMALY DETAILS:
- Type: ${anomaly.eventType || anomaly.type}
- Severity: ${anomaly.severity}
- Risk Score: ${anomaly.riskScore}/100
- Description: ${anomaly.description}
- User ID: ${anomaly.userId || 'unknown'}
- Detected At: ${anomaly.createdAt || anomaly.detectedAt || new Date().toISOString()}

DETECTION EVIDENCE:
${JSON.stringify(anomaly.details || anomaly, null, 2)}

Please provide:
1. Explanation: Why this behavior is abnormal (compare against normal baseline patterns) — 2-3 sentences.
2. Threat Possibility: What threat or adversary technique this indicates (e.g., stolen credentials, insider threat, automated attack) — 1-2 sentences.
3. Attack Scenario: A likely attack scenario that would produce this pattern — 2-3 sentences.
4. Recommended Action: Specific, actionable steps a security analyst should take to investigate or remediate — 3-5 bullet points.

Format your response as plain text with clear section labels.`;

    const result = await routeAI(prompt, [], 'en');

    const explanation = {
      explanation: extractSection(result.response, 'Explanation'),
      threatPossibility: extractSection(result.response, 'Threat Possibility'),
      attackScenario: extractSection(result.response, 'Attack Scenario'),
      recommendedAction: extractSection(result.response, 'Recommended Action'),
      provider: result.provider,
    };

    logger.info('[anomalyExplanation] Explanation generated', { userId: anomaly.userId, provider: result.provider });
    return explanation;
  } catch (err) {
    logger.error('[anomalyExplanation] Failed to generate explanation', { error: err.message, eventType: anomaly.eventType });
    return {
      explanation: 'Unable to generate AI explanation at this time. The anomaly detection indicates behavior outside established baselines.',
      threatPossibility: 'Possibly credential compromise or automated attack behavior.',
      attackScenario: 'An attacker may have gained access to user credentials and is performing actions that deviate from normal behavior.',
      recommendedAction: '- Investigate the user activity timeline\n- Verify recent login locations and devices\n- Consider resetting the user password\n- Review associated alerts and incidents',
      provider: 'none',
    };
  }
}

function extractSection(text, label) {
  if (!text) return '';
  const patterns = [
    new RegExp(`${label}:\\s*\\n([\\s\\S]*?)(?=\\n\\d+\\.|\\n\\n|\\n[A-Z][a-zA-Z ]+:|$)`, 'i'),
    new RegExp(`${label}[:\\s]+([\\s\\S]*?)(?=\\n\\d+\\.|\\n\\n|$)`, 'i'),
  ];
  for (const p of patterns) {
    const match = text.match(p);
    if (match && match[1]) return match[1].trim();
  }
  return '';
}

export default { generateAnomalyExplanation };
