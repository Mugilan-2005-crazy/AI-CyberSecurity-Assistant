/**
 * controllers/chatController.js
 * ============================================================
 * MODULE 5 — AI Security Chatbot endpoint (CyberSec Assistant v2).
 * ------------------------------------------------------------
 * Responsibilities:
 *   - Validate + sanitize the incoming message.
 *   - Fetch user's recent scan context for personalization.
 *   - Call the Gemini service with context-aware prompts.
 *   - Return structured response with category + suggestions.
 *   - Persist chat turns to ChatLog (graceful if Mongo is down).
 *   - Rate limited + auth protected at the route layer.
 *   - Centralized error handling; errors logged without secrets.
 */
import { searchWeb } from '../services/search/webSearchService.js';
import { routeAI } from '../services/ai/aiRouter.js';
import { routeMultimodalAI } from '../services/ai/aiRouter.js';
import ApiError from '../utils/ApiError.js';
import ChatLog from '../models/ChatLog.js';
import ScanHistory from '../models/ScanHistory.js';
import { sanitizePrompt } from '../utils/sanitizePrompt.js';
import { searchDocuments } from '../services/documentService.js';
import logger from '../utils/logger.js';

// Friendly fallback when the AI service is not configured/unavailable.
const FALLBACK_REPLY =
  "I'm currently running without the AI service, so I can't answer in detail. " +
  'In the meantime, here are a few quick security tips: use a password manager, ' +
  'enable multi-factor authentication, keep software updated, and beware of ' +
  'unsolicited links or attachments. Please try again later.';

const SUPPORTED_LANGUAGES = ['en', 'ta', 'tanglish', 'hi'];

// Simple language detection from user message.
const detectLanguage = (message) => {
  const trimmed = message.trim();
  if (!trimmed) return 'en';

  // Check for Tamil characters (Unicode range)
  if (/[\u0B80-\u0BFF]/.test(trimmed)) return 'ta';

  // Check for Devanagari (Hindi)
  if (/[\u0900-\u097F]/.test(trimmed)) return 'hi';

  // Check for Tanglish patterns (Tamil written in English letters)
  const tanglishPatterns = [
    /\b(en\s+(na|da|ku|kku|oda|atha|illa|irukku|pannu|panna|koodadhu|epdi|epadi|sollu|kelu|paaru|nenaichu|thattu|vittu|pogum|varum|illai|iruken|irukkirathu|irukka|irukkirathu|irukkirathu|irukkirathu|irukkirathu))/i,
    /\b(unga|enna|enna\s+panre|epadi|epdi|sollu|kelu|paaru|nenaichu|thattu|vittu|pogum|varum|illai|iruken|irukkirathu|irukka|irukkirathu|irukkirathu)/i,
    /\b(link\s+safe\s+ah\?)/i,
    /\b(phishing\s+email\s+)/i,
    /\b(password\s+strong\s+ah)/i,
  ];
  if (tanglishPatterns.some((p) => p.test(trimmed))) return 'tanglish';

  // Default to English
  return 'en';
};

// Category detection from user message keywords.
const CATEGORY_KEYWORDS = {
  'email-security': ['phish', 'email', 'spam', 'sender', 'attachment', 'inbox', 'suspicious link in email'],
  'url-security': ['url', 'link', 'website', 'site', 'http', 'domain', 'web'],
  'password-security': ['password', 'passwd', 'login', 'credential', 'username', 'strong password'],
  'malware-security': ['malware', 'virus', 'file', 'download', 'exe', 'trojan', 'ransomware', 'worm', 'infection'],
  'qr-security': ['qr', 'code', 'scan', 'camera', 'barcode'],
};

