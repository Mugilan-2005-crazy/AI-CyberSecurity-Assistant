/**
 * services/security/urlScanner.js
 * ============================================================
 * MODULE 1 — URL Security Scanner (pure logic, no Express).
 * ------------------------------------------------------------
 * Responsibilities:
 *   1. Validate & parse the URL safely (no external calls).
 *   2. Check the protocol (HTTP vs HTTPS / SSL).
 *   3. Detect suspicious TLDs, URL shorteners, IP-literal hosts.
 *   4. Detect brand impersonation (typosquatting).
 *   5. Detect phishing keywords in the path.
 *   6. Compute a 0–100 Risk Score and a verdict.
 *   7. Return a detailed, serializable JSON result.
 *
 * Design notes:
 *   - Pure function: deterministic, easy to unit test, no I/O.
 *   - No third-party deps; uses the built-in WHATWG URL parser.
 *   - Thresholds are centralized in THRESHOLDS for easy tuning.
 */

/* ------------------------------------------------------------------
 * 1. STATIC INTELLIGENCE LISTS
 *    Kept module-local so they are cheap and easy to extend.
 * ------------------------------------------------------------------ */

// TLDs commonly abused in phishing/malware campaigns.
const SUSPICIOUS_TLDS = new Set(['tk', 'ml', 'ga', 'cf', 'gq', 'xyz', 'top', 'click', 'country', 'link', 'work', 'date']);

// URL-shortening domains that obfuscate the real destination.
const URL_SHORTENERS = new Set(['bit.ly', 'tinyurl.com', 'goo.gl', 't.co', 'ow.ly', 'is.gd', 'rb.gy', 'cutt.ly', 'rebrand.ly']);

// Words that, when present in a URL path, often signal credential theft.
const PHISHING_KEYWORDS = ['login', 'verify', 'account', 'secure', 'update', 'bank', 'paypal', 'signin', 'auth', 'password'];

// Brands most frequently impersonated; used for typosquat detection.
const BRANDS = ['paypal', 'microsoft', 'google', 'amazon', 'apple', 'netflix', 'instagram', 'facebook', 'linkedin', 'chase'];

// Risk weights (points added per flagged signal). Centralized for tuning.
const THRESHOLDS = {
  NO_HTTPS: 25,        // plaintext HTTP transport
  SUSPICIOUS_TLD: 20,  // high-risk top-level domain
  SHORTENER: 15,       // obfuscated / indirect redirect
  IP_HOST: 20,         // raw IP address instead of a domain name
  BRAND_IMPERSONATION: 30, // look-alike domain of a known brand
  PER_KEYWORD: 5,      // each phishing keyword in the path
  KEYWORD_CAP: 15,     // max points from keywords
  MALICIOUS: 70,       // score >= this => malicious
  SUSPICIOUS: 35,      // score >= this => suspicious, else safe
};

/* ------------------------------------------------------------------
 * 2. LEVENSHTEIN DISTANCE
 *    Measures edit distance between two strings. Used to catch
 *    typosquatted brand domains (e.g. "paypa1.com" vs "paypal.com").
 *    Returns an integer >= 0.
 * ------------------------------------------------------------------ */
const levenshtein = (a, b) => {
  // Build a (a.length+1) x (b.length+1) DP matrix.
  const dp = Array.from({ length: a.length + 1 }, () => [0, ...Array(b.length).fill(0)]);
  // Initialize first row/column (cost of deleting all chars).
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    dp[i][0] = i;
    for (let j = 1; j <= b.length; j++) {
      // Cost: 0 if chars match, else 1 (substitution).
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,        // deletion
        dp[i][j - 1] + 1,        // insertion
        dp[i - 1][j - 1] + cost  // substitution
      );
    }
  }
  return dp[a.length][b.length];
};

/* ------------------------------------------------------------------
 * 3. CORE SCAN FUNCTION
 *    Input : rawUrl (string)
 *    Output: detailed JSON result object
 * ------------------------------------------------------------------ */
export const scanUrl = (rawUrl) => {
  // 3a. Defensive input normalization.
  const input = typeof rawUrl === 'string' ? rawUrl.trim() : '';

  // 3b. Parse using the WHATWG URL standard parser.
  //     It throws on malformed input, which we catch below.
  let url;
  try {
    url = new URL(input);
  } catch {
    // Invalid URL => maximum risk, no further analysis possible.
    return {
      valid: false,
      input,
      riskScore: 100,
      verdict: 'malicious',
      checks: { format: 'Invalid URL format' },
    };
  }

  // 3c. Extract the registrable host and its TLD.
  const host = url.hostname.toLowerCase();
  const tld = host.split('.').pop() || '';

  // 3d. Initialize the checks map and a running risk score.
  const checks = {};
  let score = 0;

  // 3e. Protocol / SSL check. HTTPS is the secure transport.
  checks.https = url.protocol === 'https:';
  if (!checks.https) score += THRESHOLDS.NO_HTTPS;

  // 3f. Suspicious TLD check.
  checks.suspiciousTld = SUSPICIOUS_TLDS.has(tld);
  if (checks.suspiciousTld) score += THRESHOLDS.SUSPICIOUS_TLD;

  // 3g. URL shortener check (obfuscates final destination).
  checks.urlShortener = URL_SHORTENERS.has(host) || [...URL_SHORTENERS].some((s) => host.endsWith('.' + s));
  if (checks.urlShortener) score += THRESHOLDS.SHORTENER;

  // 3h. IP-literal host check (attackers often use raw IPs).
  checks.ipHost = /^(\d{1,3}\.){3}\d{1,3}$/.test(host);
  if (checks.ipHost) score += THRESHOLDS.IP_HOST;

  // 3i. Brand impersonation (typosquatting) detection.
  //     Flag if the host contains a brand token, OR its registrable
  //     label is within edit distance 3 of a brand (catches paypa1.com).
  const labels = host.split('.');                 // e.g. ["paypa1","com"]
  const registrable = labels.slice(-2).join('.'); // e.g. "paypa1.com"
  const brand = BRANDS.find((b) => {
    if (host === `${b}.com`) return false;                       // official domain is fine
    if (host.includes(b)) return true;                           // brand token present
    return levenshtein(registrable, `${b}.com`) <= 3;            // near-match label
  });
  checks.brandImpersonation = brand || null;
  if (brand) score += THRESHOLDS.BRAND_IMPERSONATION;

  // 3j. Phishing keyword density in the path.
  const path = url.pathname.toLowerCase();
  checks.phishingKeywords = PHISHING_KEYWORDS.filter((k) => path.includes(k));
  score += Math.min(checks.phishingKeywords.length * THRESHOLDS.PER_KEYWORD, THRESHOLDS.KEYWORD_CAP);

  // 3k. Clamp to 0–100 and derive a verdict band.
  score = Math.max(0, Math.min(100, score));
  const verdict = score >= THRESHOLDS.MALICIOUS ? 'malicious' : score >= THRESHOLDS.SUSPICIOUS ? 'suspicious' : 'safe';

  // 3l. Assemble the detailed, serializable response.
  return {
    valid: true,
    input,
    host,
    scheme: url.protocol.replace(':', ''),
    path: url.pathname,
    riskScore: score,
    verdict,
    ssl: checks.https,
    domain: host,
    checks,
  };
};

export default { scanUrl };
