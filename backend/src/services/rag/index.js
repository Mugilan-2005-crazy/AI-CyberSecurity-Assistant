/**
 * services/rag/index.js
 * ============================================================
 * Barrel export for the RAG module.
 */

import { loadFromFile, loadKnowledgeBase, validateTextSafety } from './documentLoader.js';
import { chunkText, mergeChunks } from './textChunker.js';
import { embedChunks, embedDocument } from './embeddingService.js';
import { retrieve, retrieveContext } from './vectorRetriever.js';
import { generateRAGAnswer } from './ragService.js';

export const rag = {
  loadFromFile,
  loadKnowledgeBase,
  validateTextSafety,
  chunkText,
  mergeChunks,
  embedChunks,
  embedDocument,
  retrieve,
  retrieveContext,
  generateRAGAnswer,
};

export default rag;
