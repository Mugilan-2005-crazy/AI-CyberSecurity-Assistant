import mongoose from 'mongoose';

const DETECTION_DETAIL_SCHEMA = new mongoose.Schema(
  {
    type: { type: String, required: true },
    description: { type: String, required: true },
    confidence: { type: Number, min: 0, max: 1, default: 0.8 },
    evidence: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { _id: false }
);

const AI_EXPLANATION_SCHEMA = new mongoose.Schema(
  {
    explanation: { type: String, default: '' },
    threatPossibility: { type: String, default: '' },
    attackScenario: { type: String, default: '' },
    recommendedAction: { type: String, default: '' },
    provider: { type: String, default: 'none' },
  },
  { _id: false }
);

const userRiskEventSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    eventType: {
      type: String,
      enum: [
        'impossible_travel',
        'multiple_failed_logins',
        'abnormal_scan_activity',
        'account_takeover',
        'privilege_abuse',
        'login_anomaly',
        'device_anomaly',
        'location_anomaly',
      ],
      required: true,
      index: true,
    },

    detectionType: { type: String, default: 'automated', index: true },

    severity: { type: String, enum: ['Low', 'Medium', 'High', 'Critical'], required: true, index: true },

    riskScore: { type: Number, min: 0, max: 100, required: true, index: true },

    title: { type: String, required: true, trim: true, maxlength: 200 },

    description: { type: String, required: true, maxlength: 2000 },

    details: { type: mongoose.Schema.Types.Mixed, default: {} },

    detections: { type: [DETECTION_DETAIL_SCHEMA], default: [] },

    aiExplanation: { type: AI_EXPLANATION_SCHEMA, default: {} },

    status: { type: String, enum: ['active', 'investigating', 'resolved', 'dismissed'], default: 'active', index: true },

    relatedAlert: { type: mongoose.Schema.Types.ObjectId, ref: 'SecurityAlert', index: true },
    profileSnapshot: { type: mongoose.Schema.Types.Mixed, default: {} },

    createdAt: { type: Date, default: Date.now, index: true },
    resolvedAt: { type: Date, index: true },
  },
  { timestamps: { createdAt: true, updatedAt: true } }
);

userRiskEventSchema.index({ userId: 1, createdAt: -1 });
userRiskEventSchema.index({ severity: 1, status: 1 });
userRiskEventSchema.index({ eventType: 1, severity: 1 });

userRiskEventSchema.pre('save', function (next) {
  if (this.isModified('status') && (this.status === 'resolved' || this.status === 'dismissed') && !this.resolvedAt) {
    this.resolvedAt = new Date();
  }
  next();
});

userRiskEventSchema.methods.updateStatus = function (status) {
  this.status = status;
  if (status === 'resolved' || status === 'dismissed') {
    this.resolvedAt = new Date();
  }
  return this.save();
};

const UserRiskEvent = mongoose.model('UserRiskEvent', userRiskEventSchema);
export default UserRiskEvent;
