/**
 * services/documentService.js
 * ============================================================
 * MODULE — Security Notes AI — Document Processing Pipeline.
 *
 * Pipeline:
 *   Upload → Text Extraction → Cleaning → Chunk Splitting
 *         → Embedding Generation → Vector Storage → Ready
 *
 * Supports: PDF (pdf-parse), DOCX (mammoth), TXT (fs), Markdown (fs)
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Document from '../models/Document.js';
import { sanitizePrompt } from '../utils/sanitizePrompt.js';
import * as vectorStore from './vectorStore/vectorStore.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOADS_DIR = path.resolve(__dirname, '..', '..', 'uploads');

const MAX_FILE_SIZE = 25 * 1024 * 1024;
const ALLOWED_EXTENSIONS = ['.pdf', '.txt', '.docx', '.md', '.markdown'];
const MAX_CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 200;

const MALICIOUS_FILE_PATTERNS = [
  /\.exe$/i, /\.scr$/i, /\.bat$/i, /\.cmd$/i, /\.js$/i,
  /\.jar$/i, /\.vbs$/i, /\.ps1$/i, /\.sh$/i,
  /\.pif$/i, /\.com$/i, /\.cpl$/i, /\.lnk$/i,
];

export function ensureUploadsDir() {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
}

export function validateFile(file) {
  const errors = [];

  if (!file || !file.originalname) {
    errors.push('No file provided');
    return { valid: false, errors };
  }

  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    errors.push(`File type "${ext}" is not allowed. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`);
  }

  if (file.size > MAX_FILE_SIZE) {
    errors.push(`File size ${file.size} bytes exceeds maximum of ${MAX_FILE_SIZE} bytes (25MB)`);
  }

  for (const pattern of MALICIOUS_FILE_PATTERNS) {
    if (pattern.test(file.originalname)) {
      errors.push('File type is not allowed for security reasons');
      break;
    }
  }

  if (file.originalname.includes('..') || file.originalname.includes('/') || file.originalname.includes('\\')) {
    errors.push('Invalid filename');
  }

  return { valid: errors.length === 0, errors };
}

export async function extractText(filePath, fileType) {
  const absolutePath = path.resolve(UPLOADS_DIR, filePath);

  switch (fileType) {
    case 'pdf': {
      try {
        const pdfParse = (await import('pdf-parse')).default;
        const pdfBuffer = fs.readFileSync(absolutePath);
        const data = await pdfParse(pdfBuffer);
        return data.text || '';
      } catch (err) {
        throw new Error(`PDF extraction failed: ${err.message}`);
      }
    }
    case 'docx': {
      try {
        const mammoth = (await import('mammoth')).default;
        const result = await mammoth.extractRawText({ path: absolutePath });
        return result.value || '';
      } catch (err) {
        throw new Error(`DOCX extraction failed: ${err.message}`);
      }
    }
    case 'txt':
    case 'markdown': {
      try {
        return fs.readFileSync(absolutePath, 'utf-8');
      } catch (err) {
        throw new Error(`Text extraction failed: ${err.message}`);
      }
    }
    default:
      throw new Error(`Unsupported file type: ${fileType}`);
  }
}

export function cleanText(text) {
  if (!text) return '';
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/[^\x20-\x7E\x0A\x0D\x00-\x7F]/g, '')
    .trim();
}

export function splitIntoChunks(text, maxSize = MAX_CHUNK_SIZE, overlap = CHUNK_OVERLAP) {
  if (!text || text.trim().length === 0) return [];

  const chunks = [];
  const paragraphs = text.split(/\n{2,}/);
  let currentChunk = '';

  for (const paragraph of paragraphs) {
    const trimmed = paragraph.trim();
    if (!trimmed) continue;

    if (currentChunk.length + trimmed.length + 2 <= maxSize) {
      currentChunk = currentChunk ? `${currentChunk}\n\n${trimmed}` : trimmed;
    } else {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
      }
      if (trimmed.length > maxSize) {
        const sentences = trimmed.split(/(?<=[.!?])\s+/);
        let sentenceChunk = '';
        for (const sentence of sentences) {
          const testChunk = sentenceChunk ? `${sentenceChunk} ${sentence}` : sentence;
          if (testChunk.length <= maxSize) {
            sentenceChunk = testChunk;
          } else {
            if (sentenceChunk) chunks.push(sentenceChunk.trim());
            sentenceChunk = sentence.length <= maxSize ? sentence : sentence.slice(0, maxSize);
          }
        }
        if (sentenceChunk) {
          currentChunk = sentenceChunk;
        } else {
          currentChunk = '';
        }
      } else {
        currentChunk = trimmed;
      }
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

export async function processDocument(documentId, filePath, fileType, originalName) {
  await Document.findByIdAndUpdate(documentId, { status: 'extracting' });

  const rawText = await extractText(filePath, fileType);
  await Document.findByIdAndUpdate(documentId, { extractedText: rawText, status: 'chunking' });

  const cleanedText = cleanText(rawText);
  const chunks = splitIntoChunks(cleanedText);
  const chunkObjects = chunks.map((text, i) => ({ index: i, text }));

  await Document.findByIdAndUpdate(documentId, {
    chunks: chunkObjects,
    chunkCount: chunkObjects.length,
    status: 'embedding',
  });

  const embeddedChunks = await embedChunks(documentId, chunkObjects);

  await Document.findByIdAndUpdate(documentId, {
    chunks: embeddedChunks,
    status: 'ready',
  });

  return { documentId, chunkCount: chunkObjects.length, status: 'ready' };
}

async function embedChunks(documentId, chunks) {
  const chunkObjects = [];

  for (const chunk of chunks) {
    let embedding = null;
    try {
      embedding = await vectorStore.generateEmbedding(chunk.text);
    } catch (err) {
      // Continue without embedding if generation fails
    }

    chunkObjects.push({
      index: chunk.index !== undefined ? chunk.index : chunkObjects.length,
      text: sanitizePrompt(chunk.text).text,
      embedding,
    });
  }

  await vectorStore.addChunks(documentId, chunkObjects);
  return chunkObjects;
}

export async function getUserDocuments(userId) {
  return Document.find({ user: userId }).sort({ createdAt: -1 }).lean();
}

export async function getDocumentById(documentId, userId) {
  return Document.findOne({ _id: documentId, user: userId }).lean();
}

export async function deleteDocument(documentId, userId) {
  const doc = await Document.findOne({ _id: documentId, user: userId });
  if (!doc) return null;

  await vectorStore.deleteDocumentChunks(documentId);
  await Document.findByIdAndDelete(documentId);

  const fullPath = path.join(UPLOADS_DIR, doc.filePath);
  if (fs.existsSync(fullPath)) {
    try { fs.unlinkSync(fullPath); } catch { /* ignore */ }
  }

  return doc;
}

