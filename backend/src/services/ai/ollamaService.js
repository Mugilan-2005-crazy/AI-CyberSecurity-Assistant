/**
 * services/ai/ollamaService.js
 * ============================================================
 * MODULE 5 — Ollama local AI integration.
 * Connects to a local Ollama server (default http://localhost:11434)
 * and uses llama3.1 for cybersecurity assistance.
 *
 * Gracefully handles:
 *  - Connection errors (Ollama not running)
 *  - Model missing
 *  - Timeouts
 *  - Empty responses
 *
 * Falls back to a friendly message instead of crashing.
 */
import ollama from 'ollama';
import config from '../../config/index.js';
import logger from '../../utils/logger.js';

const OLLAMA_URL = config.ollama.url;
const OLLAMA_MODEL = config.ollama.model;
const REQUEST_TIMEOUT = 30000;
const SYSTEM_PROMPT_BASE =
  'You are a multilingual cybersecurity assistant. ' +
  'Always answer in the user\'s selected language. ' +
  'Keep cybersecurity explanations simple and beginner friendly. ' +
  'Do NOT translate technical terms like malware, ransomware, phishing, firewall, vulnerability. ' +
  'Never help with attacks or illegal activity. ' +
  'Be concise, accurate, and helpful.';

const getSystemPrompt = (language) => {
  const langInstructions = {
    en: 'Reply in English.',
    ta: 'Reply in Tamil (தமிழ்).',
    tanglish: 'Reply in Tanglish (Tamil written in English letters).',
    hi: 'Reply in Hindi (हिन्दी).',
  };
  return `${SYSTEM_PROMPT_BASE} ${langInstructions[language] || langInstructions.en}`;
};

// Configure the Ollama client host (singleton pattern in ollama v0.5+)
ollama.config.host = OLLAMA_URL;

const withTimeout = (promise, ms = REQUEST_TIMEOUT) => {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('Ollama request timed out')), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
};

/**
 * Send a prompt to local Ollama (llama3.1).
 * @param {string} prompt - sanitized user prompt
 * @param {Array} history - optional [{ role:'user'|'assistant', content }]
 * @param {string} language - user language preference (en, ta, tanglish, hi)
 * @returns {Promise<{ success: boolean, response: string }>}
 */
export const askOllama = async (prompt, history = [], language = 'en') => {
  logger.info('[Ollama] askOllama called', { promptPreview: prompt.slice(0, 100), historyLength: history.length, model: OLLAMA_MODEL, url: OLLAMA_URL });

  try {
    const messages = [
      { role: 'system', content: getSystemPrompt(language) },
      ...history.map((h) => ({
        role: h.role === 'model' ? 'assistant' : h.role,
        content: h.parts?.[0]?.text || h.text || h.content || '',
      })),
      { role: 'user', content: prompt },
    ];

    logger.info('[Ollama] Calling ollama.chat with model:', { model: OLLAMA_MODEL });
    const result = await withTimeout(
      ollama.chat({
        model: OLLAMA_MODEL,
        messages,
        stream: false,
      })
    );
    logger.info('[Ollama] ollama.chat response received', { hasMessage: Boolean(result?.message), contentPreview: result?.message?.content?.slice(0, 100) });

    const reply = result?.message?.content?.trim() || '';

    if (!reply) {
      logger.warn('[Ollama] Empty response from model');
      return {
        success: false,
        response: 'Local AI returned an empty response. Please try again or switch to cloud AI.',
      };
    }

    logger.info('[Ollama] Success', { replyLength: reply.length });
    return { success: true, response: reply };
  } catch (err) {
    logger.error('[Ollama] askOllama error', { error: err.message, stack: err.stack });
    logger.warn(`Ollama request failed: ${err.message}`);

    if (err.code === 'ECONNREFUSED' || err.message?.includes('ECONNREFUSED')) {
      throw new Error('Ollama is not running on ' + OLLAMA_URL);
    }

    if (err.message?.includes('model') && err.message?.includes('not found')) {
      throw new Error('Model "' + OLLAMA_MODEL + '" not found. Pull it with: ollama pull ' + OLLAMA_MODEL);
    }

    if (err.message?.includes('timed out') || err.message?.includes('timeout')) {
      throw new Error('Ollama request timed out');
    }

    throw new Error('Local AI unavailable — an unexpected error occurred: ' + err.message);
  }
};

/** True only when Ollama is reachable AND the model exists. */
export const isOllamaAvailable = async () => {
  logger.info('[Ollama] isOllamaAvailable check started', { url: OLLAMA_URL, model: OLLAMA_MODEL });

  try {
    logger.info('[Ollama] Calling ollama.list()...');
    const list = await withTimeout(ollama.list(), 10000);
    logger.info('[Ollama] ollama.list() response', {
      type: typeof list,
      keys: list ? Object.keys(list) : [],
      hasModels: Boolean(list?.models),
      modelsCount: list?.models?.length,
      modelNames: list?.models?.map((m) => m.name || m.model).slice(0, 10),
    });

    const models = Array.isArray(list?.models) ? list.models : [];
    if (!models.length) {
      logger.warn('[Ollama] No models returned from Ollama');
      return false;
    }

    const hasModel = models.some((m) => {
      const name = String(m.name || m.model || '');
      const match = name === OLLAMA_MODEL || name.startsWith(OLLAMA_MODEL + ':') || name.endsWith('/' + OLLAMA_MODEL);
      logger.info('[Ollama] Model check', { candidate: name, match });
      return match;
    });

    logger.info('[Ollama] isOllamaAvailable result:', hasModel);
    return hasModel;
  } catch (err) {
    logger.error('[Ollama] isOllamaAvailable error', { error: err.message, stack: err.stack });
    logger.warn(`Ollama availability check failed: ${err.message}`);
    return false;
  }
};

export default { askOllama, isOllamaAvailable };
