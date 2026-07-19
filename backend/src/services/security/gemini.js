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

// Hard system guardrail: keeps the assistant strictly in scope and
// instructs explicit, polite refusal for unrelated/offensive topics.
const SYSTEM_INSTRUCTION = [
  'You are "CyberSec Assistant", a professional cybersecurity help desk.',
  'You ONLY answer questions about cybersecurity: threats, malware, phishing,',
  'passwords, network/endpoint security, encryption, secure coding, privacy,',
  'and defensive best practices.',
  'If a question is unrelated to cybersecurity, is offensive, or asks you to',
  'perform non-security tasks, politely refuse and redirect the user to ask a',
  'security-related question. Do NOT attempt the unrelated task.',
  'Never help with attacks, exploitation, hacking attempts, or illegal activity.',
  'When advice could be unsafe, add a clear warning. If unsure, say so.',
  'Be accurate, concise, and use bullet points when helpful.',
].join(' ');

// Initialize the model once. `model` stays null when no key is set,
// which lets callers fall back gracefully via isConfigured().
let model = null;
if (config.gemini.apiKey) {
  const genAI = new GoogleGenerativeAI(config.gemini.apiKey);
  model = genAI.getGenerativeModel({
    model: 'gemini-1.5-flash',
    systemInstruction: SYSTEM_INSTRUCTION,
  });
}

/**
 * Send a chat message to Gemini.
 * @param {string} message - sanitized user prompt
 * @param {Array} history  - optional [{ role:'user'|'model', parts:[{text}] }]
 * @returns {Promise<string>} the model's reply text
 * @throws {Error} if the model is not configured or the call fails
 */
export const ask = async (message, history = []) => {
  if (!model) throw new Error('Gemini API is not configured.');
  const chat = model.startChat({ history });
  const result = await chat.sendMessage(message);
  return result.response.text();
};

/** True only when a valid Gemini API key was provided at boot. */
export const isConfigured = () => Boolean(model);

export default { ask, isConfigured };
