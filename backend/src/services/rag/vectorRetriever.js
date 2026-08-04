/**
 * services/rag/vectorRetriever.js
 * ============================================================
 * MODULE X — RAG Vector Retriever.
 * ------------------------------------------------------------
 * Performs similarity search over embedded document chunks
 * to retrieve relevant cybersecurity knowledge for a query.
 *
 * Reuses:
 *  - vectorStore.searchChunks
 *  - vectorStore.searchByText
 */

import * as vectorStore from '../vectorStore/vectorStore.js';
import { chunkText } from './textChunker.js';
import logger from '../../utils/logger.js';

const DEFAULT_TOP_K = 5;
const DEFAULT_MIN_SCORE = 0.15;

/**
 * Retrieve relevant chunks for a query.
 * @param {string} query
 * @param {object} [options]
 * @param {number} [options.topK=5]
 * @param {number} [options.minScore=0.15]
 * @param {string} [options.excludeDocId]
 * @returns {Promise<Array<{documentId: string, chunkIndex: number, text: string, score: number}>>}
 */
export const retrieve = async (query, options = {}) => {
  if (!query || typeof query !== 'string') return [];
  const topK = options.topK || DEFAULT_TOP_K;
  const minScore = options.minScore || DEFAULT_MIN_SCORE;

  try {
    const results = await vectorStore.searchByText(query, { topK, minScore, excludeDocId: options.excludeDocId });
    logger.info('[vectorRetriever] Retrieved chunks', { queryLength: query.length, resultCount: results.length, topK });
    return results;
  } catch (err) {
    logger.warn('[vectorRetriever] Search failed', { error: err.message });
    return [];
  }
};

/**
 * Retrieve context for a security question and format it for AI consumption.
 * @param {string} query
 * @param {object} [options]
 * @returns {Promise<{ context: string, sources: Array<string> }>}
 */
export const retrieveContext = async (query, options = {}) => {
  const results = await retrieve(query, options);
  if (results.length === 0) {
    return { context: '', sources: [] };
  }

  const context = results
    .map((r, i) => `[Source ${i + 1}] ${r.text}`)
    .join('\n\n');

  const sources = [...new Set(results.map((r) => r.documentId))];

  return { context, sources };
};

export default { retrieve, retrieveContext };
