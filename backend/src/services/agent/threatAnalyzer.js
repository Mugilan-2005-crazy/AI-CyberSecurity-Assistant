/**
 * services/agent/threatAnalyzer.js
 * ============================================================
 * MODULE X — Threat Analyzer.
 * ------------------------------------------------------------
 * Analyzes a user's security events (scan history, context)
 * and produces a structured threat assessment:
 *  - Overall risk score (0-100)
 *  - Verdict (safe / low-risk / medium-risk / high-risk / critical)
 *  - Active threats list
 *  - Threat summary string
 *
 * Design:
 *  - Pure logic; no external I/O.
 *  - Reuses ScanHistory-style riskScore and verdict.
 *  - No sensitive raw data is returned.
 */

import logger from '../../utils/logger.js';
import { mapThreatToMITRE } from '../security/mitre/mitreMapper.js';

/** Risk thresholds. */
const THRESHOLDS = {
  CRITICAL: 85,
  HIGH: 70,
  MEDIUM: 50,
  LOW: 25,
};

/**
 * Classify a numeric risk score into a verdict.
 * @param {number} score
 * @returns {string}
 */
const classifyRisk = (score) => {
  if (score >= THRESHOLDS.CRITICAL) return 'critical';
  if (score >= THRESHOLDS.HIGH) return 'high-risk';
  if (score >= THRESHOLDS.MEDIUM) return 'medium-risk';
  if (score >= THRESHOLDS.LOW) return 'low-risk';
  return 'safe';
};

/**
 * Analyze a single scan item and extract threat signals.
 * @param {{ type: string, riskScore: number, verdict: string, createdAt: Date }} scan
 * @returns {{ threat: string, severity: string }}
 */
const analyzeScan = (scan) => {
  const severity = scan.verdict === 'malicious' ? 'high' : scan.verdict === 'suspicious' ? 'medium' : 'low';
  const threat = `${scan.type} scan flagged as ${scan.verdict} (risk ${scan.riskScore}/100)`;
  return { threat, severity };
};

/**
 * Aggregate recent scans into an overall security assessment.
 * @param {Array<{type:string, riskScore:number, verdict:string, createdAt:Date}>} scans
 * @param {object} [userContext]
 * @param {string} [userContext.device]
 * @param {string} [userContext.location]
 * @param {boolean} [includeMitre=false] - Whether to include MITRE ATT&CK mapping
 * @returns {{
 *   overallRiskScore: number,
 *   verdict: string,
 *   threats: Array<{type:string, threat:string, severity:string, timestamp:Date}>,
 *   mitreMapping: object|null,
 *   summary: string
 * }}
 */
export const analyzeThreats = (scans = [], userContext = {}, includeMitre = false) => {
  try {
    if (!Array.isArray(scans) || scans.length === 0) {
      return {
        overallRiskScore: 0,
        verdict: 'safe',
        threats: [],
        mitreMapping: null,
        summary: 'No recent security events detected. Your account activity appears normal.',
      };
    }

    const threats = [];
    let totalRisk = 0;

    for (const scan of scans) {
      const { threat, severity } = analyzeScan(scan);
      threats.push({
        type: scan.type,
        threat,
        severity,
        timestamp: scan.createdAt,
      });
      totalRisk += scan.riskScore || 0;
    }

    const overallRiskScore = Math.min(100, Math.round(totalRisk / scans.length));
    const verdict = classifyRisk(overallRiskScore);

    const maliciousCount = threats.filter((t) => t.severity === 'high').length;
    const suspiciousCount = threats.filter((t) => t.severity === 'medium').length;

    let summary = '';
    if (verdict === 'safe') {
      summary = 'All recent scans returned safe results. No immediate action required.';
    } else if (verdict === 'low-risk') {
      summary = `Minor concerns detected. ${suspiciousCount} suspicious scan(s) found. Review recommended.`;
    } else if (verdict === 'medium-risk') {
      summary = `Moderate risk detected. ${suspiciousCount} suspicious and ${maliciousCount} malicious scan(s) found. Immediate review advised.`;
    } else if (verdict === 'high-risk') {
      summary = `High risk detected. ${maliciousCount} malicious scan(s) found. Take immediate action to secure your accounts and devices.`;
    } else {
      summary = `Critical risk detected. ${maliciousCount} malicious scan(s) found. Urgent intervention required.`;
    }

    const assessment = {
      overallRiskScore,
      verdict,
      threats,
      summary,
      mitreMapping: includeMitre ? mapThreatToMITRE({ threats, overallRiskScore, verdict }) : null,
      meta: {
        totalScansAnalyzed: scans.length,
        maliciousCount,
        suspiciousCount,
        device: userContext.device || 'unknown',
        location: userContext.location || 'unknown',
      },
    };

    logger.info('[threatAnalyzer] Assessment generated', {
      overallRiskScore,
      verdict,
      threatCount: threats.length,
      mitreMapping: includeMitre ? assessment.mitreMapping.matchCount : 0,
    });

    return assessment;
  } catch (err) {
    logger.error('[threatAnalyzer] Analysis failed', { error: err.message });
    return {
      overallRiskScore: 0,
      verdict: 'safe',
      threats: [],
      mitreMapping: null,
      summary: 'Unable to analyze security events at this time. Please try again later.',
    };
  }
};

export default { analyzeThreats };
