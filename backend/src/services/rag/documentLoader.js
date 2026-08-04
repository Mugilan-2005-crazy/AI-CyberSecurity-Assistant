/**
 * services/rag/documentLoader.js
 * ============================================================
 * MODULE X — RAG Document Loader.
 * ------------------------------------------------------------
 * Loads cybersecurity knowledge documents from:
 *  - Uploaded files (reuses documentService pipeline)
 *  - Built-in knowledge base text files
 *
 * Validates inputs and ensures no secrets are ingested.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { extractText, cleanText, validateFile } from '../documentService.js';
import logger from '../../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const KNOWLEDGE_BASE_DIR = path.resolve(__dirname, '..', '..', '..', 'knowledge');

const SECRET_PATTERNS = [
  /password\s*[:=]\s*\S+/i,
  /api[_-]?key\s*[:=]\s*\S+/i,
  /secret\s*[:=]\s*\S+/i,
  /token\s*[:=]\s*\S+/i,
  /-----BEGIN\s+(?:RSA\s+)?PRIVATE\s+KEY-----/i,
];

const MAX_KNOWLEDGE_FILE_SIZE = 5 * 1024 * 1024;

/**
 * Validate raw text for secrets before ingestion.
 * @param {string} text
 * @param {string} source
 * @returns {{ safe: boolean, matches: Array<string> }}
 */
export const validateTextSafety = (text, source = 'unknown') => {
  if (!text || typeof text !== 'string') return { safe: true, matches: [] };
  const matches = [];
  for (const pattern of SECRET_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      matches.push(match[0]);
    }
  }
  const safe = matches.length === 0;
  if (!safe) {
    logger.warn('[documentLoader] Potential secret detected', { source, matchCount: matches.length });
  }
  return { safe, matches };
};

/**
 * Load a document from an uploaded file buffer.
 * @param {object} file
 * @param {string} file.originalname
 * @param {number} file.size
 * @param {Buffer} file.buffer
 * @returns {Promise<{ text: string, chunks: Array<{text:string, index:number}> }>}
 */
export const loadFromFile = async (file) => {
  const validation = validateFile(file);
  if (!validation.valid) {
    throw new Error(`Invalid file: ${validation.errors.join(', ')}`);
  }

  const ext = path.extname(file.originalname).toLowerCase();
  const fileType = ext.slice(1);
  const tempPath = path.join('/tmp', `rag-${Date.now()}-${file.originalname}`);
  fs.writeFileSync(tempPath, file.buffer);

  try {
    const rawText = await extractText(tempPath, fileType);
    const cleaned = cleanText(rawText);
    const { safe } = validateTextSafety(cleaned, file.originalname);
    if (!safe) {
      throw new Error('Document contains potential secrets and cannot be processed.');
    }
    const chunks = splitIntoChunks(cleaned);
    return { text: cleaned, chunks };
  } finally {
    try { fs.unlinkSync(tempPath); } catch {}
  }
};

/**
 * Load documents from the built-in knowledge base directory.
 * @param {string} [topic]
 * @returns {Promise<Array<{ filename: string, text: string, chunks: Array<{text:string, index:number}> }>>}
 */
export const loadKnowledgeBase = async (topic) => {
  if (!fs.existsSync(KNOWLEDGE_BASE_DIR)) {
    logger.info('[documentLoader] Knowledge base directory not found, skipping.');
    return [];
  }

  const files = fs.readdirSync(KNOWLEDGE_BASE_DIR).filter((f) => {
    const ext = path.extname(f).toLowerCase();
    return ['.txt', '.md', '.json'].includes(ext);
  });

  const results = [];
  for (const file of files) {
    if (topic && !file.toLowerCase().includes(topic.toLowerCase())) continue;
    const fullPath = path.join(KNOWLEDGE_BASE_DIR, file);
    const stats = fs.statSync(fullPath);
    if (stats.size > MAX_KNOWLEDGE_FILE_SIZE) continue;

    const text = fs.readFileSync(fullPath, 'utf-8');
    const cleaned = cleanText(text);
    const { safe } = validateTextSafety(cleaned, file);
    if (!safe) continue;

    const chunks = splitIntoChunks(cleaned);
    results.push({ filename: file, text: cleaned, chunks });
  }

  return results;
};

function splitIntoChunks(text, maxSize = 800, overlap = 150) {
  if (!text || text.trim().length === 0) return [];
  const chunks = [];
  const paragraphs = text.split(/\n{2,}/);
  let current = '';

  for (const paragraph of paragraphs) {
    const trimmed = paragraph.trim();
    if (!trimmed) continue;
    if (current.length + trimmed.length + 2 <= maxSize) {
      current = current ? `${current}\n\n${trimmed}` : trimmed;
    } else {
      if (current) chunks.push(current.trim());
      if (trimmed.length > maxSize) {
        const sentences = trimmed.split(/(?<=[.!?])\s+/);
        let sentenceChunk = '';
        for (const sentence of sentences) {
          const test = sentenceChunk ? `${sentenceChunk} ${sentence}` : sentence;
          if (test.length <= maxSize) {
            sentenceChunk = test;
          } else {
            if (sentenceChunk) chunks.push(sentenceChunk.trim());
            sentenceChunk = sentence.length <= maxSize ? sentence : sentence.slice(0, maxSize);
          }
        }
        current = sentenceChunk;
      } else {
        current = trimmed;
      }
    }
  }
  if (current) chunks.push(current.trim());
  return chunks.map((text, i) => ({ text, index: i }));
}

export default {
  loadFromFile,
  loadKnowledgeBase,
  validateTextSafety,
};
