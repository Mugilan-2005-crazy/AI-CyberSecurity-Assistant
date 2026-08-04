import mongoose from 'mongoose';

const healthCheckSchema = new mongoose.Schema(
  {
    checkName: { type: String, required: true, index: true },
    status: {
      type: String,
      enum: ['healthy', 'unhealthy', 'degraded', 'critical'],
      required: true,
      index: true,
    },
    details: { type: mongoose.Schema.Types.Mixed, default: {} },
    error: { type: String, default: '' },
    consecutiveFailures: { type: Number, default: 0 },
    latencyMs: { type: Number, default: 0 },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

healthCheckSchema.index({ checkName: 1, createdAt: -1 });
healthCheckSchema.index({ status: 1, createdAt: -1 });

const HealthCheck = mongoose.model('HealthCheck', healthCheckSchema);
export default HealthCheck;