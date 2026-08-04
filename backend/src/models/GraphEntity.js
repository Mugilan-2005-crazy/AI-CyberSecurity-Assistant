import mongoose from 'mongoose';

const graphEntitySchema = new mongoose.Schema(
  {
    entityType: {
      type: String,
      enum: ['User', 'IP', 'Domain', 'URL', 'Hash', 'Malware', 'ThreatActor', 'CVE', 'MITRETechnique', 'SecurityAlert', 'SecurityIncident', 'IncidentReport', 'CloudAsset', 'Vulnerability', 'AWSAccount', 'AzureTenant', 'GCPProject', 'Container', 'Image', 'KubernetesCluster', 'Pod', 'Namespace', 'IAMUser', 'CloudSecret', 'ServiceAccount'],
      required: true,
      index: true,
    },
    entityId: { type: String, required: true, index: true },
    label: { type: String, required: true },
    properties: { type: mongoose.Schema.Types.Mixed, default: {} },
    riskScore: { type: Number, min: 0, max: 100, default: 0 },
    threatLevel: {
      type: String,
      enum: ['Low', 'Medium', 'High', 'Critical'],
      default: 'Low',
      index: true,
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

graphEntitySchema.index({ entityType: 1, entityId: 1 }, { unique: true });
graphEntitySchema.index({ riskScore: -1 });
graphEntitySchema.index({ threatLevel: 1, createdAt: -1 });

const GraphEntity = mongoose.model('GraphEntity', graphEntitySchema);
export default GraphEntity;