const SUGGESTIONS = {
  'email-security': [
    'How to detect phishing emails?',
    'Check if this sender is legitimate',
    'What should I do after clicking a suspicious link?',
  ],
  'url-security': [
    'Is this URL safe?',
    'How to verify a link before clicking?',
    'What makes a URL suspicious?',
  ],
  'password-security': [
    'How to create a strong password?',
    'Is my password strong enough?',
    'What is a password manager?',
  ],
  'malware-security': [
    'What should I do after malware detection?',
    'How to remove malware safely?',
    'How to prevent malware infections?',
  ],
  'qr-security': [
    'Are QR codes safe?',
    'How to verify a QR code?',
    'What risks do QR codes have?',
  ],
  'general': [
    'How can I improve my security?',
    'What are the latest cyber threats?',
    'Best practices for online safety',
  ],
};

const detectCategory = (message) => {
  const lower = message.toLowerCase();
  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((k) => lower.includes(k))) return cat;
  }
  return 'general';
};

// Build a context string from the user's recent scans.
const buildContextString = async (userId) => {
  try {
    const recent = await ScanHistory.find({ user: userId })
      .sort({ createdAt: -1 })
      .limit(3)
      .select('type input verdict riskScore createdAt');

    if (!recent.length) return '';

    const parts = recent.map((s) => {
      const date = s.createdAt.toLocaleDateString();
      const verdict = s.verdict || 'unknown';
      const risk = s.riskScore || 0;
      const target = s.input ? `Target: ${s.input}` : '';
      return `${date}: ${s.type} scan — ${target}, Risk: ${risk}, Verdict: ${verdict}`;
    });

    return `Recent user scan activity:\n${parts.join('\n')}`;
  } catch {
    return '';
  }
};

// Persist a single turn. Never throws — degrades to a warning log.
const persistTurn = async (userId, sessionId, role, text, category, language, attachment = null, provider = null) => {
  try {
    const messageDoc = { role, text };
    if (attachment && attachment.filename) {
      messageDoc.attachment = {
        filename: attachment.filename,
        mimeType: attachment.mimeType,
        size: attachment.size,
      };
    }
    if (provider) {
      messageDoc.provider = provider;
    }
    const updateDoc = {
      $push: { messages: messageDoc },
      $setOnInsert: { conversationTitle: text.length > 50 ? text.slice(0, 50) + '...' : text },
    };
    if (category) updateDoc.$set = { category };
    if (language) updateDoc.$set = { ...(updateDoc.$set || {}), language };

    await ChatLog.updateOne(
      { user: userId, sessionId },
      updateDoc,
      { upsert: true }
    );
  } catch (err) {
    logger.warn(`ChatLog write failed (${err.message}) — continuing without persistence.`);
  }
};

// -------------------- Chat Message --------------------

