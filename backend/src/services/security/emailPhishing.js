/**
 * services/security/emailPhishing.js
 * ============================================================
 * MODULE 3 — Email Phishing Detector (heuristic + optional AI).
 * ------------------------------------------------------------
 * Responsibilities:
 *   1. Parse sender (display name + address) and detect spoofing.
 *   2. Detect urgency / fear language ("act now", "suspended").
 *   3. Detect credential-harvesting requests (login, OTP, etc.).
 *   4. Detect suspicious links: IP-literal hosts, mismatched
 *      anchor text vs real href, known URL shorteners.
 *   5. Detect suspicious attachment types (metadata only — no
 *      file content is read or stored).
 *   6. Compute a 0–100 phishing risk score + verdict.
 *   7. Optionally ask Gemini for a plain-language explanation,
 *      degrading gracefully when no API key is configured.
 *
 * Design notes:
 *   - Pure heuristic function is synchronous and testable.
 *   - AI explanation is opt-in via the `?ai=true` query param.
 *   - No new dependencies; URL parsing uses the built-in URL.
 */

import gemini from './gemini.js';
import config from '../../config/index.js';

/* ------------------------------------------------------------------
 * 1. INTELLIGENCE LISTS
 *    Curated signal dictionaries used by the heuristics below.
 * ------------------------------------------------------------------ */

// Language that creates false urgency or fear (phishing hallmark).
const URGENCY_PHRASES = [
  'urgent', 'immediately', 'verify your account', 'has been suspended',
  'will be locked', 'act now', 'limited time', 'final notice',
  'confirm your identity', 'security alert', 'unusual activity',
];

// Phrases that request credentials or sensitive data.
const CREDENTIAL_PHRASES = [
  'login', 'sign in', 'enter your password', 'update your payment',
  'bank details', 'social security', 'otp', 'verify identity',
  'confirm your password', 'secure form',
];

// High-value brands commonly impersonated in phishing lures.
const BRANDS = ['paypal', 'microsoft', 'apple', 'google', 'amazon', 'netflix', 'bank', 'irs', 'dhl', 'fedex'];

// File extensions that are frequently abused to deliver malware.
// Checked against attachment metadata ONLY (filename), never opened.
const SUSPICIOUS_ATTACHMENTS = new Set(['.exe', '.scr', '.vbs', '.js', '.jar', '.bat', '.cmd', '.ps1', '.docm', '.xlsm']);

// URL shorteners that hide the true destination.
const URL_SHORTENERS = new Set(['bit.ly', 'tinyurl.com', 'goo.gl', 't.co', 'ow.ly', 'cutt.ly', 'rb.gy']);

