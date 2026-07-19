/**
 * services/security/passwordAnalyzer.js
 * ============================================================
 * MODULE 2 — Password Strength Analyzer (pure logic, no Express).
 * ------------------------------------------------------------
 * Responsibilities:
 *   1. Character-class checks (upper/lower/digit/special).
 *   2. Length validation (minimum 8).
 *   3. Shannon entropy estimation (bits of randomness).
 *   4. Estimated crack time (online vs offline attacker).
 *   5. Common/breached-password detection (local blocklist).
 *   6. A 0–100 strength score + readable strength label.
 *   7. Actionable security recommendations.
 *
 * Design notes:
 *   - Pure, deterministic, synchronous: trivial to unit test, no I/O.
 *   - Reuses no third-party deps; Math + regex only.
 *   - The plaintext password is NEVER returned to the client.
 */

/* ------------------------------------------------------------------
 * 1. CONFIGURATION / INTELLIGENCE
 *    Centralized so thresholds & lists are easy to tune/maintain.
 * ------------------------------------------------------------------ */

// A small, illustrative blocklist of the most common passwords.
// In production, integrate HaveIBeenPwned's k-anonymity range API.
const COMMON_PASSWORDS = new Set([
  'password', '123456', '12345678', 'qwerty', 'abc123', 'password1',
  '111111', '123123', 'admin', 'letmein', 'welcome', 'monkey', 'dragon',
  'iloveyou', 'trustno1', 'sunshine', 'princess', 'football',
]);

// Score contribution per satisfied criterion (sum <= 100).
const SCORE_WEIGHTS = {
  length12: 25,   // at least 12 characters
  lower: 15,      // has lowercase
  upper: 15,      // has uppercase
  digit: 15,      // has a number
  special: 20,    // has a symbol
  uncommon: 10,   // not in the common-password blocklist
};

// Minimum accepted length (defense against trivially short pw).
const MIN_LENGTH = 8;

/* ------------------------------------------------------------------
 * 2. CHARSET SIZE ESTIMATION
 *    Returns the pool size of characters the password could draw
 *    from, based on which character classes are present.
 *    Larger pool => higher entropy per character.
 * ------------------------------------------------------------------ */
const charsetSize = (pwd) => {
  let size = 0;
  if (/[a-z]/.test(pwd)) size += 26;        // lowercase letters
  if (/[A-Z]/.test(pwd)) size += 26;        // uppercase letters
  if (/[0-9]/.test(pwd)) size += 10;        // digits
  if (/[^a-zA-Z0-9]/.test(pwd)) size += 33; // common symbols/punctuation
  return size;
};

/* ------------------------------------------------------------------
 * 3. HUMAN-READABLE TIME FORMATTER
 *    Converts a number of seconds into a compact string
 *    (e.g. 90 -> "1m", 5000000 -> "2mo"). Used for crack times.
 * ------------------------------------------------------------------ */
const humanizeTime = (seconds) => {
  if (!isFinite(seconds) || seconds <= 0) return 'instant';
  const units = [
    ['y', 31536000], ['mo', 2592000], ['d', 86400],
    ['h', 3600], ['m', 60], ['s', 1],
  ];
  for (const [label, secs] of units) {
    if (seconds >= secs) return `${Math.floor(seconds / secs)}${label}`;
  }
  return '<1s';
};

/* ------------------------------------------------------------------
 * 4. CORE ANALYZER
 *    Input : password (string)
 *    Output: detailed JSON result (no plaintext echoed back)
 * ------------------------------------------------------------------ */
export const analyzePassword = (password) => {
  // 4a. Defensive normalization + length.
  const pwd = typeof password === 'string' ? password : '';
  const len = pwd.length;

  // 4b. Character-class presence flags.
  const hasLower = /[a-z]/.test(pwd);
  const hasUpper = /[A-Z]/.test(pwd);
  const hasDigit = /[0-9]/.test(pwd);
  const hasSpecial = /[^a-zA-Z0-9]/.test(pwd);

  // 4c. Effective character pool size for entropy calc.
  const pool = charsetSize(pwd);

  // 4d. Shannon entropy (bits) = length * log2(poolSize).
  //     Measures unpredictability; ~80+ bits is considered strong.
  const entropy = len * (pool > 0 ? Math.log2(pool) : 0);

  // 4e. Brute-force space = pool^length.
  const combinations = Math.pow(pool, len);
  // Two attacker models:
  const crackTimeOnline = combinations / 1e3;   // 1k guesses/sec (web form)
  const crackTimeOffline = combinations / 1e9;  // 1B/sec (offline hash dump)

  // 4f. Common/breached-password detection (local blocklist).
  const isCommon = COMMON_PASSWORDS.has(pwd.toLowerCase());

  // 4g. Build actionable recommendations (only what's missing).
  const suggestions = [];
  if (len < MIN_LENGTH) suggestions.push(`Use at least ${MIN_LENGTH} characters.`);
  if (len < 12) suggestions.push('Prefer 12+ characters for strong resistance.');
  if (!hasUpper) suggestions.push('Add uppercase letters (A-Z).');
  if (!hasDigit) suggestions.push('Add numbers (0-9).');
  if (!hasSpecial) suggestions.push('Add symbols (e.g. !@#$%).');
  if (isCommon) suggestions.push('This password is in known breach lists — never reuse it.');
  if (/(.)\1{2,}/.test(pwd)) suggestions.push('Avoid 3+ repeated characters (e.g. "aaa").');
  if (/\d{4}/.test(pwd) || /(19|20)\d{2}/.test(pwd)) suggestions.push('Avoid years or simple number sequences.');

  // 4h. Compute the 0–100 score from satisfied criteria.
  let score = 0;
  if (len >= 12) score += SCORE_WEIGHTS.length12;
  if (hasLower) score += SCORE_WEIGHTS.lower;
  if (hasUpper) score += SCORE_WEIGHTS.upper;
  if (hasDigit) score += SCORE_WEIGHTS.digit;
  if (hasSpecial) score += SCORE_WEIGHTS.special;
  if (!isCommon) score += SCORE_WEIGHTS.uncommon;
  score = Math.max(0, Math.min(100, score));

  // 4i. Map score + entropy to a user-facing strength label.
  const strength = score < 40 ? 'Weak' : score < 70 ? 'Moderate' : score < 90 ? 'Strong' : 'Very Strong';

  // 4j. Derive a normalized scan verdict for history/analytics.
  const verdict = score < 40 ? 'suspicious' : 'safe';

  // 4k. Assemble the detailed, serializable response.
  return {
    length: len,
    entropy: Math.round(entropy * 10) / 10, // 1 decimal place
    charsetSize: pool,
    crackTimeOnline: humanizeTime(crackTimeOnline),
    crackTimeOffline: humanizeTime(crackTimeOffline),
    strength,
    score,
    verdict,
    isCommonBreach: isCommon,
    checks: { hasLower, hasUpper, hasDigit, hasSpecial, longEnough: len >= MIN_LENGTH },
    suggestions,
  };
};

export default { analyzePassword };
