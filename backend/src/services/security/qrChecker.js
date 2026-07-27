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

  if (!text) {
    return { decoded: true, content: '', riskScore: 100, verdict: 'malicious', reason: 'QR contained no readable content.' };
  }

  const schemeMatch = text.match(/^([a-z0-9]+):/i);
  const scheme = schemeMatch ? schemeMatch[1].toLowerCase() : (text.startsWith('http') ? 'http' : '');

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

  if (/^https?:\/\//i.test(text)) {
    const result = scanUrl(text);
    const isHttps = result.ssl === true;
    const isMalicious = result.verdict === 'malicious';
    const isSuspicious = result.verdict === 'suspicious';

    let riskScore = result.riskScore;
    let verdict = result.verdict;
    const warnings = [...(result.checks?.urlShortener ? ['URL shortener detected'] : []), ...(result.checks?.brandImpersonation ? ['Possible brand impersonation'] : [])];

    if (isMalicious) {
      riskScore = 85;
      verdict = 'malicious';
    } else if (isSuspicious) {
      riskScore = Math.max(riskScore, 60);
      verdict = 'suspicious';
    } else if (!isHttps) {
      riskScore = 45;
      verdict = 'suspicious';
      warnings.push('HTTP: no encryption');
    }

    const reason = isMalicious
      ? 'Malicious URL detected. This site is flagged as dangerous.'
      : isSuspicious
        ? 'Suspicious URL detected. Exercise caution.'
        : isHttps
          ? 'Secure HTTPS connection detected.'
          : 'Website does not use HTTPS encryption. Avoid entering sensitive information.';

    const recommendation = isMalicious
      ? 'Do not visit this site. It may steal data or infect your device.'
      : isSuspicious
        ? 'Avoid entering passwords, payment details, or personal info on this site.'
        : isHttps
          ? 'The connection appears secure.'
          : 'Use caution. Avoid entering sensitive information on this site.';

    return {
      decoded: true,
      content: text,
      ...result,
      riskScore,
      verdict,
      reason,
      warnings: warnings.length ? warnings : undefined,
      recommendation,
    };
  }

  const lowerText = text.toLowerCase();
  const browserWarningPatterns = [
    /your connection to this site is not secure/i,
    /your connection is not private/i,
    /this site is not secure/i,
    /connection not secure/i,
    /privacy error/i,
    /certificate error/i,
    /ssl error/i,
    /https warning/i,
  ];

  const looksLikeBrowserWarning = browserWarningPatterns.some((p) => p.test(lowerText));

  if (looksLikeBrowserWarning) {
    return {
      decoded: true,
      content: text,
      scheme,
      riskScore: 50,
      verdict: 'suspicious',
      reason: 'Browser security warning detected in QR content. This may indicate a phishing attempt.',
      warnings: ['Contains browser security warning text'],
      recommendation: 'Do not trust this QR code. It may be attempting to scare you into visiting a malicious site.',
    };
  }

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
