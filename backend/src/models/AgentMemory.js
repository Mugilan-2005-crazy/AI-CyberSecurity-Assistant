/**
 * models/AgentMemory.js
 * ============================================================
 * Persistent memory for the Autonomous AI Security Agent.
 * Stores user security context, risk history, assessments,
 * and recommendations in MongoDB.
 *
 * No sensitive raw data (passwords, URLs, file contents)
 * is stored here, only redacted metadata.
 */

import mongoose from 'mongoose';

const recommendationSchema = new mongoose.Schema({
  priority: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
  action: { type: String, required: true },
  detail: { type: String },
  source: { type: String, enum: ['ai', 'static'], default: 'static' },
});

const scanEntrySchema = new mongoose.Schema({
  type: { type: String, required: true },
  riskScore: { type: Number, min: 0, max: 100, default: 0 },
  verdict: {
    type: String,
    enum: ['safe', 'suspicious', 'malicious', 'unknown'],
    default: 'unknown',
  },
  createdAt: { type: Date, default: Date.now },
});

const assessmentEntrySchema = new mongoose.Schema({
  overallRiskScore: { type: Number, min: 0, max: 100 },
  verdict: { type: String },
  summary: { type: String },
  threatCount: { type: Number, default: 0 },
  maliciousCount: { type: Number, default: 0 },
  suspiciousCount: { type: Number, default: 0 },
  recommendations: [recommendationSchema],
  createdAt: { type: Date, default: Date.now },
});

const agentMemorySchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true, unique: true },
    device: { type: String, default: 'unknown' },
    location: { type: String, default: 'unknown' },
    overallRisk: { type: Number, min: 0, max: 100, default: 0 },
    recentScans: { type: [scanEntrySchema], default: [] },
    assessments: { type: [assessmentEntrySchema], default: [] },
    lastInteraction: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

agentMemorySchema.index({ user: 1, updatedAt: -1 });
agentMemorySchema.index({ user: 1, 'recentScans.createdAt': -1 });
agentMemorySchema.index({ user: 1, 'assessments.createdAt': -1 });

const AgentMemory = mongoose.model('AgentMemory', agentMemorySchema);
export default AgentMemory;
