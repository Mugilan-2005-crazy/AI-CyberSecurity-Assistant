import logger from '../../../utils/logger.js';
import mitreDatabase from './mitreDatabase.js';

function inferTechniqueFromThreat(threat) {
  if (!threat || typeof threat !== 'object') return null;

  const threatLower = JSON.stringify(threat).toLowerCase();
  const matches = [];

  for (const technique of mitreDatabase.getAllTechniques()) {
    const nameTokens = technique.techniqueName.toLowerCase().split(/\s+/);
    const tacticTokens = technique.tactic.toLowerCase().split(/\s+/);
    const descriptionTokens = technique.description.toLowerCase().split(/\s+/);

    const allTokens = [...nameTokens, ...tacticTokens, ...descriptionTokens];

    if (allTokens.some((token) => threatLower.includes(token))) {
      matches.push(technique);
    }
  }

  if (matches.length === 0) return null;
  if (matches.length === 1) return buildMitreResult(matches[0]);

  matches.sort((a, b) => {
    const severityOrder = { Critical: 4, High: 3, Medium: 2, Low: 1 };
    return (severityOrder[b.severity] || 0) - (severityOrder[a.severity] || 0);
  });

  return buildMitreResult(matches[0]);
}

function buildMitreResult(technique) {
  return {
    techniqueId: technique.techniqueId,
    technique: technique.techniqueName,
    tactic: technique.tactic,
    severity: technique.severity,
  };
}

export function mapThreatToMITRE(threatAnalysis) {
  try {
    if (!threatAnalysis || typeof threatAnalysis !== 'object') {
      return { mitreMatches: [], summary: 'No threat analysis provided.' };
    }

    const threats = threatAnalysis.threats || [];
    const mitreMatches = [];

    for (const threat of threats) {
      const mapped = inferTechniqueFromThreat(threat);
      if (mapped) {
        mitreMatches.push({ ...mapped, matchedThreat: threat.threat || threat.type });
      }
    }

    if (threatAnalysis.overallRiskScore !== undefined) {
      const riskScore = threatAnalysis.overallRiskScore;
      if (riskScore >= 70) {
        const highTechniques = mitreDatabase.getAllTechniques().filter((t) => t.severity === 'High' || t.severity === 'Critical');
        for (const technique of highTechniques) {
          if (!mitreMatches.some((m) => m.techniqueId === technique.techniqueId)) {
            mitreMatches.push(buildMitreResult(technique));
          }
        }
      }
    }

    const summary = mitreMatches.length > 0
      ? `Mapped ${mitreMatches.length} MITRE ATT&CK technique(s) to detected threats.`
      : 'No MITRE ATT&CK techniques matched the current threat analysis.';

    logger.info('[mitreMapper] Threat mapping completed', { matchCount: mitreMatches.length });

    return { mitreMatches, summary };
  } catch (err) {
    logger.error('[mitreMapper] Mapping failed', { error: err.message });
    return { mitreMatches: [], summary: 'MITRE mapping service unavailable.' };
  }
}

export function getMappedTechnique(techniqueId) {
  return mitreDatabase.getTechniqueSummary(techniqueId);
}

export default { mapThreatToMITRE, getMappedTechnique };