// Local edit-distance (kept here to avoid coupling with urlScanner).
const levenshtein = (a, b) => {
  const dp = Array.from({ length: a.length + 1 }, () => [0, ...Array(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    dp[i][0] = i;
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return dp[a.length][b.length];
};

// Risk weights (points added per flagged signal), centralized.
const WEIGHTS = {
  SPOOF: 30,        // sender domain mismatch vs brand mention
  PER_URGENCY: 8,   // each urgency phrase (capped)
  URGENCY_CAP: 30,
  PER_CREDENTIAL: 6, // each credential phrase (capped)
  CREDENTIAL_CAP: 20,
  PER_MISMATCH: 10, // each anchor/href mismatch (capped)
  MISMATCH_CAP: 20,
  IP_LINK: 15,      // link uses a raw IP address
  SHORTENER: 10,    // link uses a URL shortener
  SUSPICIOUS_ATTACH: 25,
  MALICIOUS: 70,    // score >= this => malicious
  SUSPICIOUS: 30,   // score >= this => suspicious, else safe
};

/* ------------------------------------------------------------------
 * 2. SENDER PARSING
 *    Accepts either "Name <addr@domain.com>" or just an address.
 *    Returns { raw, displayName, address, domain }.
 * ------------------------------------------------------------------ */
const parseSender = (sender = '') => {
  // Match the <...> address portion if present.
  const match = String(sender).match(/<(.+?)>/);
  const address = match ? match[1] : String(sender).trim();
  const displayName = match ? String(sender).slice(0, match.index).replace(/["']/g, '').trim() : '';
  const domain = (address.split('@')[1] || '').toLowerCase();
  return { raw: sender, displayName, address, domain };
};

/* ------------------------------------------------------------------
 * 3. LINK EXTRACTION + ANALYSIS
 *    Pulls <a href="...">anchor</a> pairs and flags mismatches
 *    between the visible text and the real destination, plus
 *    IP-literal hosts and shorteners.
 * ------------------------------------------------------------------ */
const analyzeLinks = (htmlOrText) => {
  const links = [];
  // Match anchors: href="URL" ... >LABEL< (covers most email HTML).
  const regex = /href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = regex.exec(htmlOrText)) !== null) {
    let href = m[1];
    const label = m[2].replace(/<[^>]+>/g, '').trim().toLowerCase(); // strip inner tags
    if (!/^https?:\/\//i.test(href)) href = 'http://' + href.replace(/^\/\//, '');
    let host = '';
    try { host = new URL(href).hostname.toLowerCase(); } catch { /* ignore malformed */ }

    const isIp = /^(\d{1,3}\.){3}\d{1,3}$/.test(host);
    const isShortener = URL_SHORTENERS.has(host) || [...URL_SHORTENERS].some((s) => host.endsWith('.' + s));
    // Mismatch: label looks like a host but differs from the real host.
    const labelHost = label.match(/([a-z0-9.-]+\.[a-z]{2,})/i)?.[1]?.toLowerCase();
    const mismatched = Boolean(labelHost) && labelHost !== host;

    links.push({ href, label, host, isIp, isShortener, mismatched });
  }
  return links;
};

/* ------------------------------------------------------------------
 * 4. CORE HEURISTIC ANALYSIS
 *    Input : { subject, body, sender, attachments? }
 *    Output: detailed JSON result (no raw content echoed back)
 * ------------------------------------------------------------------ */
export const analyzeEmail = ({ subject = '', body = '', sender = '', attachments = [] } = {}) => {
  // 4a. Normalize text for case-insensitive matching.
  const text = `${subject}\n${body}`.toLowerCase();

  // 4b. Initialize checks map + running score.
  const checks = {};
  let score = 0;

  // 4c. Sender & impersonation analysis.
  const from = parseSender(sender);
  checks.senderDomain = from.domain;
  // Brand mentioned in the body whose sender domain doesn't contain it.
  // Use word-boundary matching to avoid substring false positives
  // (e.g. "irs" inside "attached").
  const mentionedBrand = BRANDS.find((b) => new RegExp(`\\b${b}\\b`, 'i').test(text));
  const brandMismatch = mentionedBrand && from.domain && !from.domain.includes(mentionedBrand);
  // Sender domain is a typosquat: a label within it is a near-match
  // (edit distance <=2) of a brand, but the domain is not the brand's.
  const labels = from.domain ? from.domain.split('.') : [];
  const typosquatBrand = BRANDS.find(
    (b) => from.domain !== `${b}.com` && labels.some((l) => levenshtein(l, b) <= 2)
  );
  const spoofed = brandMismatch || Boolean(typosquatBrand);
  checks.possibleSpoof = spoofed ? (typosquatBrand || mentionedBrand) : null;
  if (spoofed) score += WEIGHTS.SPOOF;

  // 4d. Urgency / fear language.
  const urgency = URGENCY_PHRASES.filter((p) => text.includes(p));
  checks.urgencyLanguage = urgency;
  score += Math.min(urgency.length * WEIGHTS.PER_URGENCY, WEIGHTS.URGENCY_CAP);

  // 4e. Credential-harvesting requests.
  const cred = CREDENTIAL_PHRASES.filter((p) => text.includes(p));
  checks.credentialRequests = cred;
  score += Math.min(cred.length * WEIGHTS.PER_CREDENTIAL, WEIGHTS.CREDENTIAL_CAP);

  // 4f. Link analysis (mismatches, IP hosts, shorteners).
  const links = analyzeLinks(body);
  const mismatched = links.filter((l) => l.mismatched);
  const ipLinks = links.filter((l) => l.isIp);
  const shortLinks = links.filter((l) => l.isShortener);
  checks.mismatchedLinks = mismatched.length;
  checks.ipLinks = ipLinks.length;
  checks.shortenerLinks = shortLinks.length;
  score += Math.min(mismatched.length * WEIGHTS.PER_MISMATCH, WEIGHTS.MISMATCH_CAP);
  if (ipLinks.length) score += WEIGHTS.IP_LINK;
  if (shortLinks.length) score += WEIGHTS.SHORTENER;

  // 4g. Suspicious attachment types (metadata only).
  const badAttach = (Array.isArray(attachments) ? attachments : [])
    .map((a) => (typeof a === 'string' ? a : a?.name || ''))
    .filter((name) => SUSPICIOUS_ATTACHMENTS.has(name.toLowerCase().slice(name.lastIndexOf('.'))));
  checks.suspiciousAttachments = badAttach;
  if (badAttach.length) score += WEIGHTS.SUSPICIOUS_ATTACH;

  // 4h. Clamp + verdict band.
  score = Math.max(0, Math.min(100, score));
  const verdict = score >= WEIGHTS.MALICIOUS ? 'malicious' : score >= WEIGHTS.SUSPICIOUS ? 'suspicious' : 'safe';

  // 4i. Human-readable threat list with reasons.
  const threats = [];
  if (spoofed) threats.push(`Possible brand impersonation of "${mentionedBrand}" from domain "${from.domain}".`);
  if (urgency.length) threats.push(`Urgency/fear language detected (${urgency.length} phrase(s)).`);
  if (cred.length) threats.push(`Credential-harvesting language detected (${cred.length} phrase(s)).`);
  if (mismatched.length) threats.push(`${mismatched.length} link(s) with mismatched display text vs destination.`);
  if (ipLinks.length) threats.push(`${ipLinks.length} link(s) point to raw IP addresses.`);
  if (shortLinks.length) threats.push(`${shortLinks.length} shortened link(s) hide the destination.`);
  if (badAttach.length) threats.push(`Suspicious attachment type(s): ${badAttach.join(', ')}.`);

  return {
    sender: from.domain ? from.raw : sender,
    riskScore: score,
    verdict,
    spam: score >= WEIGHTS.SUSPICIOUS,
    isPhishing: score >= WEIGHTS.MALICIOUS,
    threats,
    checks,
  };
};

/* ------------------------------------------------------------------
 * 5. OPTIONAL AI EXPLANATION (Gemini)
 *    Adds a plain-language explanation. If Gemini is not
 *    configured (or errors), we degrade gracefully and return
 *    the standard heuristic result with aiEnabled:false.
 * ------------------------------------------------------------------ */
export const explainEmailThreat = async (input) => {
  const base = analyzeEmail(input);
  if (!config.gemini.apiKey || !gemini.isConfigured()) {
    return { ...base, aiEnabled: false, explanation: null };
  }
  try {
    const prompt =
      'You are a cybersecurity analyst. In plain language for a non-technical user, ' +
      `explain why the following email scored ${base.riskScore}/100 for phishing risk. ` +
      'Cite the specific red flags. Keep it under 150 words.\n\n' +
      `SUBJECT: ${input.subject || ''}\nFROM: ${input.sender || ''}\n\nBODY:\n${input.body || ''}`;
    const explanation = await gemini.ask(prompt);
    return { ...base, aiEnabled: true, explanation };
  } catch (err) {
    // Graceful: never crash the request because the AI failed.
    return { ...base, aiEnabled: false, explanation: null, aiError: err.message };
  }
};

export default { analyzeEmail, explainEmailThreat };
