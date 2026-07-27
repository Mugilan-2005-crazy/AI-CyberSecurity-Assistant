/**
 * services/security/gemini.js
 * ============================================================
 * MODULE 5 (service layer) — Google Gemini integration.
 * Also used by Module 3 (email threat explanation).
 * ------------------------------------------------------------
 * Responsibilities:
 *   - Initialize the Gemini model once at boot from the API key
 *     stored in environment config (never exposed to the client).
 *   - Constrain the model to cybersecurity topics only and make
 *     it politely refuse anything out of scope.
 *   - Provide a multi-turn `ask(message, history)` and an
 *     `isConfigured()` flag so callers can degrade gracefully.
 *
 * Security:
 *   - System instruction enforces topic boundaries server-side;
 *     client-supplied prompts are still sent, but the model is
 *     instructed never to assist with attacks/illegal activity.
 *   - No API key is ever returned in responses or logs.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import config from '../../config/index.js';
import logger from '../../utils/logger.js';

// Hard system guardrail: keeps the assistant strictly in scope and
// instructs explicit, polite refusal for unrelated/offensive topics.
const SYSTEM_INSTRUCTION = [
  'You are "CyberSec Assistant", a multilingual cybersecurity analyst and help desk specialist.',
  'Your mission is to help users understand security threats, prevent attacks, and use security tools effectively.',
  '',
  'Language rules:',
  '- ALWAYS reply in the same language the user uses.',
  '- If the user writes in Tamil (தமிழ்), reply in Tamil.',
  '- If the user writes in Tanglish (Tamil written in English letters), reply in Tanglish.',
  '- If the user writes in Hindi (हिन्दी), reply in Hindi.',
  '- If the user writes in English, reply in English.',
  '- Keep technical terms like malware, ransomware, phishing, firewall, vulnerability in English even when replying in Tamil, Tanglish, or Hindi.',
  '- Do NOT translate technical terms or malicious commands.',
  '',
  'Response guidelines:',
  '- Assess risks clearly and explain them in plain language for beginners',
  '- Provide immediate, actionable steps the user can take right now',
  '- Explain technical concepts simply; avoid unnecessary jargon',
  '- Use bullet points for complex information',
  '- Ask clarifying questions when the request is vague or needs more detail',
  '- Always include prevention steps, not just diagnosis',
  '- Be encouraging and supportive, not alarmist',
  '- When unsure about something, say so honestly',
  '',
  'Scope:',
  'You ONLY answer questions about cybersecurity: threats, malware, phishing, passwords,',
  'network/endpoint security, encryption, secure coding, privacy, and defensive best practices.',
  'If a question is unrelated to cybersecurity, is offensive, or asks you to perform',
  'non-security tasks, politely refuse and redirect the user to ask a security-related question.',
  'Never help with attacks, exploitation, hacking attempts, or illegal activity.',
  'When advice could be unsafe, add a clear warning.',
  'Be accurate, concise, and professional.',
  'If context about the user\'s recent scans is provided, use it to give personalized advice.',
].join(' ');

// Initialize the model once. `model` stays null when no key is set,
// which lets callers fall back gracefully via isConfigured().
let model = null;
let currentModelName = null;
let genAI = null;
const FALLBACK_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-flash-latest', 'gemini-pro-latest'];

if (config.gemini.apiKey) {
  genAI = new GoogleGenerativeAI(config.gemini.apiKey);
  logger.info('[gemini] Gemini API key loaded', { keyLength: config.gemini.apiKey.length, keyExists: true });
  for (const modelName of FALLBACK_MODELS) {
    try {
      model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: SYSTEM_INSTRUCTION,
      });
      currentModelName = modelName;
      logger.info('[gemini] Gemini text model initialized', { model: modelName });
      break;
    } catch (err) {
      logger.warn(`[gemini] Failed to initialize model ${modelName}: ${err.message}`);
    }
  }
} else {
  logger.warn('[gemini] Gemini API key not configured');
}

/**
 * Send a chat message to Gemini.
 * @param {string} message - sanitized user prompt
 * @param {Array} history  - optional [{ role:'user'|'model', parts:[{text}] }]
 * @param {string} language - user language preference (en, ta, tanglish, hi)
 * @returns {Promise<string>} the model's reply text
 * @throws {Error} if the model is not configured or the call fails
 */
export const ask = async (message, history = [], language = 'en') => {
  if (!model) throw new Error('Gemini API is not configured.');

  const langInstructions = {
    en: 'Reply in English.',
    ta: 'Reply in Tamil (தமிழ்).',
    tanglish: 'Reply in Tanglish (Tamil written in English letters).',
    hi: 'Reply in Hindi (हिन्दी).',
  };

  const langInstruction = langInstructions[language] || langInstructions.en;
  const enhancedMessage = `[Language instruction: ${langInstruction}]\n\nUser: ${message}`;

  const chat = model.startChat({ history });
  try {
    const result = await chat.sendMessage(enhancedMessage);
    return result.response.text();
  } catch (err) {
    if (err.statusCode === 404 || err.status === 404) {
      logger.warn(`[gemini] Model ${currentModelName} not found, trying fallbacks...`);
      for (const fallbackName of FALLBACK_MODELS) {
        if (fallbackName === currentModelName) continue;
        try {
          const fallbackModel = genAI.getGenerativeModel({ model: fallbackName, systemInstruction: SYSTEM_INSTRUCTION });
          const fallbackChat = fallbackModel.startChat({ history });
          const result = await fallbackChat.sendMessage(enhancedMessage);
          logger.info(`[gemini] Fallback model ${fallbackName} succeeded`);
          return result.response.text();
        } catch (fallbackErr) {
          logger.warn(`[gemini] Fallback model ${fallbackName} failed: ${fallbackErr.message}`);
        }
      }
    }
    throw err;
  }
};

/** True only when a valid Gemini API key was provided at boot. */
export const isConfigured = () => Boolean(model);

export default { ask, isConfigured };