export const chat = async (req, res, next) => {
  try {
    const { message, history, sessionId } = req.body;

    logger.info('[chatController] POST /chat/message received', {
      messagePreview: message?.slice?.(0, 100),
      historyLength: Array.isArray(history) ? history.length : undefined,
      sessionId,
      userId: req.user?.id,
    });

    if (typeof message !== 'string' || message.trim() === '') {
      throw new ApiError(400, 'A non-empty "message" field is required');
    }

    const safeResult = sanitizePrompt(message);
    if (!safeResult.text) throw new ApiError(400, 'Message contains no usable content');

    const safeMessage = safeResult.text;
    if (safeResult.flagged) {
      logger.warn(`[chatController] Prompt injection flagged for user ${req.user.id}`);
    }

    const sid = typeof sessionId === 'string' && sessionId ? sessionId : `sess-${req.user.id}`;
    const category = detectCategory(safeMessage);
    const detectedLanguage = detectLanguage(safeMessage);
    const effectiveLanguage = req.language && SUPPORTED_LANGUAGES.includes(req.language)
      ? req.language
      : detectedLanguage;

    const safeHistory = Array.isArray(history)
      ? history
          .filter((h) => h && (h.role === 'user' || h.role === 'model') && typeof h.text === 'string')
          .map((h) => {
            const r = sanitizePrompt(h.text);
            return { role: h.role, text: r.text };
          })
      : [];

    let reply;
    let provider = 'none';

    try {
      const context = await buildContextString(req.user.id);
      const docResults = await searchDocuments(safeMessage, req.user.id);
      const docContext = (docResults?.topChunks || []).length > 0
        ? `\n\nRelevant document context:\n${(docResults.topChunks || []).join('\n\n')}`
        : '';
      const prompt = context ? `${context}${docContext}\n\nUser: ${safeMessage}` : `${safeMessage}${docContext}`;
      logger.info('[chatController] Calling routeAI with prompt', { promptPreview: prompt.slice(0, 150) });
      const result = await routeAI(prompt, safeHistory, effectiveLanguage, req.user.id);
      reply = result.response;
      provider = result.provider;
      logger.info('[chatController] AI result received', { provider, replyPreview: reply.slice(0, 100) });
    } catch (err) {
      logger.error(`AI routing failed for user ${req.user.id}: ${err.message}`, { error: err.message, stack: err.stack });
      reply = FALLBACK_REPLY;
      provider = 'none';
    }

    await persistTurn(req.user.id, sid, 'user', safeMessage, category);
    await persistTurn(req.user.id, sid, 'model', reply, category, effectiveLanguage, null, provider);

    const responsePayload = {
      success: true,
      reply,
      provider,
      category,
      suggestions: SUGGESTIONS[category] || SUGGESTIONS['general'],
      timestamp: new Date().toISOString(),
      sessionId: sid,
      aiEnabled: provider !== 'none',
    };

    logger.info('[chatController] Sending response', { provider, replyPreview: reply.slice(0, 100) });
    res.json(responsePayload);
  } catch (err) {
    logger.error('[chatController] Unhandled error', { error: err.message, stack: err.stack });
    next(err);
  }
};

export const multimodalChat = async (req, res, next) => {
  try {
    const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
    const sessionId = typeof req.body?.sessionId === 'string' && req.body.sessionId ? req.body.sessionId : `sess-${req.user.id}`;
    const file = req.file;

    if (!file && !message) {
      throw new ApiError(400, 'A message or file is required');
    }

    logger.info('[chatController] multimodalChat received', {
      userId: req.user?.id,
      filename: file?.originalname,
      mimetype: file?.mimetype,
      size: file?.size,
      messagePreview: message.slice(0, 100),
      sessionId,
    });

    const safeResult = message ? sanitizePrompt(message) : { text: 'Please analyze this file for security threats.', flagged: false };
    const safeMessage = safeResult.text;
    if (safeResult.flagged) {
      logger.warn(`[chatController] Prompt injection flagged in multimodal for user ${req.user.id}`);
    }
    const sid = sessionId;
    const category = detectCategory(safeMessage);
    const detectedLanguage = detectLanguage(safeMessage);
    const effectiveLanguage = req.language && SUPPORTED_LANGUAGES.includes(req.language) ? req.language : detectedLanguage;

    let reply;
    let provider = 'none';
    let attachmentAnalysisId = null;
    let multimodalResult = null;

    try {
      if (file) {
        logger.info('[chatController] Routing to multimodal AI', { filename: file.originalname, mimetype: file.mimetype, language: effectiveLanguage });
        multimodalResult = await routeMultimodalAI(file.buffer, file.originalname, file.mimetype, effectiveLanguage, safeMessage, req.user.id);
        reply = multimodalResult.response;
        provider = multimodalResult.provider;
        attachmentAnalysisId = multimodalResult.result?.attachmentAnalysisId || null;
        logger.info('[chatController] Multimodal AI response received', { provider, replyPreview: reply.slice(0, 100) });
      } else {
        const result = await routeAI(safeMessage, [], effectiveLanguage, req.user.id);
        reply = result.response;
        provider = result.provider;
        logger.info('[chatController] Text-only AI response received', { provider, replyPreview: reply.slice(0, 100) });
      }
    } catch (err) {
      logger.error(`Multimodal routing failed for user ${req.user.id}: ${err.message}`, { error: err.message, stack: err.stack });
      reply = FALLBACK_REPLY;
      provider = 'none';
    }

    await persistTurn(req.user.id, sid, 'user', safeMessage, category, effectiveLanguage, file ? { filename: file.originalname, mimeType: file.mimetype, size: file.size } : null);
    await persistTurn(req.user.id, sid, 'model', reply, category, effectiveLanguage, null, provider);

    const responsePayload = {
      success: true,
      reply,
      provider,
      category,
      suggestions: SUGGESTIONS[category] || SUGGESTIONS['general'],
      timestamp: new Date().toISOString(),
      sessionId: sid,
      aiEnabled: provider !== 'none',
      attachment: file ? { filename: file.originalname, mimeType: file.mimetype, size: file.size } : null,
      attachmentAnalysisId,
      report: multimodalResult?.result?.report || null,
    };
    logger.info('[chatController] multimodalChat response sent', { provider, replyPreview: reply.slice(0, 100), sessionId: sid });
    res.json(responsePayload);
  } catch (err) {
    logger.error('[chatController] Multimodal unhandled error', { error: err.message, stack: err.stack });
    next(err);
  }
};

