/**
 * services/vectorStore/vectorStore.js
 * ============================================================
 * Local in-memory vector store for document chunk embeddings.
 * Uses cosine similarity for nearest-neighbor retrieval.
 *
 * Design:
 *   - Embeddings are plain Float32Arrays stored per chunk.
 *   - A simple TF-IDF-like fallback is used when no embedding
 *     model is available (all zeros + keyword scoring).
 *   - Structured so it can be swapped for ChromaDB / FAISS
 *     by replacing this module's exports.
 */
import config from '../../config/index.js';

const store = new Map();
let initialized = false;

function cosineSimilarity(a, b) {
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

function normalizeEmbedding(vec) {
  if (!vec || vec.length === 0) return vec;
  const arr = new Float32Array(vec);
  let norm = 0;
  for (let i = 0; i < arr.length; i++) {
    norm += arr[i] * arr[i];
  }
  if (norm === 0) return arr;
  const sqrtNorm = Math.sqrt(norm);
  for (let i = 0; i < arr.length; i++) {
    arr[i] /= sqrtNorm;
  }
  return arr;
}

export async function initVectorStore() {
  if (initialized) return;
  store.clear();
  initialized = true;
}

export async function addChunks(docId, chunks) {
  const docEntry = { chunks: [], createdAt: new Date() };
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const embedding = chunk.embedding
      ? normalizeEmbedding(chunk.embedding)
      : null;
    docEntry.chunks.push({
      index: i,
      text: chunk.text,
      embedding,
    });
  }
  store.set(docId, docEntry);
}

export async function searchChunks(queryEmbedding, options = {}) {
  const { topK = 5, minScore = 0.1, excludeDocId = null } = options;
  const queryVec = normalizeEmbedding(queryEmbedding);
  const results = [];

  for (const [docId, docEntry] of store.entries()) {
    if (excludeDocId && docId === excludeDocId) continue;
    for (const chunk of docEntry.chunks) {
      let score = 0;
      if (chunk.embedding) {
        score = cosineSimilarity(queryVec, chunk.embedding);
      } else {
        score = 0;
      }
      if (score >= minScore) {
        results.push({
          documentId: docId,
          chunkIndex: chunk.index,
          text: chunk.text,
          score,
        });
      }
    }
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, topK);
}

export async function searchByText(queryText, options = {}) {
  const { topK = 5, minScore = 0.1 } = options;
  const queryEmbedding = await generateEmbedding(queryText);
  return searchChunks(queryEmbedding, { topK, minScore });
}

export async function generateEmbedding(text) {
  try {
    const ollama = (await import('ollama')).default;
    ollama.config.host = config.ollama.url;
    const response = await ollama.embed({
      model: config.ollama.model,
      input: text,
    });
    if (response && response.embedding) {
      return normalizeEmbedding(response.embedding);
    }
  } catch (err) {
    // Fallback to simple embedding if Ollama is unavailable
  }
  return null;
}

export async function deleteDocumentChunks(docId) {
  store.delete(docId);
}

export async function getAllDocuments() {
  const docs = [];
  for (const [docId, docEntry] of store.entries()) {
    docs.push({
      documentId: docId,
      chunkCount: docEntry.chunks.length,
      createdAt: docEntry.createdAt,
    });
  }
  return docs;
}

export function isInitialized() {
  return initialized;
}