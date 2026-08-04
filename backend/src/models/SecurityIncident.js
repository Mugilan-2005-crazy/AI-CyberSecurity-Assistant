import mongoose from 'mongoose';

const incidentSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    threatType: { type: String, required: true, trim: true, maxlength: 100 },
    mitreTechnique: {
      techniqueId: { type: String },
      techniqueName: { type: String },
      tactic: { type: String },
      severity: { type: String, enum: ['Low', 'Medium', 'High', 'Critical'] },
    },
    severity: {
      type: String,
      enum: ['Low', 'Medium', 'High', 'Critical'],
      required: true,
      default: 'Medium',
      index: true,
    },
    status: {
      type: String,
      enum: ['open', 'in-progress', 'resolved', 'closed'],
      default: 'open',
      index: true,
    },
    description: { type: String, maxlength: 1000 },
    resolvedAt: { type: Date },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

incidentSchema.index({ userId: 1, status: 1 });
incidentSchema.index({ createdAt: -1 });
incidentSchema.index({ severity: 1, status: 1 });

incidentSchema.pre('save', function (next) {
  if (this.status === 'resolved' && !this.resolvedAt) {
    this.resolvedAt = new Date();
  }
  if (this.status !== 'resolved') {
    this.resolvedAt = undefined;
  }
  next();
});

const SecurityIncident = mongoose.model('SecurityIncident', incidentSchema);
export default SecurityIncident;