/**
 * controllers/documentController.js
 * ============================================================
 * MODULE — Security Notes AI — Document upload, processing,
 * listing, deletion, and RAG-based Q&A.
 */
import { routeAI } from '../services/ai/aiRouter.js';
import Document from '../models/Document.js';
import NoteChatLog from '../models/NoteChatLog.js';
import * as documentService from '../services/documentService.js';
import * as vectorStore from '../services/vectorStore/vectorStore.js';
import ApiError from '../utils/ApiError.js';
import catchAsync from '../utils/catchAsync.js';
import logger from '../utils/logger.js';
import { sanitizePrompt } from '../utils/sanitizePrompt.js';
import multer from 'multer';
import fs from 'fs';
import path from 'path';

const ALLOWED_EXTENSIONS = ['.pdf', '.txt', '.docx', '.md', '.markdown'];
const MAX_FILE_SIZE = 25 * 1024 * 1024;

const storage = multer.diskStorage({
  destination: documentService.UPLOADS_DIR,
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const ext = path.extname(file.originalname);
    cb(null, `${unique}${ext}`);
  },
});

const fileFilter = (_req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return cb(new ApiError(400, `File type "${ext}" is not allowed`), false);
  }
  cb(null, true);
};

export const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter,
});

export const getSupportedFormats = (_req, _res, next) => {
  _res.json({
    success: true,
    formats: [
      { ext: '.pdf', description: 'PDF Document' },
      { ext: '.txt', description: 'Plain Text' },
      { ext: '.docx', description: 'Microsoft Word Document' },
      { ext: '.md', description: 'Markdown' },
    ],
    maxFileSize: MAX_FILE_SIZE,
  });
};

export const uploadDocument = catchAsync(async (req, res, next) => {
  if (!req.file) {
    return next(new ApiError(400, 'No file uploaded'));
  }

  const ext = path.extname(req.file.originalname).toLowerCase();
  const fileTypeMap = {
    '.pdf': 'pdf',
    '.txt': 'txt',
    '.docx': 'docx',
    '.md': 'markdown',
    '.markdown': 'markdown',
  };
  const fileType = fileTypeMap[ext];

  if (!fileType) {
    fs.unlinkSync(req.file.path);
    return next(new ApiError(400, `Unsupported file type: ${ext}`));
  }

  const doc = await Document.create({
    user: req.user.id,
    filename: req.file.filename,
    originalName: req.file.originalname,
    fileType,
    fileSize: req.file.size,
    filePath: req.file.filename,
    status: 'uploaded',
  });

  res.status(201).json({
    success: true,
    document: {
      id: doc._id,
      filename: doc.originalName,
      fileType: doc.fileType,
      fileSize: doc.fileSize,
      status: doc.status,
      createdAt: doc.createdAt,
    },
  });

  processInBackground(doc._id, req.file.filename, fileType, req.user.id);
});

async function processInBackground(documentId, filePath, fileType, userId) {
  try {
    await documentService.processDocument(documentId, filePath, fileType, '');
    logger.info(`Document ${documentId} processing completed`);
  } catch (err) {
    logger.error(`Document ${documentId} processing failed: ${err.message}`);
    await Document.findByIdAndUpdate(documentId, {
      status: 'failed',
      errorMessage: err.message,
    });
  }
}

export const getDocuments = catchAsync(async (req, res, next) => {
  const docs = await documentService.getUserDocuments(req.user.id);
  res.json({
    success: true,
    documents: docs.map((d) => ({
      id: d._id,
      filename: d.originalName,
      fileType: d.fileType,
      fileSize: d.fileSize,
      status: d.status,
      chunkCount: d.chunkCount,
      createdAt: d.createdAt,
      errorMessage: d.errorMessage,
    })),
  });
});

export const getDocument = catchAsync(async (req, res, next) => {
  const doc = await documentService.getDocumentById(req.params.id, req.user.id);
  if (!doc) return next(new ApiError(404, 'Document not found'));
  res.json({
    success: true,
    document: {
      id: doc._id,
      filename: doc.originalName,
      fileType: doc.fileType,
      fileSize: doc.fileSize,
      status: doc.status,
      chunkCount: doc.chunkCount,
      extractedText: doc.extractedText,
      createdAt: doc.createdAt,
    },
  });
});

