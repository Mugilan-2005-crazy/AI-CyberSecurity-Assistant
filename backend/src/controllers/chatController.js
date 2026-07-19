/**
 * controllers/chatController.js
 * ============================================================
 * MODULE 5 — AI Security Chatbot endpoint.
 * ------------------------------------------------------------
 * Responsibilities:
 *   - Validate + sanitize the incoming message.
 *   - Call the Gemini service (multi-turn history).
 *   - If Gemini is unavailable, return a friendly fallback (no crash).
 *   - Persist chat turns to ChatLog (graceful if Mongo is down).
 *   - Rate limited + auth protected at the route layer.
 *   - Centralized error handling; errors logged without secrets.
 */
import gemini from '../services/security/gemini.js';
import ApiError from '../utils/ApiError.js';
import ChatLog from '../models/ChatLog.js';
import { sanitizePrompt } from '../utils/sanitizePrompt.js';
import logger from '../utils/logger.js';

// Friendly fallback when the AI service is not configured/unavailable.
const FALLBACK_REPLY =
  "I'm currently running without the AI service, so I can't answer in detail. " +
  'In the meantime, here are a few quick security tips: use a password manager, ' +
  'enable multi-factor authentication, keep software updated, and beware of ' +
  'unsolicited links or attachments. Please try again later.';

// Persist a single turn. Never throws — degrades to a warning log.
const persistTurn = async (userId, sessionId, role, text) => {
  try {
    await ChatLog.updateOne(
      { user: userId, sessionId },
      { $push: { messages: { role, text } } },
      { upsert: true }
    );
  } catch (err) {
    logger.warn(`ChatLog write failed (${err.message}) — continuing without persistence.`);
  }
};

export const chat = async (req, res, next) => {
  try {
    const { message, history, sessionId } = req.body;

    // 1. Input validation (route layer also validates; double-check here).
    if (typeof message !== 'string' || message.trim() === '') {
      throw new ApiError(400, 'A non-empty "message" field is required');
    }

    // 2. Sanitize before sending to the model.
    const safeMessage = sanitizePrompt(message);
    if (!safeMessage) throw new ApiError(400, 'Message contains no usable content');

    // 3. Stable session id for history continuity (fallback to user id).
    const sid = typeof sessionId === 'string' && sessionId ? sessionId : `sess-${req.user.id}`;

    // 4. If Gemini is not configured, return fallback gracefully.
    if (!gemini.isConfigured()) {
      await persistTurn(req.user.id, sid, 'user', safeMessage);
      await persistTurn(req.user.id, sid, 'model', FALLBACK_REPLY);
      return res.json({
        success: true,
        reply: FALLBACK_REPLY,
        aiEnabled: false,
        sessionId: sid,
      });
    }

    // 5. Normalize history into Gemini's expected shape.
    const safeHistory = Array.isArray(history)
      ? history
          .filter((h) => h && (h.role === 'user' || h.role === 'model') && typeof h.text === 'string')
          .map((h) => ({ role: h.role, parts: [{ text: sanitizePrompt(h.text) }] }))
      : [];

    // 6. Call Gemini (throws only on real failure -> caught below).
    let reply;
    try {
      reply = await gemini.ask(safeMessage, safeHistory);
    } catch (err) {
      // Log without leaking the prompt or internals.
      logger.error(`Gemini chat failed for user ${req.user.id}: ${err.message}`);
      reply = FALLBACK_REPLY;
    }

    // 7. Persist both turns (graceful if Mongo is down).
    await persistTurn(req.user.id, sid, 'user', safeMessage);
    await persistTurn(req.user.id, sid, 'model', reply);

    // 8. Structured JSON response.
    res.json({
      success: true,
      reply,
      aiEnabled: true,
      sessionId: sid,
    });
  } catch (err) {
    // 9. Centralized error handler (validation / unexpected).
    next(err);
  }
};

export default { chat };
