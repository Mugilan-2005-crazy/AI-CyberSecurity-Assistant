/**
 * services/ai/aiSecurity.js
 * ============================================================
 * AI Security Guardrails — production-hardening layer for AI
 * interactions. Sits between the chat routes and aiRouter.
 *
 * Layers:
 *  1. Input validation & token budgeting
 *  2. PII / sensitive-data redaction before outbound API calls
 *  3. Prompt-injection detection (reuses sanitizePrompt patterns)
 *  4. Per-user rate limiting via Redis cache (token-bucket)
 *  5. Output filtering to prevent leakage of model instructions
 *  6. Audit logging for SOC-2 compliance
 * ============================================================
 */
import crypto from 'crypto';
import { sanitizePrompt, detectPromptInjection, MAX_PROMPT_LENGTH } from '../../utils/sanitizePrompt.js';
import cacheManager from '../cache/cacheManager.js';
import logger from '../../utils/logger.js';

// ============================================================
// Configuration
// ============================================================
const AI_SECURITY_CONFIG = {
  MAX_HISTORY_ITEMS: 50,
  MAX_MESSAGE_LENGTH: MAX_PROMPT_LENGTH,
  MAX_TOTAL_TOKENS: 8000,
  REDACT_PATTERN: /(api[_-]?key|secret|password|passwd|pwd|token|credential|private[_-]?key)\s*[=:]\s*\S+/gi,
  EMAIL_PATTERN: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  PHONE_PATTERN: /\b(?:\+?(\d{1,3})?[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
  SSN_PATTERN: /\b\d{3}-\d{2}-\d{4}\b/g,
  CREDIT_CARD_PATTERN: /\b(?:\d[ -]*?){13,16}\b/g,
  RATE_LIMIT_WINDOW_MS: 60000,
  RATE_LIMIT_MAX_REQUESTS: 20,
  RATE_LIMIT_MAX_TOKENS: 8000,
  SYSTEM_INSTRUCTION_LEAK_PATTERNS: [
    /system\s*instruction/i,
    /system\s*prompt/i,
    /you\s+are\s+.*cybersec/i,
    /your\s+instructions\s+are/i,
    /disregard\s+your\s+previous/i,
  ],
};

// ============================================================
// PII Redaction
// ============================================================
const REDACTED_PLACEHOLDER = '[REDACTED]';

/**
 * Redact PII and sensitive keywords from a prompt before sending
 * to an external LLM provider. Returns { text, redactions }.
 * @param {string} input
 * @returns {{ text: string, redactions: Array<{type: string, count: number}> }}
 */
export const redactPII = (input) => {
  if (typeof input !== 'string') return { text: '', redactions: [] };

  const redactions = [];
  let text = input;

  const patterns = [
    { type: 'email', regex: AI_SECURITY_CONFIG.EMAIL_PATTERN },
    { type: 'ssn', regex: AI_SECURITY_CONFIG.SSN_PATTERN },
    { type: 'credit_card', regex: AI_SECURITY_CONFIG.CREDIT_CARD_PATTERN },
    { type: 'phone', regex: AI_SECURITY_CONFIG.PHONE_PATTERN },
    { type: 'sensitive_key', regex: AI_SECURITY_CONFIG.REDACT_PATTERN },
  ];

  for (const { type, regex } of patterns) {
    const matches = text.match(regex);
    if (matches && matches.length > 0) {
      redactions.push({ type, count: matches.length });
      text = text.replace(regex, REDACTED_PLACEHOLDER);
    }
  }

  return { text, redactions };
};

// ============================================================
// Prompt Injection Detection (enhanced)
// ============================================================
const ENHANCED_INJECTION_PATTERNS = [
  /please\s+ignore\s+all\s+rules/i,
  /you\s+are\s+free\s+now/i,
  /you\s+are\s+now\s+DAN/i,
  /reveal\s+your\s+system\s+prompt/i,
  /show\s+me\s+your\s+instructions/i,
  /what\s+is\s+your\s+system\s+instruction/i,
  /what\s+is\s+your\s+system\s+message/i,
  /forget\s+everything\s+above/i,
  /bypass\s+your\s+guardrails/i,
  /disable\s+your\s+safety/i,
  /act\s+as\s+an\s+uncensored/i,
  /jailbreak/i,
  /dan\s+mode/i,
  /stop\s+filtering/i,
  /reveal\s+hidden/i,
  /expose\s+internal/i,
  /your\s+training\s+data/i,
];

/**
 * Enhanced prompt injection detection.
 * @param {string} input
 * @returns {boolean}
 */
export const detectInjection = (input) => {
  if (typeof input !== 'string') return false;
  const baseFlagged = detectPromptInjection(input);
  if (baseFlagged) return true;
  return ENHANCED_INJECTION_PATTERNS.some((pattern) => pattern.test(input));
};

// ============================================================
// Input Validation
// ============================================================
/**
 * Validate an AI chat message and optional history array.
 * @param {string} message
 * @param {Array} history
 * @returns {{ valid: boolean, errors: string[] }}
 */
export const validateAIInput = (message, history = []) => {
  const errors = [];

  if (!message || typeof message !== 'string') {
    errors.push('Message is required and must be a string');
    return { valid: false, errors };
  }

  if (message.length > AI_SECURITY_CONFIG.MAX_MESSAGE_LENGTH) {
    errors.push(`Message exceeds maximum length of ${AI_SECURITY_CONFIG.MAX_MESSAGE_LENGTH} characters`);
  }

  if (detectInjection(message)) {
    errors.push('Potentially malicious prompt detected');
  }

  if (Array.isArray(history) && history.length > AI_SECURITY_CONFIG.MAX_HISTORY_ITEMS) {
    errors.push(`History exceeds maximum of ${AI_SECURITY_CONFIG.MAX_HISTORY_ITEMS} items`);
  }

  if (Array.isArray(history)) {
    for (let i = 0; i < history.length; i++) {
      const item = history[i];
      if (!item || typeof item !== 'object') {
        errors.push(`History item ${i} must be an object`);
        continue;
      }
      if (item.role && !['user', 'model', 'assistant'].includes(item.role)) {
        errors.push(`History item ${i} has invalid role: ${item.role}`);
      }
      if (item.text && typeof item.text === 'string' && item.text.length > AI_SECURITY_CONFIG.MAX_MESSAGE_LENGTH) {
        errors.push(`History item ${i} exceeds maximum message length`);
      }
      if (item.text && detectInjection(item.text)) {
        errors.push(`History item ${i} contains potentially malicious prompt`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
};

// ============================================================
// Token-Bucket Rate Limiting (Redis-backed)
// ============================================================
/**
 * Per-user token-bucket rate limiter for AI requests.
 * Returns true if the request is allowed, false if rate-limited.
 * @param {string} userId
 * @param {number} tokensRequested - token cost of this request
 * @returns {Promise<{ allowed: boolean, remaining: number, resetMs: number }>}
 */
export const checkAIRateLimit = async (userId, tokensRequested = 1) => {
  const { RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX_REQUESTS, RATE_LIMIT_MAX_TOKENS } = AI_SECURITY_CONFIG;
  const rateKey = `ai:rl:${userId}`;
  const tokenKey = `ai:tokens:${userId}`;

  try {
    const currentCount = await cacheManager.get(rateKey);
    const currentTokens = await cacheManager.get(tokenKey);

    const count = currentCount ? parseInt(currentCount, 10) : 0;
    const usedTokens = currentTokens ? parseInt(currentTokens, 10) : 0;

    if (count >= RATE_LIMIT_MAX_REQUESTS || usedTokens + tokensRequested > RATE_LIMIT_MAX_TOKENS) {
      return { allowed: false, remaining: 0, resetMs: RATE_LIMIT_WINDOW_MS };
    }

    const newCount = count + 1;
    const newTokens = usedTokens + tokensRequested;

    const ttl = RATE_LIMIT_WINDOW_MS / 1000;

    await cacheManager.set(rateKey, String(newCount), ttl);
    await cacheManager.set(tokenKey, String(newTokens), ttl);

    return {
      allowed: true,
      remaining: RATE_LIMIT_MAX_REQUESTS - newCount,
      remainingTokens: RATE_LIMIT_MAX_TOKENS - newTokens,
      resetMs: RATE_LIMIT_WINDOW_MS,
    };
  } catch (err) {
    logger.warn('[aiSecurity] Rate limit check failed, allowing request', { userId, error: err.message });
    return { allowed: true, remaining: -1, resetMs: RATE_LIMIT_WINDOW_MS };
  }
};

// ============================================================
// Output Filtering
// ============================================================
/**
 * Filter AI output to prevent leakage of system instructions,
 * sensitive patterns, or prompt-injection payloads.
 * @param {string} output
 * @returns {{ text: string, filtered: boolean, reason?: string }}
 */
export const filterAIOutput = (output) => {
  if (typeof output !== 'string') return { text: '', filtered: false };

  let text = output;
  let filtered = false;
  let reason = '';

  for (const pattern of AI_SECURITY_CONFIG.SYSTEM_INSTRUCTION_LEAK_PATTERNS) {
    if (pattern.test(text)) {
      filtered = true;
      reason = 'Potential system instruction leak detected in output';
      text = text.replace(pattern, '[FILTERED]');
    }
  }

  const apiKeyLeak = text.match(/(?:api[_-]?key|secret|token|password)\s*(?:[\s:=]+| is )([A-Za-z0-9+/=_-]{20,})/gi);
  if (apiKeyLeak) {
    filtered = true;
    reason = 'Potential credential leak detected in output';
     text = text.replace(/((?:api[_-]?key|secret|token|password)\s*(?:[\s:=]+| is ))([A-Za-z0-9+/=_-]{20,})/gi, '$1[REDACTED]');
  }

  return { text, filtered, reason };
};

// ============================================================
// Request Fingerprinting (for audit)
// ============================================================
/**
 * Generate a stable, non-identifying fingerprint of a user request
 * for abuse correlation without storing raw PII.
 * @param {string} message
 * @param {string} userId
 * @returns {string}
 */
export const fingerprintRequest = (message, userId = 'unknown') => {
  const hash = crypto
    .createHash('sha256')
    .update(`${userId}:${message.slice(0, 200)}`)
    .digest('hex')
    .slice(0, 16);
  return hash;
};

// ============================================================
// Main Security Middleware
// ============================================================
/**
 * Comprehensive security gate for AI requests.
 * Call before routing to a provider.
 * @param {string} userId
 * @param {string} message
 * @param {Array} history
 * @param {number} estimatedTokens
 * @returns {Promise<{ allowed: boolean, shouldBlock: boolean, sanitizedMessage: string, redactions: Array, rateInfo: object, fingerprint: string, errors: string[] }>}
 */
export const aiSecurityGate = async (userId, message, history = [], estimatedTokens = 1) => {
  const errors = [];
  const fingerprint = fingerprintRequest(message, userId);

  // 1. Input validation
  const validation = validateAIInput(message, history);
  if (!validation.valid) {
    errors.push(...validation.errors);
  }

  // 2. Rate limiting
  const rateInfo = await checkAIRateLimit(userId, estimatedTokens);

  // 3. PII redaction
  const { text: redactedMessage, redactions } = redactPII(message);

  // 4. Prompt sanitization (control chars, length)
  const sanitized = sanitizePrompt(redactedMessage);

  const shouldBlock =
    !rateInfo.allowed ||
    (errors.length > 0 && errors.some((e) => e.includes('malicious')));

  if (shouldBlock) {
    logger.warn('[aiSecurity] Request blocked', {
      userId,
      fingerprint,
      errors,
      rateInfo,
    });
  }

  return {
    allowed: rateInfo.allowed,
    shouldBlock,
    sanitizedMessage: sanitized.text,
    flagged: sanitized.flagged || detectInjection(message),
    redactions,
    rateInfo,
    fingerprint,
    errors,
  };
};

export default {
  redactPII,
  detectInjection,
  validateAIInput,
  checkAIRateLimit,
  filterAIOutput,
  fingerprintRequest,
  aiSecurityGate,
};