export const deleteDocument = catchAsync(async (req, res, next) => {
  const doc = await documentService.deleteDocument(req.params.id, req.user.id);
  if (!doc) return next(new ApiError(404, 'Document not found'));
  res.json({ success: true, message: 'Document deleted' });
});

export const chat = catchAsync(async (req, res, next) => {
  const { documentId, message, language } = req.body;

  if (!documentId) {
    return next(new ApiError(400, 'documentId is required'));
  }

  if (typeof message !== 'string' || message.trim() === '') {
    return next(new ApiError(400, 'A non-empty "message" field is required'));
  }

  const doc = await Document.findOne({
    _id: documentId,
    user: req.user.id,
  });

  if (!doc) return next(new ApiError(404, 'Document not found'));
  if (doc.status !== 'ready') {
    return next(new ApiError(400, 'Document is not ready yet. Status: ' + doc.status));
  }

  const safeResult = sanitizePrompt(message);
  const safeMessage = safeResult.text;
  if (safeResult.flagged) {
    logger.warn(`[documentController] Prompt injection flagged for user ${req.user?.id}`);
  }
  const effectiveLanguage = (req.language && ['en', 'ta', 'tanglish', 'hi'].includes(req.language))
    ? req.language
    : 'en';

  const searchResult = await vectorStore.searchByText(safeMessage, { topK: 5, minScore: 0.1 });

  const relevantChunks = searchResult
    .filter((r) => r.documentId === documentId.toString())
    .map((r) => r.text);

  const context = relevantChunks.length > 0
    ? `Based on the uploaded document, here is the relevant context:\n\n${relevantChunks.map((c, i) => `[Chunk ${i + 1}]:\n${c}`).join('\n\n')}`
    : '';

  const prompt = context
    ? `You are a cybersecurity document assistant. Answer only using the provided document context.\n\n${context}\n\nUser question: ${safeMessage}\n\nIf the information is not available in the provided context, clearly say: "I could not find this information in your documents." Do not hallucinate.`
    : `You are a cybersecurity document assistant. The uploaded document does not contain enough information to answer the question. Say: "I could not find this information in your documents."`;

  let reply;
  let provider = 'none';

  try {
    const result = await routeAI(prompt, [], effectiveLanguage, req.user.id);
    reply = result.response;
    provider = result.provider;
  } catch (err) {
    logger.error(`AI routing failed for note chat: ${err.message}`);
    reply = "I'm currently unable to reach the AI services. Please try again later.";
    provider = 'none';
  }

  await NoteChatLog.create({
    user: req.user.id,
    document: documentId,
    question: safeMessage,
    answer: reply,
    language: effectiveLanguage,
    provider,
    relevantChunks: relevantChunks.length,
  });

  res.json({
    success: true,
    answer: reply,
    provider,
    relevantChunksCount: relevantChunks.length,
    language: effectiveLanguage,
    timestamp: new Date().toISOString(),
  });
});

export const getChatHistory = catchAsync(async (req, res, next) => {
  const { documentId } = req.params;

  const doc = await Document.findOne({
    _id: documentId,
    user: req.user.id,
  });

  if (!doc) return next(new ApiError(404, 'Document not found'));

  const logs = await NoteChatLog.find({ document: documentId })
    .sort({ createdAt: 1 })
    .limit(100)
    .select('question answer language provider relevantChunks createdAt')
    .lean();

  res.json({
    success: true,
    history: logs.map((log) => ({
      question: log.question,
      answer: log.answer,
      language: log.language,
      provider: log.provider,
      relevantChunks: log.relevantChunks,
      createdAt: log.createdAt,
    })),
  });
});

export const getSupportedLanguages = (_req, res, next) => {
  res.json({
    success: true,
    languages: ['en', 'ta', 'tanglish', 'hi'],
  });
};