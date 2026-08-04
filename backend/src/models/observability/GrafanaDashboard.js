import mongoose from 'mongoose';

const grafanaDashboardSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, index: true },
    description: { type: String, default: '' },
    category: {
      type: String,
      enum: ['system', 'infrastructure', 'application', 'security', 'ai', 'cloud', 'container', 'threat', 'executive', 'ueba'],
      required: true,
      index: true,
    },
    dashboardJson: { type: mongoose.Schema.Types.Mixed, required: true },
    version: { type: String, default: '1.0.0' },
    isDefault: { type: Boolean, default: false },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

grafanaDashboardSchema.index({ category: 1, name: 1 }, { unique: true });

const GrafanaDashboard = mongoose.model('GrafanaDashboard', grafanaDashboardSchema);
export default GrafanaDashboard;