// -------------------- Chat History --------------------

export const getChatHistory = async (req, res, next) => {
  try {
    const sessions = await ChatLog.find({ user: req.user.id })
      .sort({ updatedAt: -1 })
      .limit(20)
      .select('sessionId conversationTitle category updatedAt messages')
      .lean();

    const formatted = sessions.map((s) => ({
      sessionId: s.sessionId,
      conversationTitle: s.conversationTitle || s.messages[0]?.text?.slice(0, 60) || 'New Conversation',
      category: s.category,
      updatedAt: s.updatedAt,
      messageCount: s.messages.length,
      preview: s.messages[0]?.text?.slice(0, 80) || '',
      messages: s.messages,
    }));

    res.json({ success: true, sessions: formatted });
  } catch (err) {
    next(err);
  }
};

export const clearChatHistory = async (req, res, next) => {
  try {
    await ChatLog.deleteMany({ user: req.user.id });
    res.json({ success: true, message: 'Chat history cleared' });
  } catch (err) {
    next(err);
  }
};

export const webSearch = async (req, res, next) => {
  try {
    const { query } = req.body;

    if (typeof query !== 'string' || !query.trim()) {
      throw new ApiError(400, 'A non-empty "query" field is required');
    }

    const safeResult = sanitizePrompt(query);
    const safeQuery = safeResult.text;
    if (!safeQuery) throw new ApiError(400, 'Query contains no usable content');
    if (safeResult.flagged) {
      logger.warn(`[webSearch] Prompt injection flagged for user ${req.user.id}`);
    }

    logger.info('[webSearch] Search request received', { queryPreview: safeQuery.slice(0, 100) });

    const searchResult = await searchWeb(safeQuery);

    let aiSummary = searchResult.summary;
    let provider = 'web-search';

    try {
      const summaryPrompt = `Summarize these web search results for a cybersecurity professional. Provide a concise, actionable summary.\n\nSearch results:\n${searchResult.summary}\n\nUser query: ${safeQuery}`;
      const aiResult = await routeAI(summaryPrompt, [], req.language || 'en', req.user.id);
      aiSummary = aiResult.response;
      provider = aiResult.provider;
    } catch (aiErr) {
      logger.warn(`[webSearch] AI summarization failed, using fallback: ${aiErr.message}`);
    }

    logger.info('[webSearch] Search completed', { queryPreview: safeQuery.slice(0, 50), resultCount: searchResult.resultCount, provider });

    res.json({
      success: true,
      provider,
      answer: aiSummary,
      sources: searchResult.results.map((r) => ({
        title: r.title,
        url: r.url,
        snippet: r.snippet,
      })),
      sourceCount: searchResult.resultCount,
      query: safeQuery,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    logger.error(`[webSearch] Error: ${err.message}`);
    next(err);
  }
};
