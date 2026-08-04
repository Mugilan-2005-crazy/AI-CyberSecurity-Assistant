/**
 * services/ai/aiRouter.js
 * ============================================================
 * MODULE 5 — AI Router.
 * Decides whether to use local Ollama (llama3.1) or cloud Gemini
 * for a given user message, then returns the response along with
 * the selected provider.
 *
 * Routing logic:
 *  - Ollama: general cybersecurity questions, learning topics,
 *            explanations, security best practices.
 *  - Gemini:  complex analysis, email threat explanation,
 *             scan result interpretation, context-heavy requests.
 *
 * Graceful fallbacks:
 *  - If the chosen provider is unavailable, fall back to the other.
 *  - If both fail, return a friendly fallback message.
 */
import gemini from '../security/gemini.js';
import { askOllama, isOllamaAvailable } from './ollamaService.js';
import { analyzeAttachment } from './multimodalAI.js';
import { sanitizePrompt } from '../../utils/sanitizePrompt.js';
import { aiSecurityGate, filterAIOutput, fingerprintRequest, redactPII } from './aiSecurity.js';
import { logAIRequest, logPromptInjectionAttempt, logRateLimitExceeded } from '../audit/soc2AuditService.js';
import logger from '../../utils/logger.js';

const FALLBACK_REPLY =
  "I'm currently unable to reach the AI services. " +
  'In the meantime, here are a few quick security tips: use a password manager, ' +
  'enable multi-factor authentication, keep software updated, and beware of ' +
  'unsolicited links or attachments. Please try again later.';

const GEMINI_QUOTA_REPLY =
  'Gemini quota is currently unavailable. Switching to local AI (Ollama) for your security question. ' +
  'If you need cloud AI analysis, please check your Google Cloud quota or enable billing.';

const OLLAMA_OFFLINE_REPLY =
  'Local AI (Ollama) is currently offline. Please start the Ollama service on your machine, ' +
  'or switch to cloud AI if available. In the meantime: use strong passwords, enable MFA, ' +
  'keep software updated, and beware of unsolicited links or attachments.';

const GEMINI_ERROR_REPLIES = {
  INVALID_API_KEY: 'Cloud AI authentication failed. Switching to local AI. Please contact support to resolve the API key issue.',
  MODEL_UNAVAILABLE: 'Cloud AI model is temporarily unavailable. Switching to local AI. Please try again later.',
  QUOTA_EXCEEDED: 'Cloud AI quota exceeded. Switching to local AI. Please check your Google Cloud billing or wait for quota reset.',
  NETWORK_ERROR: 'Cloud AI network error. Switching to local AI. Please check your internet connection.',
  UNKNOWN_ERROR: 'Cloud AI encountered an unexpected error. Switching to local AI. Please try again later.',
};

// Keywords/phrases that indicate a complex, context-heavy, or analysis request.
const GEMINI_PRIORITY_PATTERNS = [
  /\banalyze\b/i,
  /\binterpret\b/i,
  /\bexplain.*(?:scan|result|threat|email|url|file|qr)\b/i,
  /\bcheck\s+(?:if\s+)?this\b/i,
  /\bis\s+this\b/i,
  /\bmy\s+(?:scan|email|password|url|file|qr)\b/i,
  /\brecent\s+scan\b/i,
  /\bscan\s+result\b/i,
  /\bemail\s+threat\b/i,
  /\bphishing\b/i,
  /\bmalware\s+analysis\b/i,
  /\brisk\s+score\b/i,
];

const classifyAIError = (err) => {
  const message = (err.message || '').toLowerCase();
  if (message.includes('api key') || message.includes('401') || message.includes('permission')) return 'INVALID_API_KEY';
  if (message.includes('model') && message.includes('not found')) return 'MODEL_UNAVAILABLE';
  if (message.includes('quota') || message.includes('429') || message.includes('resource exhausted')) return 'QUOTA_EXCEEDED';
  if (message.includes('network') || message.includes('econnreset') || message.includes('timeout')) return 'NETWORK_ERROR';
  return 'UNKNOWN_ERROR';
};

