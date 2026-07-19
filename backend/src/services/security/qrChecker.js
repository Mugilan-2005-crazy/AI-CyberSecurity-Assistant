/**
 * services/security/qrChecker.js
 * ============================================================
 * MODULE 6 — QR Code Safety Checker (analysis logic).
 * ------------------------------------------------------------
 * Takes already-decoded QR text and produces a safety verdict:
 *   - Empty/invalid text -> malicious (can't trust).
 *   - Action URIs (tel:, sms:, wifi:, mailto:, geo:) -> flagged:
 *     these can trigger phone calls/SMS silently.
 *   - http(s) URLs -> delegated to the EXISTING urlScanner service
 *     (no duplicated logic) for protocol/TLD/keyword risk scoring.
 *   - Plain text -> safe display + lightweight suspicious-pattern
 *     warnings (e.g. looks like a card number or credential blob).
 *
 * This module contains NO image decoding — decoding lives in
 * qrDecoder.js so concerns stay separated.
 */
import { scanUrl } from './urlScanner.js';

// URI schemes that perform an action rather than open a resource.
const ACTION_SCHEMES = ['tel', 'smsto', 'smi', 'sms', 'geo', 'mailto', 'wifi', 'Facetime'];

// Lightweight patterns that may indicate sensitive/plaintext leaks.
const SUSPICIOUS_TEXT_PATTERNS = [
  { label: 'Possible card number', re: /\b(?:\d[ -]*?){13,16}\b/ },
  { label: 'Possible SSN', re: /\b\d{3}-\d{2}-\d{4}\b/ },
  { label: 'Possible credential pair', re: /(password|passwd|pwd)\s*[:=]/i },
];

export const checkQr = (decodedText) => {
  const text = (decodedText || '').trim();

  // 1. No usable content -> untrustworthy.
  if (!text) {
    return { decoded: true, content: '', riskScore: 100, verdict: 'malicious', reason: 'QR contained no readable content.' };
  }

  // 2. Detect the scheme (if any). Default to http for bare URLs.
  const schemeMatch = text.match(/^([a-z0-9]+):/i);
  const scheme = schemeMatch ? schemeMatch[1].toLowerCase() : (text.startsWith('http') ? 'http' : '');

  // 3. Action schemes can trigger calls/SMS without user review.
  if (ACTION_SCHEMES.includes(scheme)) {
    return {
      decoded: true,
      content: text,
      scheme,
      riskScore: 70,
      verdict: 'suspicious',
      reason: `QR triggers an action via "${scheme}:" — verify before acting.`,
    };
  }

  // 4. URL -> reuse the existing URL Scanner (no logic duplication).
  if (/^https?:\/\//i.test(text)) {
    const result = scanUrl(text);
    return { decoded: true, content: text, ...result };
  }

  // 5. Plain text -> safe display + suspicious-pattern scan.
  const warnings = SUSPICIOUS_TEXT_PATTERNS
    .filter((p) => p.re.test(text))
    .map((p) => p.label);

  return {
    decoded: true,
    content: text,
    scheme,
    riskScore: warnings.length ? 40 : 10,
    verdict: warnings.length ? 'suspicious' : 'safe',
    warnings,
    reason: warnings.length
      ? 'Plain text QR with potentially sensitive patterns.'
      : 'Plain text / non-actionable QR content.',
  };
};

export default { checkQr };
