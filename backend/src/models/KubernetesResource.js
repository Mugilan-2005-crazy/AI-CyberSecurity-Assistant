import mongoose from 'mongoose';

const kubeResourceSchema = new mongoose.Schema(
  {
    clusterName: { type: String, required: true, index: true },
    provider: { type: String, enum: ['aws', 'azure', 'gcp'], index: true },
    clusterId: { type: String, index: true },
    namespace: { type: String, required: true, index: true },
    kind: {
      type: String,
      enum: [
        'Pod', 'Deployment', 'Service', 'Ingress', 'ConfigMap', 'Secret',
        'ServiceAccount', 'Role', 'RoleBinding', 'ClusterRole', 'ClusterRoleBinding',
        'NetworkPolicy', 'Node', 'DaemonSet', 'StatefulSet',
      ],
      required: true,
      index: true,
    },
    name: { type: String, required: true },
    resourceVersion: { type: String },
    labels: { type: mongoose.Schema.Types.Mixed, default: {} },
    spec: { type: mongoose.Schema.Types.Mixed, default: {} },
    status: { type: mongoose.Schema.Types.Mixed, default: {} },
    riskScore: { type: Number, min: 0, max: 100, default: 0, index: true },
    findings: [{ type: mongoose.Schema.Types.Mixed }],
    lastScanned: { type: Date, default: Date.now, index: true },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

kubeResourceSchema.index({ clusterName: 1, namespace: 1, kind: 1, name: 1 }, { unique: true });
kubeResourceSchema.index({ riskScore: -1, lastScanned: -1 });

const KubernetesResource = mongoose.model('KubernetesResource', kubeResourceSchema);
export default KubernetesResource;
