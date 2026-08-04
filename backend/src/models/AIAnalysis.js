import mongoose from 'mongoose';

const aiAnalysisSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    scanId: { type: mongoose.Schema.Types.ObjectId, ref: 'ScanHistory', index: true },
    scanType: {
      type: String,
      enum: ['url', 'password', 'email', 'file', 'qr'],
      required: true,
    },
    scanInput: { type: String, default: '' },

    threatScore: { type: Number, min: 0, max: 100, default: 0 },
    riskLevel: {
      type: String,
      enum: ['Low', 'Medium', 'High', 'Critical'],
      default: 'Low',
    },
    confidenceScore: { type: Number, min: 0, max: 1, default: 0 },

    executiveSummary: { type: String, default: '' },
    technicalSummary: { type: String, default: '' },
    rootCause: { type: String, default: '' },
    businessImpact: { type: String, default: '' },
    recommendedActions: { type: [String], default: [] },

    mitreTechniques: {
      type: [
        {
          techniqueId: String,
          techniqueName: String,
          tactic: String,
          severity: String,
          confidence: { type: Number, min: 0, max: 1 },
        },
      ],
      default: [],
    },

    cvssScore: { type: Number, min: 0, max: 10, default: null },
    cvssVector: { type: String, default: '' },
    cvssVersion: { type: String, default: '3.1' },

    aiProvider: { type: String, default: 'none' },
    aiProvidersUsed: { type: [String], default: [] },
    geminiContribution: { type: String, default: '' },
    ollamaContribution: { type: String, default: '' },

    status: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'reopened'],
      default: 'pending',
    },

    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

aiAnalysisSchema.index({ user: 1, createdAt: -1 });
aiAnalysisSchema.index({ scanType: 1, createdAt: -1 });
aiAnalysisSchema.index({ threatScore: -1 });
aiAnalysisSchema.index({ riskLevel: 1 });
aiAnalysisSchema.index({ status: 1 });

const AIAnalysis = mongoose.model('AIAnalysis', aiAnalysisSchema);
export default AIAnalysis;