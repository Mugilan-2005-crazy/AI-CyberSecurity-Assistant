/**
 * services/scanService.js
 * ============================================================
 * MODULE 1 (support) — Scan history persistence.
 * ------------------------------------------------------------
 * Records a scan into the ScanHistory collection. If MongoDB is
 * unavailable, it logs a warning and returns null instead of
 * throwing, so the scan API still returns its result to the user.
 */

import ScanHistory from '../models/ScanHistory.js';
import Notification from '../models/Notification.js';
import logger from '../utils/logger.js';

/**
 * Persist a completed scan.
 * @param {string} userId  - authenticated user id
 * @param {string} type    - 'url' | 'password' | 'email' | 'file' | 'qr'
 * @param {string} input   - (optionally redacted) scanned target
 * @param {object} result  - scanner output containing riskScore + verdict
 * @param {string} ip      - request IP for auditing
 * @returns {Promise<object|null>} the saved doc, or null on DB failure
 */
export const recordScan = async (userId, type, input, result, ip) => {
  const riskScore = result.riskScore ?? 0;
  const verdict = result.verdict ?? 'unknown';

  try {
    // Write the history row atomically.
    const scan = await ScanHistory.create({ user: userId, type, input, riskScore, verdict, details: result, ip });

    // If the result is a threat, push an in-app notification.
    if (verdict === 'malicious' || verdict === 'suspicious') {
      await Notification.create({
        user: userId,
        title: 'Threat detected',
        message: `Your ${type} scan flagged a ${verdict} result (risk ${riskScore}/100).`,
        type: verdict === 'malicious' ? 'danger' : 'warning',
      });
    }
    return scan;
  } catch (err) {
    // Graceful degradation: do not crash the request if the DB is down.
    logger.warn(`Scan history unavailable (${err.message}) — continuing without persistence.`);
    return null;
  }
};

export default { recordScan };
