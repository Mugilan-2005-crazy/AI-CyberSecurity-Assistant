import mongoose from 'mongoose';

const alertSchema = new mongoose.Schema(
  {
    alertId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, index: true },
    severity: {
      type: String,
      enum: ['INFO', 'WARNING', 'CRITICAL'],
      required: true,
      index: true,
    },
    message: { type: String, required: true },
    metric: { type: String, default: '' },
    value: { type: mongoose.Schema.Types.Mixed },
    threshold: { type: mongoose.Schema.Types.Mixed },
    status: {
      type: String,
      enum: ['active', 'acknowledged', 'resolved', 'suppressed'],
      default: 'active',
      index: true,
    },
    source: { type: String, default: 'alertEngine' },
    acknowledgedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    acknowledgedAt: { type: Date },
    resolvedAt: { type: Date },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

alertSchema.index({ severity: 1, status: 1 });
alertSchema.index({ createdAt: -1 });
alertSchema.index({ name: 1, createdAt: -1 });

const Alert = mongoose.model('Alert', alertSchema);
export default Alert;