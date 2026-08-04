import mongoose from 'mongoose';

const incidentReportSchema = new mongoose.Schema(
  {
    incidentId: { type: mongoose.Schema.Types.ObjectId, ref: 'SecurityIncident', required: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    severity: {
      type: String,
      enum: ['Low', 'Medium', 'High', 'Critical'],
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['generating', 'completed', 'failed'],
      default: 'generating',
      index: true,
    },
    executiveSummary: { type: String, default: '' },
    technicalSummary: { type: String, default: '' },
    businessImpact: { type: String, default: '' },
    priorityActions: [{ type: String }],
    recoveryRecommendation: { type: String, default: '' },
    attackVector: { type: String, default: '' },
    rootCause: { type: String, default: '' },
    indicatorsOfCompromise: [{ type: String }],
    mitreMapping: [
      {
        techniqueId: String,
        techniqueName: String,
        tactic: String,
        severity: String,
      },
    ],
    cvss: {
      score: { type: Number, min: 0, max: 10, default: null },
      vector: { type: String, default: '' },
      version: { type: String, default: '3.1' },
    },
    vulnerabilities: [{ type: String }],
    evidence: [
      {
        type: { type: String, enum: ['scan', 'alert', 'threat_intel', 'ai_analysis', 'log'] },
        sourceId: { type: mongoose.Schema.Types.ObjectId },
        description: { type: String },
        timestamp: { type: Date },
      },
    ],
    timeline: [
      {
        timestamp: { type: Date, required: true },
        event: { type: String, required: true },
        source: { type: String, required: true },
        description: { type: String },
      },
    ],
    recommendations: [{ type: String }],
    aiProvider: { type: String, default: 'none' },
    aiProvidersUsed: [{ type: String }],
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    shareToken: { type: String, default: '', index: true },
    shareExpiresAt: { type: Date },
    emailedTo: [{ type: String }],
  },
  { timestamps: true }
);

incidentReportSchema.index({ createdBy: 1, createdAt: -1 });
incidentReportSchema.index({ incidentId: 1, createdAt: -1 });
incidentReportSchema.index({ severity: 1, status: 1 });

const IncidentReport = mongoose.model('IncidentReport', incidentReportSchema);
export default IncidentReport;
