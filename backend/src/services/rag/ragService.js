/**
 * services/rag/ragService.js
 * ============================================================
 * MODULE X — RAG Service.
 * ------------------------------------------------------------
 * Combines retrieval and AI generation to produce
 * context-aware cybersecurity answers.
 *
 * Pipeline:
 *  1. Retrieve relevant knowledge from vector store
 *  2. Build augmented prompt with context
 *  3. Route to AI provider (Gemini / Ollama)
 *  4. Return answer with sources
 */

import { routeAI } from '../ai/aiRouter.js';
import { retrieveContext } from './vectorRetriever.js';
import { sanitizePrompt } from '../../utils/sanitizePrompt.js';
import logger from '../../utils/logger.js';

const MAX_CONTEXT_LENGTH = 3000;
const FALLBACK_REPLY =
  "I don't have specific knowledge about that in my security database. " +
  'However, I can still provide general cybersecurity guidance. ' +
  'For the most accurate information, please consult official security documentation or a certified professional.';

/**
 * Build an augmented prompt with retrieved context.
 * @param {string} query
 * @param {string} context
 * @returns {string}
 */
const buildAugmentedPrompt = (query, context) => {
  if (!context || context.trim().length === 0) {
    return query;
  }
  const trimmedContext = context.slice(0, MAX_CONTEXT_LENGTH);
  return `You are a cybersecurity assistant. Use the following retrieved knowledge to answer the user's question. If the knowledge does not contain the answer, say so honestly and provide general guidance.

Knowledge Base:
${trimmedContext}

User Question: ${query}

Instructions:
- Answer based on the knowledge base first.
- If the knowledge base does not cover the question, provide general cybersecurity best practices.
- Do not make up facts.
- Keep the answer concise and actionable.`;
};

/**
 * Generate a RAG-enhanced security answer.
 * @param {string} query
 * @param {object} [options]
 * @param {string} [options.language='en']
 * @param {number} [options.topK=5]
 * @param {string} [options.excludeDocId]
 * @returns {Promise<{ answer: string, sources: Array<string>, provider: string }>}
 */
export const generateRAGAnswer = async (query, options = {}) => {
  try {
    if (!query || typeof query !== 'string') {
      return { answer: 'Please provide a valid question.', sources: [], provider: 'none' };
    }

    const { text: sanitizedQuery, flagged } = sanitizePrompt(query);
    if (flagged) {
      logger.warn('[ragService] Prompt injection flagged in RAG query');
    }

    const { context, sources } = await retrieveContext(sanitizedQuery, options);
    const prompt = buildAugmentedPrompt(sanitizedQuery, context);

    const result = await routeAI(prompt, [], options.language || 'en');
    const answer = result?.response || FALLBACK_REPLY;

    logger.info('[ragService] RAG answer generated', {
      queryLength: sanitizedQuery.length,
      contextLength: context.length,
      sourceCount: sources.length,
      provider: result?.provider || 'unknown',
    });

    return {
      answer,
      sources,
      provider: result?.provider || 'none',
    };
  } catch (err) {
    logger.error('[ragService] RAG generation failed', { error: err.message });
    return {
      answer: FALLBACK_REPLY,
      sources: [],
      provider: 'none',
    };
  }
};

export default { generateRAGAnswer };