// Detect if the message is analysis-heavy and should prefer Gemini.
const prefersGemini = (message) => {
  const trimmed = message.trim();
  if (trimmed.length > 300) return true;
  const matched = GEMINI_PRIORITY_PATTERNS.some((pattern) => pattern.test(trimmed));
  logger.info('[aiRouter] prefersGemini check', { messagePreview: trimmed.slice(0, 80), matched });
  return matched;
};

/**
 * Route the message to the best available AI provider.
 * @param {string} message - sanitized user prompt
 * @param {Array} history - optional [{ role:'user'|'model', text }]
 * @param {string} language - user language preference (en, ta, tanglish, hi)
 * @returns {Promise<{ provider: string, response: string }>}
 */
export const routeAI = async (message, history = [], language = 'en', userId = null) => {
  logger.info('[aiRouter] routeAI called', { messagePreview: message.slice(0, 100), language, userId });

  const fingerprint = fingerprintRequest(message, userId || 'unknown');

  const estimatedTokens = Math.ceil((message.length / 4) + (language.length / 4) + 50);
  const gate = await aiSecurityGate(userId || 'unknown', message, history, estimatedTokens);

  if (gate.shouldBlock) {
    logger.warn('[aiRouter] AI request blocked by security gate', {
      userId,
      fingerprint,
      errors: gate.errors,
      rateInfo: gate.rateInfo,
    });

    if (!gate.rateInfo.allowed) {
      logRateLimitExceeded(userId || 'anonymous', {
        fingerprint,
        messagePreview: message.slice(0, 80),
        error: 'ai_rate_limit_exceeded',
      });
      return {
        provider: 'blocked',
        response: 'Rate limit exceeded for AI requests. Please slow down and try again.',
        blocked: true,
        reason: 'rate_limit',
      };
    }

    if (gate.errors.some((e) => e.includes('malicious'))) {
      logPromptInjectionAttempt(userId || 'anonymous', {
        fingerprint,
        messagePreview: message.slice(0, 80),
        errors: gate.errors,
      });
      return {
        provider: 'blocked',
        response: 'Your request was blocked due to potential security policy violations.',
        blocked: true,
        reason: 'security_policy',
      };
    }
  }

  const safeMessage = gate.sanitizedMessage;
  logger.info('[aiRouter] Security gate passed', {
    fingerprint,
    redactions: gate.redactions,
    flagged: gate.flagged,
  });

  const useGemini = prefersGemini(safeMessage);
  logger.info('[aiRouter] prefersGemini result:', useGemini);

  const toGeminiHistory = (hist) =>
    Array.isArray(hist)
      ? hist
          .filter((h) => h && (h.role === 'user' || h.role === 'model') && typeof h.text === 'string')
          .map((h) => {
            const { text } = redactPII(h.text);
            const r = sanitizePrompt(text);
            return { role: h.role, parts: [{ text: r.text }] };
          })
      : [];

  if (useGemini) {
    logger.info('[aiRouter] Branch: Gemini preferred');

    if (gemini.isConfigured()) {
      try {
        logger.info('[aiRouter] Trying Gemini...');
        const reply = await gemini.ask(safeMessage, toGeminiHistory(history), language);
        const filtered = filterAIOutput(reply);

        const auditLogEntry = {
          action: 'ai_request',
          userId: userId || 'anonymous',
          fingerprint,
          provider: 'gemini',
          messagePreview: safeMessage.slice(0, 100),
          responsePreview: filtered.text.slice(0, 100),
          piiRedacted: gate.redactions.length > 0,
          redactions: gate.redactions,
          outputFiltered: filtered.filtered,
          language,
          timestamp: new Date().toISOString(),
        };
        logger.info('[aiRouter] AI audit log', auditLogEntry);

        return { provider: 'gemini', response: filtered.text, audit: auditLogEntry };
      } catch (err) {
        logger.warn(`Gemini failed, falling back to Ollama: ${err.message}`);
        const category = classifyAIError(err);
        if (category === 'INVALID_API_KEY' || category === 'QUOTA_EXCEEDED' || category === 'MODEL_UNAVAILABLE') {
          logger.warn(`[aiRouter] Gemini ${category}, falling back to Ollama`);
        }
      }
    } else {
      logger.info('[aiRouter] Gemini not configured');
    }

    try {
      logger.info('[aiRouter] Falling back to Ollama...');
      const ollamaResult = await askOllama(safeMessage, history, language);
      logger.info('[aiRouter] Ollama fallback result', { success: ollamaResult.success });
      if (ollamaResult.success) {
        const filtered = filterAIOutput(ollamaResult.response);
        logger.info('[aiRouter] AI audit log (ollama fallback)', {
          action: 'ai_request',
          userId: userId || 'anonymous',
          fingerprint,
          provider: 'ollama',
          piiRedacted: gate.redactions.length > 0,
          outputFiltered: filtered.filtered,
        });
        return { provider: 'ollama', response: filtered.text };
      }
    } catch (err) {
      logger.warn(`Ollama fallback failed: ${err.message}`);
    }

    logger.info('[aiRouter] Both providers failed, returning fallback');
    if (gemini.isConfigured()) {
      return { provider: 'gemini', response: GEMINI_QUOTA_REPLY };
    }
    return { provider: 'none', response: FALLBACK_REPLY };
  }

  logger.info('[aiRouter] Branch: Ollama preferred');
  try {
    const ollamaAvailable = await isOllamaAvailable();
    logger.info('[aiRouter] isOllamaAvailable result:', ollamaAvailable);

    if (ollamaAvailable) {
      logger.info('[aiRouter] Trying Ollama...');
      const ollamaResult = await askOllama(safeMessage, history, language);
      logger.info('[aiRouter] Ollama result:', { success: ollamaResult.success });
      if (ollamaResult.success) {
        const filtered = filterAIOutput(ollamaResult.response);
        logger.info('[aiRouter] AI audit log (ollama)', {
          action: 'ai_request',
          userId: userId || 'anonymous',
          fingerprint,
          provider: 'ollama',
          piiRedacted: gate.redactions.length > 0,
          outputFiltered: filtered.filtered,
        });
        return { provider: 'ollama', response: filtered.text };
      }
    } else {
      logger.info('[aiRouter] Ollama not available, skipping');
    }
  } catch (err) {
    logger.warn(`Ollama unavailable: ${err.message}`);
  }

  if (gemini.isConfigured()) {
    try {
      logger.info('[aiRouter] Falling back to Gemini...');
      const reply = await gemini.ask(safeMessage, toGeminiHistory(history), language);
      const filtered = filterAIOutput(reply);

      logger.info('[aiRouter] AI audit log (gemini fallback)', {
        action: 'ai_request',
        userId: userId || 'anonymous',
        fingerprint,
        provider: 'gemini',
        piiRedacted: gate.redactions.length > 0,
        outputFiltered: filtered.filtered,
      });

      return { provider: 'gemini', response: filtered.text };
    } catch (err) {
      logger.warn(`Gemini fallback failed: ${err.message}`);
    }
  } else {
    logger.info('[aiRouter] Gemini not configured for fallback');
  }

  logger.info('[aiRouter] All providers failed, returning fallback');
  if (await isOllamaAvailable()) {
    return { provider: 'ollama', response: OLLAMA_OFFLINE_REPLY };
  }
  return { provider: 'none', response: FALLBACK_REPLY };
};

export const routeMultimodalAI = async (fileBuffer, filename, mimeType, language = 'en', userQuery = '', userId = null) => {
  logger.info('[aiRouter] routeMultimodalAI called', { filename, mimeType, language, queryPreview: userQuery.slice(0, 80) });

  try {
    const result = await analyzeAttachment(fileBuffer, filename, mimeType, language, userQuery, userId);
    let provider = 'none';
    if (result.provider) provider = result.provider;
    else if (result.imageAnalyzed) provider = 'gemini-vision';
    else if (result.framesAnalyzed > 0) provider = 'gemini-vision';
    else provider = 'multimodal-fallback';

    return {
      provider,
      response: result.analysis || result.message || 'Analysis completed.',
      result,
    };
  } catch (err) {
    logger.error(`Multimodal AI failed: ${err.message}`);
    return {
      provider: 'none',
      response: 'File analysis failed. The file may be corrupted or unsupported. Please try another file.',
      error: err.message,
    };
  }
};

export default { routeAI, routeMultimodalAI };