import gemini from '../security/gemini.js';
import { askOllama } from './ollamaService.js';
import { generateCvss } from './cvssCalculator.js';
import { mapThreatToMITRE } from '../../services/security/mitre/mitreMapper.js';
import AIAnalysis from '../../models/AIAnalysis.js';
import ScanHistory from '../../models/ScanHistory.js';
import logger from '../../utils/logger.js';
import { sanitizePrompt } from '../../utils/sanitizePrompt.js';
import {
  emitAIStarted,
  emitAIProgress,
  emitAICompleted,
  emitAIFailed,
} from '../../socket/realtimeNotificationService.js';

const SYSTEM_PROMPT = `You are "SOC Analyst AI", an enterprise cybersecurity analyst. Analyze security scan results and produce structured SOC reports.

For every analysis you MUST produce:
1. threatScore (0-100): Overall threat severity
2. riskLevel: "Low", "Medium", "High", or "Critical"
3. executiveSummary: 2-3 sentence plain-language summary for executives
4. technicalSummary: Detailed technical findings for analysts
5. rootCause: The underlying cause of the detected threat
6. businessImpact: What this means for the business (data loss, financial, reputational)
7. recommendedActions: Array of specific, actionable remediation steps
8. confidenceScore: 0-1 confidence in the analysis

Always be concise, accurate, and professional. Use structured formatting with clear sections.
If the scan result indicates a safe/low-risk finding, still provide a thorough analysis.
If the scan result is unknown, flag it for further investigation.
Never refuse to analyze a security finding. Always provide actionable output.`;

const GEMINI_PROMPT = (scan) => `Analyze this completed ${scan.type} security scan result and produce a full SOC analyst report.

Scan Data:
- Type: ${scan.type}
- Input: ${scan.input || 'N/A'}
- Risk Score: ${scan.riskScore}/100
- Verdict: ${scan.verdict}
- Details: ${JSON.stringify(scan.details || {}, null, 2)}

Produce a structured JSON response with: threatScore, riskLevel, executiveSummary, technicalSummary, rootCause, businessImpact, recommendedActions (array), confidenceScore.`;

const OLLAMA_PROMPT = (scan) => `You are a SOC analyst. Analyze this ${scan.type} scan result and provide:
1. Threat score (0-100)
2. Risk level (Low/Medium/High/Critical)
3. Executive summary (2-3 sentences)
4. Technical summary
5. Root cause
6. Business impact
7. Recommended actions (numbered list)
8. Confidence score (0-1)

Scan: type=${scan.type}, input=${scan.input || 'N/A'}, riskScore=${scan.riskScore}, verdict=${scan.verdict}, details=${JSON.stringify(scan.details || {})}`;

async function callGemini(scan) {
  try {
    if (!gemini.isConfigured()) return null;
    const prompt = GEMINI_PROMPT(scan);
    const response = await gemini.ask(prompt, [], 'en');
    return { provider: 'gemini', response };
  } catch (err) {
    logger.warn(`[socAnalyzer] Gemini failed: ${err.message}`);
    return null;
  }
}

async function callOllama(scan) {
  try {
    const prompt = OLLAMA_PROMPT(scan);
    const result = await askOllama(prompt, [], 'en');
    if (result.success) {
      return { provider: 'ollama', response: result.response };
    }
    return null;
  } catch (err) {
    logger.warn(`[socAnalyzer] Ollama failed: ${err.message}`);
    return null;
  }
}

