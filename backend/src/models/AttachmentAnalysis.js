/**
 * models/AttachmentAnalysis.js
 * ------------------------------------------------------------
 * AttachmentAnalysis collection.
 * Stores file-based AI security analysis results linked to
 * chat messages so users can review past uploads.
 */
import mongoose from 'mongoose';

const attachmentAnalysisSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    filename: { type: String, required: true },
    fileType: { type: String, required: true },
    fileSize: { type: Number, required: true },
    mimeType: { type: String },
    uploadDate: { type: Date, default: Date.now },
    analysisResult: { type: String, required: true },
    threatLevel: { type: String, enum: ['safe', 'suspicious', 'malicious', 'unknown'], default: 'unknown' },
    detectedIssues: { type: [String], default: [] },
    chatSessionId: { type: String },
    chatMessageId: { type: String },
  },
  { timestamps: true }
);

attachmentAnalysisSchema.index({ user: 1, uploadDate: -1 });

const AttachmentAnalysis = mongoose.model('AttachmentAnalysis', attachmentAnalysisSchema);
export default AttachmentAnalysis;
