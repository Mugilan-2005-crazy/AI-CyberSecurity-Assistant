import mongoose from 'mongoose';

const ACTIVITY_ENTRY_SCHEMA = new mongoose.Schema(
  {
    type: { type: String, enum: ['login', 'scan', 'threat_investigation', 'export', 'report_generation', 'graph_search', 'password_change', 'logout', 'cloud_login', 'cloud_api_call', 'iam_abuse', 'privilege_escalation', 'container_abuse', 'service_account_abuse', 'kubernetes_activity'], required: true, index: true },
    action: { type: String, required: true, trim: true },
    timestamp: { type: Date, default: Date.now, index: true },
    ip: { type: String, default: '' },
    location: { type: String, default: '' },
    device: { type: String, default: '' },
    riskScore: { type: Number, min: 0, max: 100, default: 0 },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { _id: false, timestamps: { createdAt: true, updatedAt: false } }
);

const BASELINE_SCHEMA = new mongoose.Schema(
  {
    normalLoginHours: {
      start: { type: Number, default: 8 },
      end: { type: Number, default: 18 },
    },
    commonLocations: [{ type: String }],
    commonDevices: [{ type: String }],
    averageActivityLevel: { type: Number, default: 5 },
    typicalSecurityActions: {
      scans: { type: Number, default: 5 },
      threatInvestigations: { type: Number, default: 0 },
      reportGenerations: { type: Number, default: 0 },
      graphSearches: { type: Number, default: 0 },
    },
  },
  { _id: false }
);

const ANOMALY_HISTORY_SCHEMA = new mongoose.Schema(
  {
    eventType: { type: String, required: true },
    severity: { type: String, enum: ['Low', 'Medium', 'High', 'Critical'], required: true },
    description: { type: String, required: true },
    detectedAt: { type: Date, default: Date.now },
    riskEventId: { type: mongoose.Schema.Types.ObjectId, ref: 'UserRiskEvent' },
  },
  { _id: false }
);

const userBehaviorProfileSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },

    baseline: { type: BASELINE_SCHEMA, default: () => ({}) },

    activityHistory: { type: [ACTIVITY_ENTRY_SCHEMA], default: [] },

    knownLocations: [{ type: String }],
    knownDevices: [{ type: String }],
    knownIps: [{ type: String }],

    averageRisk: { type: Number, min: 0, max: 100, default: 0 },

    riskScore: { type: Number, min: 0, max: 100, default: 0, index: true },
    riskLevel: { type: String, enum: ['Low', 'Medium', 'High', 'Critical'], default: 'Low', index: true },

    anomalyCount: { type: Number, default: 0 },
    highRiskAnomalyCount: { type: Number, default: 0 },

    isActive: { type: Boolean, default: true },

    lastUpdated: { type: Date, default: Date.now },

    anomalyHistory: { type: [ANOMALY_HISTORY_SCHEMA], default: [] },
  },
  { timestamps: true }
);

userBehaviorProfileSchema.index({ riskScore: -1 });
userBehaviorProfileSchema.index({ 'baseline.normalLoginHours.start': 1 });

userBehaviorProfileSchema.methods.getRiskLevel = function () {
  if (this.riskScore >= 81) return 'Critical';
  if (this.riskScore >= 61) return 'High';
  if (this.riskScore >= 31) return 'Medium';
  return 'Low';
};

userBehaviorProfileSchema.pre('save', function (next) {
  if (this.isModified('riskScore') || this.isModified('riskLevel')) {
    this.riskLevel = this.getRiskLevel();
  }
  this.lastUpdated = new Date();
  next();
});

const UserBehaviorProfile = mongoose.model('UserBehaviorProfile', userBehaviorProfileSchema);
export default UserBehaviorProfile;
