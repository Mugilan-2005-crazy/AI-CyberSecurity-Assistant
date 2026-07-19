/**
 * services/security/fileScanner.js
 * ============================================================
 * MODULE 4 — File Malware Scanner (SHA-256 + VirusTotal).
 * ------------------------------------------------------------
 * Responsibilities:
 *   1. Compute the SHA-256 hash of the uploaded file buffer
 *      (no file content is ever written to disk).
 *   2. If a VirusTotal API key is configured:
 *        - Look up an existing report by hash (fast path).
 *        - Otherwise upload the file for a fresh analysis and
 *          poll until completed.
 *        - Normalize the verdict + threat stats.
 *   3. If VirusTotal is NOT configured, degrade gracefully and
 *      return a clear "service not configured" response.
 *   4. Never crash on external-service failures: every VirusTotal
 *      call is wrapped so transient errors return a safe result.
 *
 * Design notes:
 *   - Uses the built-in crypto module for hashing (no extra dep).
 *   - Uses global fetch (Node 18+) for VirusTotal HTTP calls.
 *   - All network operations are timeout-guarded where possible.
 */

import crypto from 'crypto';
import config from '../../config/index.js';
import logger from '../../utils/logger.js';

// VirusTotal v3 API base URL.
const VT_BASE = 'https://www.virustotal.com/api/v3';

// Maximum polling attempts while waiting for an upload analysis.
const MAX_POLLS = 10;
const POLL_INTERVAL_MS = 3000;

/* ------------------------------------------------------------------
 * 1. SHA-256 HASHING
 *    Deterministically hashes the in-memory buffer. Identical
 *    files always produce the same hash (enables VT hash lookup).
 * ------------------------------------------------------------------ */
const sha256 = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex');

/* ------------------------------------------------------------------
 * 2. VIRUSTOTAL HTTP HELPER
 *    Thin wrapper that attaches the API key and surfaces errors.
 *    Throws on non-2xx so callers can decide how to degrade.
 * ------------------------------------------------------------------ */
const vtRequest = async (path, options = {}) => {
  const res = await fetch(`${VT_BASE}${path}`, {
    ...options,
    headers: { 'x-apikey': config.virusTotal.apiKey, ...(options.headers || {}) },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`VirusTotal ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json();
};

/* ------------------------------------------------------------------
 * 3. RESULT NORMALIZATION
 *    Converts VirusTotal's last_analysis_stats into a consistent
 *    { hash, riskScore, verdict, stats, detected, total } shape.
 * ------------------------------------------------------------------ */
const normalizeReport = (report, hash) => {
  const attrs = report.data.attributes || {};
  const stats = attrs.last_analysis_stats || attrs.stats || {};
  const total = (stats.malicious || 0) + (stats.suspicious || 0) +
    (stats.undetected || 0) + (stats.harmless || 0);
  const detected = (stats.malicious || 0) + (stats.suspicious || 0);

  // Risk = proportion of engines that flagged the file.
  const riskScore = total ? Math.round((detected / total) * 100) : 0;
  const verdict = detected > 0 ? 'malicious' : 'safe';

  return {
    configured: true,
    hash,
    riskScore,
    verdict,
    stats,
    detected,
    total,
    scanDate: attrs.last_analysis_date || null,
  };
};

/* ------------------------------------------------------------------
 * 4. CORE SCAN FUNCTION
 *    Input : Buffer (uploaded file content)
 *    Output: JSON result (always returned, never throws to caller)
 * ------------------------------------------------------------------ */
export const scanFile = async (buffer) => {
  // 4a. Always hash the file first — cheap and always available.
  const hash = sha256(buffer);

  // 4b. Graceful path: VirusTotal not configured.
  if (!config.virusTotal.apiKey) {
    return {
      configured: false,
      hash,
      message: 'Malware scanning service is not configured.',
      verdict: 'unknown',
      riskScore: 0,
    };
  }

  try {
    // 4c. Fast path: query existing report by hash (no re-upload).
    try {
      const report = await vtRequest(`/files/${hash}`);
      return normalizeReport(report, hash);
    } catch {
      // No existing report — fall through to upload below.
      logger.info(`No VirusTotal report for ${hash}; uploading for analysis.`);
    }

    // 4d. Upload the file for a fresh scan (Node 18+ FormData/fetch).
    const form = new FormData();
    form.append('file', new Blob([buffer]), 'upload.bin');
    const upload = await vtRequest('/files', { method: 'POST', body: form });
    const analysisId = upload?.data?.id;
    if (!analysisId) throw new Error('VirusTotal did not return an analysis id');

    // 4e. Poll the analysis until it completes (or we time out).
    for (let i = 0; i < MAX_POLLS; i++) {
      const analysis = await vtRequest(`/analyses/${analysisId}`);
      if (analysis?.data?.attributes?.status === 'completed') {
        return normalizeReport(analysis, hash);
      }
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    }

    // 4f. Analysis still pending after polling — return pending state.
    return { configured: true, hash, status: 'pending', verdict: 'unknown', riskScore: 0 };
  } catch (err) {
    // 4g. External failure: degrade gracefully, never crash the request.
    logger.error(`VirusTotal scan failed for ${hash}: ${err.message}`);
    return {
      configured: true,
      hash,
      error: 'Malware scan service temporarily unavailable.',
      verdict: 'unknown',
      riskScore: 0,
    };
  }
};

export default { scanFile };
