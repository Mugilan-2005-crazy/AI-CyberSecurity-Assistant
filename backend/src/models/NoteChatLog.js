/**
 * models/NoteChatLog.js
 * ============================================================
 * MODULE — Security Notes AI — NoteChatLog collection.
 * Stores RAG-based document Q&A conversations per user/document.
 */
import mongoose from 'mongoose';

const noteChatLogSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    document: { type: mongoose.Schema.Types.ObjectId, ref: 'Document', required: true, index: true },
    question: { type: String, required: true, maxlength: 3000 },
    answer: { type: String, required: true, maxlength: 10000 },
    language: { type: String, maxlength: 10, default: 'en' },
    provider: { type: String, enum: ['ollama', 'gemini', 'none'], default: 'none' },
    relevantChunks: { type: Number, default: 0 },
  },
  { timestamps: true }
);

noteChatLogSchema.index({ user: 1, document: 1, createdAt: -1 });

const NoteChatLog = mongoose.model('NoteChatLog', noteChatLogSchema);
export default NoteChatLog;