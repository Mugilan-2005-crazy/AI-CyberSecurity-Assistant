/**
 * services/ai/cvssCalculator.js
 * ============================================================
 * Generates CVSS v3.1 base scores and vectors from scan
 * results. Uses heuristic mapping from scanner verdicts
 * and risk scores to approximate CVSS metrics when a
 * full vulnerability database lookup is unavailable.
 */

const SEVERITY_TO_CVSS = {
  Critical: { baseScore: 9.0, vector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:H/A:H' },
  High: { baseScore: 7.5, vector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:L' },
  Medium: { baseScore: 5.0, vector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:U/C:L/I:L/A:L' },
  Low: { baseScore: 2.5, vector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:U/C:N/I:N/A:L' },
};

const RISK_TO_CVSS = {
  malicious: { baseScore: 8.5, vector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:H/A:H' },
  suspicious: { baseScore: 5.5, vector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:U/C:L/I:L/A:L' },
  safe: { baseScore: 1.0, vector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:N' },
  unknown: { baseScore: 3.0, vector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:U/C:N/I:N/A:L' },
};

function mapVerdictToCvss(verdict, riskScore) {
  if (verdict === 'malicious') {
    const adjusted = riskScore >= 80 ? SEVERITY_TO_CVSS.Critical : riskScore >= 50 ? SEVERITY_TO_CVSS.High : SEVERITY_TO_CVSS.Medium;
    return { ...adjusted, adjustedForRisk: true };
  }
  if (verdict === 'suspicious') {
    return { ...SEVERITY_TO_CVSS.Medium, adjustedForRisk: true };
  }
  if (verdict === 'safe') {
    return { ...SEVERITY_TO_CVSS.Low, adjustedForRisk: true };
  }
  return { ...RISK_TO_CVSS.unknown, adjustedForRisk: false };
}

function calculateCvssFromRisk(riskScore, verdict) {
  if (riskScore >= 80) return { ...SEVERITY_TO_CVSS.Critical, adjustedForRisk: true };
  if (riskScore >= 60) return { ...SEVERITY_TO_CVSS.High, adjustedForRisk: true };
  if (riskScore >= 40) return { ...SEVERITY_TO_CVSS.Medium, adjustedForRisk: true };
  if (riskScore >= 20) return { ...SEVERITY_TO_CVSS.Low, adjustedForRisk: true };
  return { ...RISK_TO_CVSS.safe, adjustedForRisk: false };
}

export function generateCvss(scanResult, scanType) {
  const riskScore = scanResult.riskScore ?? 0;
  const verdict = scanResult.verdict ?? 'unknown';

  let cvss;
  if (verdict !== 'unknown' && verdict !== 'safe') {
    cvss = mapVerdictToCvss(verdict, riskScore);
  } else {
    cvss = calculateCvssFromRisk(riskScore, verdict);
  }

  if (scanType === 'password') {
    const passwordScore = riskScore;
    if (passwordScore >= 70) {
      cvss = { ...SEVERITY_TO_CVSS.High, adjustedForRisk: true, reason: 'Weak password detected' };
    } else if (passwordScore >= 40) {
      cvss = { ...SEVERITY_TO_CVSS.Medium, adjustedForRisk: true, reason: 'Moderate password strength' };
    } else {
      cvss = { ...SEVERITY_TO_CVSS.Low, adjustedForRisk: true, reason: 'Strong password' };
    }
  }

  if (scanType === 'email' && scanResult.threats && scanResult.threats.length > 0) {
    cvss = { ...SEVERITY_TO_CVSS.High, adjustedForRisk: true, reason: 'Phishing indicators detected' };
  }

  return {
    cvssScore: cvss.baseScore,
    cvssVector: cvss.vector,
    cvssVersion: '3.1',
    severity: cvss.baseScore >= 9.0 ? 'Critical' : cvss.baseScore >= 7.0 ? 'High' : cvss.baseScore >= 4.0 ? 'Medium' : 'Low',
    reason: cvss.reason || `Auto-generated from ${scanType} scan (risk: ${riskScore}, verdict: ${verdict})`,
    adjustedForRisk: cvss.adjustedForRisk,
  };
}

export default { generateCvss };