export async function searchDocuments(query, userId) {
  const userDocs = await Document.find({ user: userId, status: 'ready' }).lean();
  if (userDocs.length === 0) return { answer: null, chunks: [] };

  const queryEmbedding = await vectorStore.generateEmbedding(query);
  const searchResults = [];

  for (const doc of userDocs) {
    const docChunks = doc.chunks || [];
    for (const chunk of docChunks) {
      if (!chunk.embedding) continue;
      const score = cosineSim(queryEmbedding, chunk.embedding);
      if (score > 0.1) {
        searchResults.push({
          documentId: doc._id.toString(),
          documentName: doc.originalName,
          chunkIndex: chunk.index,
          text: chunk.text,
          score,
        });
      }
    }
  }

  searchResults.sort((a, b) => b.score - a.score);
  const topChunks = searchResults.slice(0, 5).map((r) => r.text);

  return { searchResults, topChunks, docCount: userDocs.length };
}

function cosineSim(a, b) {
  if (!a || !b || a.length === 0 || b.length === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export default {
  ensureUploadsDir,
  validateFile,
  extractText,
  cleanText,
  splitIntoChunks,
  processDocument,
  getUserDocuments,
  getDocumentById,
  deleteDocument,
  searchDocuments,
  UPLOADS_DIR,
  MAX_FILE_SIZE,
  ALLOWED_EXTENSIONS,
};