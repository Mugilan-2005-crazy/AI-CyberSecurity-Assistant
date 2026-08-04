import mongoose from 'mongoose';

const observabilityMetricSchema = new mongoose.Schema(
  {
    metricName: { type: String, required: true, index: true },
    metricType: {
      type: String,
      enum: ['counter', 'gauge', 'histogram', 'summary'],
      required: true,
    },
    value: { type: mongoose.Schema.Types.Mixed, required: true },
    labels: { type: mongoose.Schema.Types.Mixed, default: {} },
    unit: { type: String, default: '' },
    timestamp: { type: Date, default: Date.now, index: true },
    source: { type: String, default: 'system' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

observabilityMetricSchema.index({ metricName: 1, timestamp: -1 });
observabilityMetricSchema.index({ source: 1, timestamp: -1 });

const ObservabilityMetric = mongoose.model('ObservabilityMetric', observabilityMetricSchema);
export default ObservabilityMetric;