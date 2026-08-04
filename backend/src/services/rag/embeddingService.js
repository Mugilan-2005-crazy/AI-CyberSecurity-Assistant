/**
 * services/rag/embeddingService.js
 * ============================================================
 * MODULE X — RAG Embedding Service.
 * ------------------------------------------------------------
 * Generates embeddings for text chunks using the existing
 * vectorStore infrastructure (Ollama embeddings with fallback).
 *
 * Reuses:
 *  - vectorStore.generateEmbedding
 *  - vectorStore.normalizeEmbedding
 *  - vectorStore.addChunks
 */

import * as vectorStore from '../vectorStore/vectorStore.js';
import { chunkText } from './textChunker.js';
import logger from '../../utils/logger.js';

const EMBEDDING_BATCH_SIZE = 10;

/**
 * Generate embeddings for an array of text chunks.
 * @param {Array<{text: string, index: number}>} chunks
 * @param {string} [documentId]
 * @returns {Promise<Array<{text: string, index: number, embedding: Float32Array|null}>>}
 */
export const embedChunks = async (chunks, documentId = 'rag-default') => {
  if (!Array.isArray(chunks) || chunks.length === 0) return [];

  const embedded = [];
  for (let i = 0; i < chunks.length; i += EMBEDDING_BATCH_SIZE) {
    const batch = chunks.slice(i, i + EMBEDDING_BATCH_SIZE);
    const results = await Promise.all(
      batch.map(async (chunk) => {
        try {
          const embedding = await vectorStore.generateEmbedding(chunk.text);
          return { ...chunk, embedding };
        } catch (err) {
          logger.warn('[embeddingService] Failed to embed chunk', { error: err.message, index: chunk.index });
          return { ...chunk, embedding: null };
        }
      })
    );
    embedded.push(...results);
  }

  if (documentId) {
    try {
      await vectorStore.addChunks(documentId, embedded);
    } catch (err) {
      logger.warn('[embeddingService] Failed to store chunks', { error: err.message, documentId });
    }
  }

  return embedded;
};

/**
 * Embed a full document text and store in vector store.
 * @param {string} text
 * @param {string} [documentId]
 * @param {object} [options]
 * @returns {Promise<Array<{text: string, index: number, embedding: Float32Array|null}>>}
 */
export const embedDocument = async (text, documentId = `doc-${Date.now()}`, options = {}) => {
  const chunks = chunkText(text, options);
  return embedChunks(chunks, documentId);
};

export default { embedChunks, embedDocument };
