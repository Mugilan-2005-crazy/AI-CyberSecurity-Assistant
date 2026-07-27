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

const PROMPT_INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?previous\s+instructions/i,
  /ignore\s+the\s+above/i,
  /disregard\s+everything/i,
  /you\s+are\s+now\s+ DAN/i,
  /developer\s*mode/i,
  /pretend\s+you\s+are\s+not\s+an?\s+ai/i,
  /act\s+as\s+if\s+you\s+have\s+no\s+rules/i,
  /override\s+(your|the)\s+instructions/i,
  /new\s+instruction[:\s]/i,
  /system\s*:\s*you\s+must/i,
  /\[system\]/i,
  /\{system\}/i,
  /<system>/i,
];

export const detectPromptInjection = (input) => {
  if (typeof input !== 'string') return false;
  return PROMPT_INJECTION_PATTERNS.some((pattern) => pattern.test(input));
};

/**
 * Sanitize a user prompt.
 *  - Trims whitespace.
 *  - Enforces a max length (prevents abuse / token blowups).
 *  - Strips control characters that could manipulate model parsing.
 *  - Flags obvious prompt injection attempts.
 * @param {string} input
 * @returns {{ text: string, flagged: boolean }} sanitized prompt
 */
export const sanitizePrompt = (input) => {
  if (typeof input !== 'string') return { text: '', flagged: false };
  const cleaned = input
    .replace(/[\u0000-\u001F\u007F]/g, '') // remove control chars
    .trim()
    .slice(0, MAX_PROMPT_LENGTH);
  const flagged = detectPromptInjection(cleaned);
  return { text: cleaned, flagged };
};

export default sanitizePrompt;
