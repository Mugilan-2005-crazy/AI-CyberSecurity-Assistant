import { routeAI } from '../ai/aiRouter.js';
import IncidentResponse from '../../models/IncidentResponse.js';
import SecurityIncident from '../../models/SecurityIncident.js';
import mitreMapper from '../security/mitre/mitreMapper.js';
import logger from '../../utils/logger.js';

function buildInvestigationPrompt(incident) {
  const mitreInfo = incident.mitreTechnique?.techniqueId
    ? `MITRE ATT&CK Technique: ${incident.mitreTechnique.techniqueId} - ${incident.mitreTechnique.techniqueName} (Tactic: ${incident.mitreTechnique.tactic})`
    : 'No specific MITRE technique identified.';

  return `Analyze the following security incident and provide an investigation summary, threat severity assessment, and recommended response actions.

Incident Details:
- Threat Type: ${incident.threatType}
- Severity: ${incident.severity}
- Status: ${incident.status}
- ${mitreInfo}
- Description: ${incident.description || 'No description provided'}
- Created At: ${incident.createdAt}

Please respond in JSON format with the following fields:
1. investigationSummary: A brief analysis of what happened and why it matters
2. threatSeverity: Adjusted severity based on investigation (Low/Medium/High/Critical)
3. investigationReasoning: Key findings from the analysis
4. confidenceScore: A score between 0 and 1 indicating confidence in the assessment
5. recommendedActions: Array of action objects with "action", "priority", and "category" fields

Categories for actions must be one of: containment, notification, remediation, monitoring
Priorities for actions must be one of: Low, Medium, High, Critical

Example response format:
{
  "investigationSummary": "...",
  "threatSeverity": "High",
  "investigationReasoning": "...",
  "confidenceScore": 0.85,
  "recommendedActions": [
    {"action": "Block suspicious domain", "priority": "High", "category": "containment"},
    {"action": "Notify affected user", "priority": "High", "category": "notification"}
  ]
}`;
}

async function callAI(prompt) {
  try {
    const result = await routeAI(prompt, [], 'en');
    return { response: result?.response || '', provider: result?.provider || 'none' };
  } catch (err) {
    logger.warn('[incidentResponseAgent] AI call failed, trying RAG fallback', { error: err.message });
    try {
      const ragResult = await generateRAGFallback(prompt);
      return { response: ragResult.answer || '', provider: 'rag' };
    } catch (ragErr) {
      logger.warn('[incidentResponseAgent] RAG fallback also failed', { error: ragErr.message });
      return { response: '', provider: 'none' };
    }
  }
}

async function generateRAGFallback(prompt) {
  const { generateRAGAnswer } = await import('../rag/ragService.js');
  return generateRAGAnswer(prompt, { language: 'en' });
}

function parseAIResponse(response) {
  try {
    if (!response || typeof response !== 'string') return null;

    const jsonMatch = response.match(/\{[\s\S]*\}$/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);

    if (!parsed.investigationSummary && !parsed.recommendedActions) return null;

    return {
      investigationSummary: parsed.investigationSummary || '',
      threatSeverity: parsed.threatSeverity || 'Medium',
      investigationReasoning: parsed.investigationReasoning || '',
      confidenceScore: typeof parsed.confidenceScore === 'number' ? Math.max(0, Math.min(1, parsed.confidenceScore)) : 0.5,
      recommendedActions: Array.isArray(parsed.recommendedActions) ? parsed.recommendedActions : [],
    };
  } catch {
    return null;
  }
}

function fallbackAnalysis(incident) {
  const severity = incident.severity || 'Medium';
  const threatType = incident.threatType || 'Unknown';

  const defaultActions = [
    { action: `Investigate ${threatType} incident`, priority: severity === 'Critical' ? 'Critical' : 'High', category: 'containment' },
    { action: 'Notify security team', priority: 'High', category: 'notification' },
    { action: 'Increase monitoring', priority: 'Medium', category: 'monitoring' },
  ];

  return {
    investigationSummary: `Automated investigation of ${threatType} incident. Severity assessed as ${severity}.`,
    threatSeverity: severity,
    investigationReasoning: `Based on incident type "${threatType}" and severity "${severity}", standard response procedures applied.`,
    confidenceScore: 0.6,
    recommendedActions: defaultActions,
  };
}

function evaluateRisk(incident, analysis) {
  const severityOrder = { Critical: 4, High: 3, Medium: 2, Low: 1 };
  const incidentSeverity = severityOrder[incident.severity] || 2;
  const analysisSeverity = severityOrder[analysis.threatSeverity] || 2;
  const confidence = analysis.confidenceScore || 0.5;

  const combinedScore = (incidentSeverity * 0.6) + (analysisSeverity * 0.4) + (confidence * 0.5);

  if (combinedScore >= 3.5) return { priority: 'Critical', score: combinedScore };
  if (combinedScore >= 2.5) return { priority: 'High', score: combinedScore };
  if (combinedScore >= 1.5) return { priority: 'Medium', score: combinedScore };
  return { priority: 'Low', score: combinedScore };
}

export async function investigateIncident(incidentId, userId) {
  try {
    if (!incidentId) {
      throw new Error('incidentId is required');
    }

    const incident = await SecurityIncident.findById(incidentId).lean();
    if (!incident) {
      throw new Error('Incident not found');
    }

    const prompt = buildInvestigationPrompt(incident);
    logger.info('[incidentResponseAgent] Starting AI investigation', { incidentId, threatType: incident.threatType });

    const aiResult = await callAI(prompt);
    let analysis = aiResult?.response ? parseAIResponse(aiResult.response) : null;

    if (!analysis) {
      logger.warn('[incidentResponseAgent] AI parsing failed, using fallback', { incidentId });
      analysis = fallbackAnalysis(incident);
    }

    const riskLevel = evaluateRisk(incident, analysis);

    const responseDoc = new IncidentResponse({
      incidentId: incident._id,
      userId,
      threatType: incident.threatType,
      mitreTechnique: incident.mitreTechnique || {},
      investigationSummary: analysis.investigationSummary || 'Automated investigation completed.',
      recommendedActions: analysis.recommendedActions || [],
      priority: riskLevel.priority,
      status: 'pending',
      confidenceScore: analysis.confidenceScore || 0.5,
      aiProvider: aiResult?.provider || 'none',
    });

    await responseDoc.save();

    logger.info('[incidentResponseAgent] Investigation completed', {
      incidentId,
      responseId: responseDoc._id,
      priority: riskLevel.priority,
      confidenceScore: analysis.confidenceScore || 0.5,
      provider: aiResult?.provider || 'none',
    });

    return {
      responseId: responseDoc._id,
      incidentId: incident._id,
      investigationSummary: analysis.investigationSummary || 'Automated investigation completed.',
      threatSeverity: analysis.threatSeverity || incident.severity,
      investigationReasoning: analysis.investigationReasoning || 'Standard investigation applied.',
      confidenceScore: analysis.confidenceScore || 0.5,
      recommendedActions: analysis.recommendedActions || [],
      aiProvider: aiResult?.provider || 'none',
    };
  } catch (err) {
    logger.error('[incidentResponseAgent] Investigation failed', { error: err.message, incidentId });
    throw err;
  }
}

export async function getInvestigationResult(responseId) {
  try {
    const response = await IncidentResponse.findById(responseId)
      .populate('approvedBy', 'name email');
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
    logger.error('[incidentResponseAgent] Failed to get investigation result', { error: err.message });
    throw err;
  }
}

export default { investigateIncident, getInvestigationResult };