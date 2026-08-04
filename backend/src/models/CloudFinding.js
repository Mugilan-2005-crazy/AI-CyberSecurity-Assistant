import mongoose from 'mongoose';

const cloudFindingSchema = new mongoose.Schema(
  {
    cloudProvider: { type: String, enum: ['aws', 'azure', 'gcp'], required: true, index: true },
    providerAccountId: { type: String, required: true, index: true },
    resourceId: { type: String, index: true },
    resourceType: { type: String, index: true },
    checkId: { type: String, required: true, index: true },
    checkName: { type: String, required: true },
    checkCategory: {
      type: String,
      enum: [
        'iam_misconfiguration',
        'public_storage',
        'weak_policies',
        'secrets_exposure',
        'network_misconfiguration',
        'open_security_groups',
        'inactive_keys',
        'unused_privileges',
        'privilege_escalation',
      ],
      required: true,
      index: true,
    },
    severity: { type: String, enum: ['Low', 'Medium', 'High', 'Critical'], required: true, index: true },
    riskScore: { type: Number, min: 0, max: 100, default: 0 },
    title: { type: String, required: true },
    description: { type: String, required: true },
    recommendation: { type: String, required: true },
    evidence: { type: mongoose.Schema.Types.Mixed, default: {} },
    status: { type: String, enum: ['open', 'in_progress', 'resolved', 'false_positive', 'mitigated'], default: 'open', index: true },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    resolvedAt: { type: Date },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    aiExplanation: { type: mongoose.Schema.Types.Mixed, default: {} },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

cloudFindingSchema.index({ cloudProvider: 1, severity: 1, status: 1 });
cloudFindingSchema.index({ checkCategory: 1, status: 1 });
cloudFindingSchema.index({ status: 'open', severity: -1 });

const CloudFinding = mongoose.model('CloudFinding', cloudFindingSchema);
export default CloudFinding;
