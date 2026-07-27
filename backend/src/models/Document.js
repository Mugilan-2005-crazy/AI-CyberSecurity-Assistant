/**
 * models/Document.js
 * ============================================================
 * MODULE — Security Notes AI — Document collection.
 * Stores uploaded cybersecurity documents with extracted text,
 * chunked content, and processing status.
 */
import mongoose from 'mongoose';

const chunkSchema = new mongoose.Schema(
  {
    index: { type: Number, required: true },
    text: { type: String, required: true },
    embedding: { type: [Number] },
  },
  { _id: false }
);

const documentSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    filename: { type: String, required: true, trim: true },
    originalName: { type: String, required: true, trim: true },
    fileType: { type: String, required: true, enum: ['pdf', 'txt', 'docx', 'markdown'] },
    fileSize: { type: Number, required: true },
    filePath: { type: String },
    extractedText: { type: String },
    chunks: { type: [chunkSchema], default: [] },
    chunkCount: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['uploaded', 'extracting', 'chunking', 'embedding', 'ready', 'failed'],
      default: 'uploaded',
    },
    errorMessage: { type: String },
  },
  { timestamps: true }
);

documentSchema.index({ user: 1, createdAt: -1 });
documentSchema.index({ status: 1 });

const Document = mongoose.model('Document', documentSchema);
export default Document;