import mongoose from 'mongoose';

const securityAuditLogSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    userEmail: { type: String, index: true },
    action: {
      type: String,
      enum: [
        'cloud_provider_connect', 'cloud_scan', 'cloud_provider_add', 'cloud_provider_remove',
        'container_scan', 'container_image_scan', 'container_runtime_scan',
        'k8s_scan', 'k8s_resource_view', 'k8s_resource_modify',
        'finding_update', 'finding_assign', 'finding_resolve',
        'policy_create', 'policy_update', 'policy_delete',
        'credential_access', 'config_change', 'export_data',
      ],
      required: true,
      index: true,
    },
    resourceType: { type: String, enum: ['cloud', 'container', 'kubernetes', 'finding', 'policy', 'credential'], index: true },
    resourceId: { type: String, index: true },
    provider: { type: String, enum: ['aws', 'azure', 'gcp', 'docker', 'kubernetes'], index: true },
    ip: { type: String },
    userAgent: { type: String },
    status: { type: String, enum: ['success', 'failure', 'partial'], default: 'success' },
    details: { type: mongoose.Schema.Types.Mixed, default: {} },
    severity: { type: String, enum: ['Low', 'Medium', 'High', 'Critical'], default: 'Low' },
  },
  { timestamps: true }
);

securityAuditLogSchema.index({ createdAt: -1 });
securityAuditLogSchema.index({ userId: 1, createdAt: -1 });
securityAuditLogSchema.index({ action: 1, status: 1 });

const SecurityAuditLog = mongoose.model('SecurityAuditLog', securityAuditLogSchema);
export default SecurityAuditLog;