function parseAIResponse(text) {
  if (!text) return null;

  const jsonMatch = text.match(/\{[\s\S]*\}$/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch {
      // fall through to text parsing
    }
  }

  const result = {
    threatScore: 0,
    riskLevel: 'Low',
    executiveSummary: '',
    technicalSummary: '',
    rootCause: '',
    businessImpact: '',
    recommendedActions: [],
    confidenceScore: 0.5,
  };

  const lines = text.split('\n');
  let currentSection = null;
  let sectionContent = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const sectionMatch = trimmed.match(/^(?:threatScore|threat\s*score|severity|risk\s*level|risk\s*level|confidence|confidence\s*score|root\s*cause|business\s*impact|executive\s*summary|technical\s*summary|recommended\s*actions?)\s*[:\-]?\s*(.*)/i);
    if (sectionMatch) {
      if (currentSection && sectionContent.length > 0) {
        const value = sectionContent.join(' ').trim();
        assignSection(currentSection, value, result);
      }
      currentSection = sectionMatch[1].trim().toLowerCase().replace(/\s+/g, '');
      sectionContent = [];
      continue;
    }

    if (currentSection) {
      sectionContent.push(trimmed);
    }
  }

  if (currentSection && sectionContent.length > 0) {
    const value = sectionContent.join(' ').trim();
    assignSection(currentSection, value, result);
  }

  result.threatScore = Math.max(0, Math.min(100, result.threatScore || 0));
  result.confidenceScore = Math.max(0, Math.min(1, result.confidenceScore || 0.5));

  const riskLevels = ['Low', 'Medium', 'High', 'Critical'];
  if (!riskLevels.includes(result.riskLevel)) {
    if (result.threatScore >= 70) result.riskLevel = 'Critical';
    else if (result.threatScore >= 40) result.riskLevel = 'High';
    else if (result.threatScore >= 20) result.riskLevel = 'Medium';
    else result.riskLevel = 'Low';
  }

  return result;
}

function assignSection(section, value, result) {
  const s = section.toLowerCase().replace(/\s+/g, '');
  if (s === 'threatscore' || s === 'severity') {
    const num = parseInt(value, 10);
    if (!isNaN(num)) result.threatScore = num;
  } else if (s === 'risklevel') {
    const level = value.replace(/[^a-zA-Z]/g, '');
    const cap = level.charAt(0).toUpperCase() + level.slice(1).toLowerCase();
    if (['Low', 'Medium', 'High', 'Critical'].includes(cap)) result.riskLevel = cap;
  } else if (s === 'confidence' || s === 'confidencescore') {
    const num = parseFloat(value);
    if (!isNaN(num)) result.confidenceScore = Math.max(0, Math.min(1, num));
  } else if (s === 'executivesummary') {
    result.executiveSummary = value;
  } else if (s === 'technicalsummary') {
    result.technicalSummary = value;
  } else if (s === 'rootcause') {
    result.rootCause = value;
  } else if (s === 'businessimpact') {
    result.businessImpact = value;
  } else if (s === 'recommendedactions') {
    const actions = value.split(/[;.\n]+/).map((a) => a.trim()).filter((a) => a.length > 5);
    result.recommendedActions = actions;
  }
}

async function combineGeminiOllama(geminiResult, ollamaResult, scan) {
  const geminiParsed = geminiResult ? parseAIResponse(geminiResult.response) : null;
  const ollamaParsed = ollamaResult ? parseAIResponse(ollamaResult.response) : null;

  if (geminiParsed && ollamaParsed) {
    const combined = { ...geminiParsed };
    if (ollamaParsed.threatScore > geminiParsed.threatScore) {
      combined.threatScore = ollamaParsed.threatScore;
    }
    combined.confidenceScore = Math.min(1, (geminiParsed.confidenceScore || 0.5) + (ollamaParsed.confidenceScore || 0.5) * 0.3);
    combined.aiProvidersUsed = ['gemini', 'ollama'];
    combined.geminiContribution = geminiResult.response;
    combined.ollamaContribution = ollamaResult.response;
    return combined;
  }

  if (geminiParsed) {
    geminiParsed.aiProvidersUsed = ['gemini'];
    geminiParsed.geminiContribution = geminiResult.response;
    return geminiParsed;
  }

  if (ollamaParsed) {
    ollamaParsed.aiProvidersUsed = ['ollama'];
    ollamaParsed.ollamaContribution = ollamaResult.response;
    return ollamaParsed;
  }

  return null;
}

