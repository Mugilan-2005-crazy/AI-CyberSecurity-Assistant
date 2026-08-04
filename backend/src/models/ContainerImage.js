import mongoose from 'mongoose';

const vulnerabilitySchema = new mongoose.Schema(
  {
    cveId: { type: String, index: true },
    cvssScore: { type: Number, min: 0, max: 10 },
    severity: { type: String, enum: ['Low', 'Medium', 'High', 'Critical', 'Unknown'], default: 'Unknown' },
    title: { type: String },
    description: { type: String },
    pkgName: { type: String },
    installedVersion: { type: String },
    fixedVersion: { type: String },
  },
  { _id: false }
);

const containerImageSchema = new mongoose.Schema(
  {
    imageName: { type: String, required: true, index: true },
    imageTag: { type: String, default: 'latest' },
    digest: { type: String, index: true },
    size: { type: Number },
    os: { type: String },
    architecture: { type: String },
    createdAt: { type: Date },
    source: {
      type: String,
      enum: ['docker', 'registry', 'dockerfile', 'compose', 'kubernetes'],
      default: 'docker',
    },
    vulnerabilities: [vulnerabilitySchema],
    secrets: [
      {
        _id: false,
        file: { type: String },
        line: { type: Number },
        type: { type: String },
        match: { type: String },
        severity: { type: String, enum: ['Low', 'Medium', 'High', 'Critical'] },
      },
    ],
    misconfigurations: [
      {
        _id: false,
        file: { type: String },
        message: { type: String },
        severity: { type: String, enum: ['Low', 'Medium', 'High', 'Critical'] },
        description: { type: String },
        resolution: { type: String },
        longMessage: { type: String },
      },
    ],
    riskScore: { type: Number, min: 0, max: 100, default: 0 },
    riskLevel: { type: String, enum: ['Low', 'Medium', 'High', 'Critical'], default: 'Low' },
    status: { type: String, enum: ['pending', 'scanning', 'completed', 'failed'], default: 'pending' },
    scanResults: { type: mongoose.Schema.Types.Mixed, default: {} },
    scannedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

containerImageSchema.index({ imageName: 1, imageTag: 1 }, { unique: true });
containerImageSchema.index({ riskScore: -1 });

const ContainerImage = mongoose.model('ContainerImage', containerImageSchema);
export default ContainerImage;
