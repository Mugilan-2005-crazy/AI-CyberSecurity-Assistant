import mongoose from 'mongoose';

const grafanaProvisioningSchema = new mongoose.Schema(
  {
    dashboardUid: { type: String, required: true, unique: true, index: true },
    dashboardName: { type: String, required: true },
    category: { type: String, required: true, index: true },
    provisioningSource: { type: String, default: 'file' },
    filePath: { type: String, default: '' },
    isDefault: { type: Boolean, default: false },
    version: { type: String, default: '1.0.0' },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

grafanaProvisioningSchema.index({ category: 1, dashboardName: 1 });

const GrafanaProvisioning = mongoose.model('GrafanaProvisioning', grafanaProvisioningSchema);
export default GrafanaProvisioning;