export async function analyzeScan(scanId, userId) {
  let scan;
  try {
    scan = await ScanHistory.findById(scanId);
  } catch (err) {
    logger.error(`[socAnalyzer] Failed to find scan ${scanId}: ${err.message}`);
    emitAIFailed(userId, `scan_${scanId}`, err.message).catch(() => {});
    throw new Error(`Scan not found: ${scanId}`);
  }

  if (!scan) {
    emitAIFailed(userId, `scan_${scanId}`, 'Scan not found').catch(() => {});
    throw new Error(`Scan not found: ${scanId}`);
  }

  const scanData = {
    type: scan.type,
    input: scan.input,
    riskScore: scan.riskScore,
    verdict: scan.verdict,
    details: scan.details,
  };

  const analysisId = `scan_${scanId}`;
  emitAIStarted(userId, analysisId, scanId, scan.type).catch(() => {});
  emitAIProgress(userId, analysisId, 10, 'Initializing analysis').catch(() => {});

  let aiResult = null;
  const providersUsed = [];

  const geminiResult = await callGemini(scanData);
  emitAIProgress(userId, analysisId, 30, 'Gemini analysis complete').catch(() => {});
  if (geminiResult) {
    providersUsed.push('gemini');
    aiResult = geminiResult;
  }

  const ollamaResult = await callOllama(scanData);
  emitAIProgress(userId, analysisId, 70, 'Ollama fallback complete').catch(() => {});
  if (ollamaResult) {
    providersUsed.push('ollama');
    if (aiResult) {
      aiResult = await combineGeminiOllama(geminiResult, ollamaResult, scanData);
    } else {
      aiResult = ollamaResult;
    }
  }

  emitAIProgress(userId, analysisId, 90, 'Generating MITRE & CVSS').catch(() => {});

  if (!aiResult) {
    const fallback = generateFallbackAnalysis(scanData);
    aiResult = { ...fallback, aiProvidersUsed: ['none'], provider: 'fallback' };
  }

  const parsed = aiResult.provider === 'fallback' ? aiResult : parseAIResponse(aiResult.response);
  const analysis = parsed || generateFallbackAnalysis(scanData);

  const cvss = generateCvss(scanData, scan.type);

  const mitreResult = mapThreatToMITRE({
    threats: analysis.recommendedActions.length > 0 ? analysis.recommendedActions : [scanData.verdict],
    overallRiskScore: analysis.threatScore,
  });

  const doc = new AIAnalysis({
    user: userId,
    scanId: scan._id,
    scanType: scan.type,
    scanInput: scan.input || '',
    threatScore: analysis.threatScore,
    riskLevel: analysis.riskLevel,
    confidenceScore: analysis.confidenceScore,
    executiveSummary: analysis.executiveSummary,
    technicalSummary: analysis.technicalSummary,
    rootCause: analysis.rootCause,
    businessImpact: analysis.businessImpact,
    recommendedActions: analysis.recommendedActions,
    mitreTechniques: mitreResult.mitreMatches.map((m) => ({
      techniqueId: m.techniqueId,
      techniqueName: m.technique,
      tactic: m.tactic,
      severity: m.severity,
      confidence: analysis.confidenceScore,
    })),
    cvssScore: cvss.cvssScore,
    cvssVector: cvss.cvssVector,
    cvssVersion: cvss.cvssVersion,
    aiProvider: aiResult.provider || 'none',
    aiProvidersUsed: providersUsed.length > 0 ? providersUsed : ['none'],
    geminiContribution: aiResult.geminiContribution || '',
    ollamaContribution: aiResult.ollamaContribution || '',
    status: 'completed',
    metadata: {
      scanVerdict: scan.verdict,
      scanRiskScore: scan.riskScore,
      cvssReason: cvss.reason,
    },
  });

  await doc.save();
  logger.info(`[socAnalyzer] Analysis saved`, { analysisId: doc._id, scanId, providers: providersUsed });

  emitAICompleted(userId, analysisId, {
    id: doc._id,
    scanId: doc.scanId,
    scanType: doc.scanType,
    threatScore: doc.threatScore,
    riskLevel: doc.riskLevel,
    confidenceScore: doc.confidenceScore,
    executiveSummary: doc.executiveSummary,
    technicalSummary: doc.technicalSummary,
    rootCause: doc.rootCause,
    businessImpact: doc.businessImpact,
    recommendedActions: doc.recommendedActions,
    mitreTechniques: doc.mitreTechniques,
    cvssScore: doc.cvssScore,
    cvssVector: doc.cvssVector,
    aiProvider: doc.aiProvider,
    status: doc.status,
  }).catch(() => {});

  return doc;
}

