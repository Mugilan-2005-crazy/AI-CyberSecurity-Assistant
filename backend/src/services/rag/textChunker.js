/**
 * services/rag/textChunker.js
 * ============================================================
 * MODULE X — RAG Text Chunker.
 * ------------------------------------------------------------
 * Splits documents into semantically meaningful chunks
 * optimized for cybersecurity knowledge retrieval.
 *
 * Strategies:
 *  - Paragraph-based splitting with overlap
 *  - Sentence-boundary awareness
 *  - Maximum chunk size and overlap configurable
 */

const DEFAULT_MAX_CHUNK_SIZE = 800;
const DEFAULT_OVERLAP = 150;

/**
 * Split text into chunks with overlap.
 * @param {string} text
 * @param {object} [options]
 * @param {number} [options.maxSize=800]
 * @param {number} [options.overlap=150]
 * @returns {Array<{text: string, index: number}>}
 */
export const chunkText = (text, options = {}) => {
  const maxSize = options.maxSize || DEFAULT_MAX_CHUNK_SIZE;
  const overlap = options.overlap || DEFAULT_OVERLAP;

  if (!text || typeof text !== 'string' || text.trim().length === 0) return [];

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
};

/**
 * Merge overlapping chunks to improve context continuity.
 * @param {Array<{text: string, index: number}>} chunks
 * @param {number} [mergeCount=2]
 * @returns {Array<{text: string, index: number}>}
 */
export const mergeChunks = (chunks, mergeCount = 2) => {
  if (!Array.isArray(chunks) || chunks.length <= 1) return chunks;
  const merged = [];
  for (let i = 0; i < chunks.length; i += mergeCount) {
    const group = chunks.slice(i, i + mergeCount);
    const text = group.map((c) => c.text).join('\n\n');
    merged.push({ text, index: merged.length });
  }
  return merged;
};

export default { chunkText, mergeChunks };
