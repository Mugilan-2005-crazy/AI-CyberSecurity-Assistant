import mongoose from 'mongoose';

const incidentResponseSchema = new mongoose.Schema(
  {
    incidentId: { type: mongoose.Schema.Types.ObjectId, ref: 'SecurityIncident', index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    threatType: { type: String, required: true, trim: true, maxlength: 100 },
    mitreTechnique: { type: mongoose.Schema.Types.Mixed, default: {} },
    investigationSummary: { type: String, maxlength: 2000 },
    recommendedActions: [
      {
        action: { type: String, required: true },
        priority: { type: String, enum: ['Low', 'Medium', 'High', 'Critical'], default: 'Medium' },
        category: { type: String, enum: ['containment', 'notification', 'remediation', 'monitoring'], default: 'containment' },
        approved: { type: Boolean, default: false },
        approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        executedAt: { type: Date },
      },
    ],
    priority: { type: String, enum: ['Low', 'Medium', 'High', 'Critical'], default: 'Medium', index: true },
    status: {
      type: String,
      enum: ['pending', 'investigating', 'approved', 'executed', 'rejected'],
      default: 'pending',
      index: true,
    },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    executedAt: { type: Date },
    confidenceScore: { type: Number, min: 0, max: 1, default: 0 },
    aiProvider: { type: String, enum: ['gemini', 'ollama', 'none'], default: 'none' },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

incidentResponseSchema.index({ incidentId: 1, userId: 1 });
incidentResponseSchema.index({ status: 1, priority: 1 });
incidentResponseSchema.index({ createdAt: -1 });

incidentResponseSchema.pre('save', function (next) {
  if (this.status === 'executed' && !this.executedAt) {
    this.executedAt = new Date();
  }
  if (this.status !== 'executed') {
    this.executedAt = undefined;
  }
  next();
});

const IncidentResponse = mongoose.model('IncidentResponse', incidentResponseSchema);
export default IncidentResponse;