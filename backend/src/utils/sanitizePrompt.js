/**
 * utils/sanitizePrompt.js
 * ============================================================
 * MODULE 5 — Prompt sanitization.
 * Reduces injection/abuse surface before a user message is sent
 * to the AI model. This is defense-in-depth on top of the model's
 * system-instruction guardrails — it is NOT a replacement for them.
 */

/** Maximum allowed characters in a single chat message. */
export const MAX_PROMPT_LENGTH = 2000;

/**
 * Sanitize a user prompt.
 *  - Trims whitespace.
 *  - Enforces a max length (prevents abuse / token blowups).
 *  - Strips control characters that could manipulate model parsing.
 * @param {string} input
 * @returns {string} sanitized prompt
 */
export const sanitizePrompt = (input) => {
  if (typeof input !== 'string') return '';
  return input
    .replace(/[\u0000-\u001F\u007F]/g, '') // remove control chars
    .trim()
    .slice(0, MAX_PROMPT_LENGTH);
};

export default sanitizePrompt;
