import mongoose from 'mongoose';

const cloudResourceSchema = new mongoose.Schema(
  {
    cloudProvider: { type: String, enum: ['aws', 'azure', 'gcp'], required: true, index: true },
    providerAccountId: { type: String, required: true, index: true },
    resourceType: {
      type: String,
      enum: [
        'iam_user', 'iam_role', 'iam_policy', 'ec2_instance', 's3_bucket', 'cloudtrail',
        'security_group', 'storage_account', 'virtual_machine', 'network_security_group',
        'compute_instance', 'cloud_storage_bucket', 'subscription', 'resource_group',
        'aks_cluster', 'eks_cluster', 'gke_cluster', 'container_registry', 'load_balancer',
        'firewall_rule', 'key_vault', 'secrets_manager',
      ],
      required: true,
      index: true,
    },
    resourceId: { type: String, required: true, index: true },
    name: { type: String, trim: true },
    region: { type: String, default: 'global' },
    tags: { type: mongoose.Schema.Types.Mixed, default: {} },
    properties: { type: mongoose.Schema.Types.Mixed, default: {} },
    riskScore: { type: Number, min: 0, max: 100, default: 0, index: true },
    isPublic: { type: Boolean, default: false, index: true },
    complianceStatus: {
      type: String,
      enum: ['compliant', 'non_compliant', 'not_applicable'],
      default: 'not_applicable',
    },
    findings: [{ type: mongoose.Schema.Types.ObjectId, ref: 'CloudFinding' }],
    lastScanned: { type: Date, default: Date.now, index: true },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

cloudResourceSchema.index({ cloudProvider: 1, resourceType: 1, resourceId: 1 }, { unique: true });
cloudResourceSchema.index({ riskScore: -1, lastScanned: -1 });

const CloudResource = mongoose.model('CloudResource', cloudResourceSchema);
export default CloudResource;
