import mongoose from 'mongoose';

const logEntrySchema = new mongoose.Schema(
  {
    level: {
      type: String,
      enum: ['debug', 'info', 'warn', 'error'],
      required: true,
      index: true,
    },
    message: { type: String, required: true },
    correlationId: { type: String, index: true },
    traceId: { type: String, index: true },
    spanId: { type: String, index: true },
    requestId: { type: String, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    tenantId: { type: String, index: true },
    service: { type: String, default: 'unknown', index: true },
    type: {
      type: String,
      enum: ['log', 'audit', 'security', 'cloud', 'container', 'ai', 'metric'],
      default: 'log',
      index: true,
    },
    details: { type: mongoose.Schema.Types.Mixed, default: {} },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

logEntrySchema.index({ correlationId: 1, createdAt: -1 });
logEntrySchema.index({ traceId: 1, createdAt: -1 });
logEntrySchema.index({ requestId: 1, createdAt: -1 });
logEntrySchema.index({ userId: 1, createdAt: -1 });
logEntrySchema.index({ type: 1, createdAt: -1 });
logEntrySchema.index({ service: 1, createdAt: -1 });
logEntrySchema.index({ level: 1, createdAt: -1 });

const LogEntry = mongoose.model('LogEntry', logEntrySchema);
export default LogEntry;