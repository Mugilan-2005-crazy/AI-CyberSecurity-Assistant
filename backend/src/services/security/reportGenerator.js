/**
 * services/security/reportGenerator.js
 * ============================================================
 * MODULE 7 (service layer) — Security Report Generator.
 * ------------------------------------------------------------
 * Aggregates the user's scan history across all five security
 * modules (URL, password, email, file, QR) into a single,
 * comprehensive report:
 *   - Overall Security Score (0–100).
 *   - Per-module summary with a risk level
 *     (Safe / Low / Medium / High / Critical).
 *   - Scan timestamps.
 *   - Actionable recommendations derived from detected issues.
 *
 * Design:
 *   - Pure function `buildReport(scans)` — given an array of
 *     ScanHistory docs it produces the report object. Keeping it
 *     pure means it works even if the DB is unavailable (the
 *     caller simply supplies an empty/in-memory array).
 *   - No duplication: it reads the already-stored `riskScore`,
 *     `verdict` and `details` from each module's scan record.
 */

// The five modules this report covers, in display order.
const MODULES = ['url', 'password', 'email', 'file', 'qr'];

const MODULE_LABELS = {
  url: 'URL Scanner',
  password: 'Password Analyzer',
  email: 'Email Phishing Detector',
  file: 'File Malware Scanner',
  qr: 'QR Code Safety Checker',
};

/**
 * Map a 0–100 risk score to a human risk level.
 * Lower risk = safer, so the score here is the THREAT score.
 */
const riskLevel = (threatScore) => {
  if (threatScore >= 80) return 'Critical';
  if (threatScore >= 60) return 'High';
  if (threatScore >= 35) return 'Medium';
  if (threatScore >= 15) return 'Low';
  return 'Safe';
};

/**
 * Build recommendations from the detected issues across modules.
 * Each module contributes targeted advice when it found risk.
 */
const buildRecommendations = (moduleSummaries) => {
  const recs = [];
  for (const m of moduleSummaries) {
    if (m.avgThreatScore >= 35) {
      switch (m.type) {
        case 'url':
          recs.push('Avoid the flagged URLs; only visit sites over HTTPS and verify the domain.'); break;
        case 'password':
          recs.push('Strengthen weak passwords: use 16+ char unique passwords via a password manager.'); break;
        case 'email':
          recs.push('Treat flagged emails as phishing: do not click links or share credentials.'); break;
        case 'file':
          recs.push('Quarantine the flagged file and scan it with your endpoint protection before opening.'); break;
        case 'qr':
          recs.push('Do not act on flagged QR codes (calls/SMS/links) without verifying the source.'); break;
        default: break;
      }
    }
  }
  if (recs.length === 0) {
    recs.push('No significant threats detected. Maintain good hygiene: MFA, updates, and unique passwords.');
  }
  return recs;
};

/**
 * Build the full report object from scan records.
 * @param {Array} scans - ScanHistory documents (any length, incl. 0)
 * @returns {object} structured report (no DB dependency)
 */
export const buildReport = (scans = []) => {
  // 1. Group scans by module type.
  const byType = MODULES.map((type) => scans.filter((s) => s.type === type));

  // 2. Per-module summary with threat score + risk level.
  const moduleSummaries = MODULES.map((type, i) => {
    const group = byType[i];
    const count = group.length;
    const avgThreat = count
      ? Math.round(group.reduce((s, x) => s + (x.riskScore || 0), 0) / count)
      : 0;
    // Latest scan timestamp for this module (or null).
    const latest = group.length ? group[0].createdAt : null;
    const worstVerdict = group.some((s) => s.verdict === 'malicious')
      ? 'malicious'
      : group.some((s) => s.verdict === 'suspicious')
        ? 'suspicious'
        : group.length
          ? 'safe'
          : 'none';

    return {
      type,
      label: MODULE_LABELS[type],
      scans: count,
      avgThreatScore: avgThreat,
      riskLevel: riskLevel(avgThreat),
      latestScan: latest,
      worstVerdict,
    };
  });

  // 3. Overall Security Score:
  //    100 minus the average THREAT score across all scans.
  //    More/riskier scans => lower security score.
  const totalThreat = scans.reduce((s, x) => s + (x.riskScore || 0), 0);
  const overallThreat = scans.length ? Math.round(totalThreat / scans.length) : 0;
  const securityScore = Math.max(0, Math.min(100, 100 - overallThreat));

  // 4. Threats detected (malicious + suspicious counts).
  const threatsDetected = scans.filter((s) => s.verdict === 'malicious' || s.verdict === 'suspicious').length;

  // 5. Recommendations based on detected issues.
  const recommendations = buildRecommendations(moduleSummaries);

  return {
    generatedAt: new Date().toISOString(),
    securityScore,
    overallRiskLevel: riskLevel(overallThreat),
    totalScans: scans.length,
    threatsDetected,
    modules: moduleSummaries,
    recommendations,
  };
};

export default { buildReport, riskLevel };