function generateFallbackAnalysis(scanData) {
  const riskScore = scanData.riskScore || 0;
  let riskLevel = 'Low';
  if (riskScore >= 70) riskLevel = 'Critical';
  else if (riskScore >= 40) riskLevel = 'High';
  else if (riskScore >= 20) riskLevel = 'Medium';

  return {
    threatScore: riskScore,
    riskLevel,
    executiveSummary: `The ${scanData.type} scan detected a ${riskLevel.toLowerCase()} risk level with a score of ${riskScore}/100.`,
    technicalSummary: `Automated analysis of ${scanData.type} scan input "${scanData.input || 'N/A'}" resulted in a ${scanData.verdict} verdict with risk score ${riskScore}.`,
    rootCause: `The ${scanData.verdict} verdict indicates potential security concerns based on heuristic analysis.`,
    businessImpact: `A ${riskLevel.toLowerCase()}-risk finding may impact organizational security posture. Further investigation is recommended.`,
    recommendedActions: [
      'Review the scan details for specific indicators of compromise.',
      'Apply recommended remediation steps based on the scan type.',
      'Monitor for any related security events.',
      'Consider running a secondary scan for verification.',
    ],
    confidenceScore: 0.5,
  };
}

export async function getAnalysisHistory(userId, options = {}) {
  const { page = 1, limit = 20, status, scanType, riskLevel } = options;
  const filter = { user: userId };
  if (status) filter.status = status;
  if (scanType) filter.scanType = scanType;
  if (riskLevel) filter.riskLevel = riskLevel;

  const analyses = await AIAnalysis.find(filter)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(Number(limit));

  const total = await AIAnalysis.countDocuments(filter);

  return {
    analyses: analyses.map((a) => ({
      id: a._id,
      scanId: a.scanId,
      scanType: a.scanType,
      scanInput: a.scanInput,
      threatScore: a.threatScore,
      riskLevel: a.riskLevel,
      confidenceScore: a.confidenceScore,
      executiveSummary: a.executiveSummary,
      recommendedActions: a.recommendedActions,
      mitreTechniques: a.mitreTechniques,
      cvssScore: a.cvssScore,
      aiProvider: a.aiProvider,
      status: a.status,
      createdAt: a.createdAt,
    })),
    total,
    page: Number(page),
    totalPages: Math.ceil(total / limit),
  };
}

export async function getAnalysisById(analysisId, userId) {
  const analysis = await AIAnalysis.findOne({ _id: analysisId, user: userId });
  if (!analysis) return null;
  return analysis;
}

export async function reopenAnalysis(analysisId, userId) {
  const analysis = await AIAnalysis.findOne({ _id: analysisId, user: userId });
  if (!analysis) return null;
  analysis.status = 'reopened';
  await analysis.save();
  return analysis;
}

export async function getAnalysisStats(userId) {
  const total = await AIAnalysis.countDocuments({ user: userId });
  const byRiskLevel = await AIAnalysis.aggregate([
    { $match: { user: userId } },
    { $group: { _id: '$riskLevel', count: { $sum: 1 } } },
  ]);
  const avgThreatScore = await AIAnalysis.aggregate([
    { $match: { user: userId } },
    { $group: { _id: null, avg: { $avg: '$threatScore' } } },
  ]);
  const byScanType = await AIAnalysis.aggregate([
    { $match: { user: userId } },
    { $group: { _id: '$scanType', count: { $sum: 1 } } },
  ]);

  return {
    total,
    byRiskLevel: byRiskLevel.reduce((acc, r) => { acc[r._id] = r.count; return acc; }, {}),
    avgThreatScore: Math.round(avgThreatScore[0]?.avg || 0),
    byScanType: byScanType.reduce((acc, r) => { acc[r._id] = r.count; return acc; }, {}),
  };
}

export default { analyzeScan, getAnalysisHistory, getAnalysisById, reopenAnalysis, getAnalysisStats };