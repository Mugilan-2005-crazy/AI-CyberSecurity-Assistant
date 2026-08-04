import { routeAI } from '../ai/aiRouter.js';
import { correlateThreats } from '../threatIntel/threatCorrelation.js';
import { searchCVE } from '../threatIntel/cveService.js';
import { mapThreatToMITRE } from '../security/mitre/mitreMapper.js';
import { sendEmailNotification } from '../alerts/notificationService.js';
import { runAlertPipeline } from '../alerts/alertEngine.js';
import logger from '../../utils/logger.js';

const INTEGRATION_PROMPT = `
You are a cybersecurity AI assistant. Analyze the following threats, CVEs, MITRE mappings, and correlation results.
Provide a concise, actionable response with:
1. Threat Confidence Score
2. Risk Level
3. Known CVEs
4. MITRE Technique
5. Recommended Response
`;

export async function generateThreatIntelResponse({ scan, incident, user }) {
  try {
    const scans = scan ? [scan] : [];
    const incidents = incident ? [incident] : [];
    const correlation = await correlateThreats({ scans, incidents });

    const prompt = `${INTEGRATION_PROMPT}

Scan Data: ${JSON.stringify(scan || {})}
Incident Data: ${JSON.stringify(incident || {})}
Correlation: ${JSON.stringify({
  confidenceScore: correlation.confidenceScore,
  threatPriority: correlation.threatPriority,
  cveMatches: correlation.cveMatches?.map((c) => c.id),
  mitreMapping: correlation.mitreMapping,
  recommendedEscalation: correlation.recommendedEscalation,
})}
`;

    const aiResponse = await routeAI(prompt, [], user?.language || 'en');

    const enriched = {
      response: aiResponse.response,
      provider: aiResponse.provider,
      threatConfidence: correlation.confidenceScore,
      riskLevel: correlation.threatPriority,
      knownCVEs: correlation.cveMatches?.map((c) => c.id) || [],
      mitreTechnique: correlation.mitreMapping || mapThreatToMITRE({ threats: scans, overallRiskScore: scan?.riskScore || 0, verdict: scan?.verdict || 'unknown' }),
      recommendedResponse: correlation.recommendedEscalation,
      correlation,
    };

    if (correlation.confidenceScore > 0.6) {
      await sendEmailNotification(user?.email || 'security@cybersec.io', correlation.threatPriority, 'Threat Intelligence Alert', enriched.response);
    }

    return enriched;
  } catch (err) {
    logger.error('[threatIntelAIIntegration] Failed', { error: err.message });
    return {
      response: 'Unable to generate threat intelligence response at this time.',
      provider: 'none',
      threatConfidence: 0,
      riskLevel: 'Low',
      knownCVEs: [],
      mitreTechnique: null,
      recommendedResponse: 'monitor',
      error: err.message,
    };
  }
}

export async function generateThreatIntelSummary(user, scans = [], incidents = []) {
  try {
    const correlation = await correlateThreats({ scans, incidents });
    const prompt = `${INTEGRATION_PROMPT}

Correlation Summary: ${JSON.stringify({
  confidenceScore: correlation.confidenceScore,
  threatPriority: correlation.threatPriority,
  cveMatches: correlation.cveMatches?.map((c) => ({ id: c.id, severity: c.severity, cvssScore: c.cvssScore })),
  mitreMapping: correlation.mitreMapping,
  threatAnalysis: correlation.threatAnalysis,
})}
`;

    const aiResponse = await routeAI(prompt, [], user?.language || 'en');

    await runAlertPipeline(user, scans, incidents);

    return {
      summary: aiResponse.response,
      provider: aiResponse.provider,
      correlation,
    };
  } catch (err) {
    logger.error('[threatIntelAIIntegration] Summary failed', { error: err.message });
    return { summary: 'Unable to generate threat intelligence summary.', provider: 'none', error: err.message };
  }
}

export { INTEGRATION_PROMPT };
export default { generateThreatIntelResponse, generateThreatIntelSummary };
