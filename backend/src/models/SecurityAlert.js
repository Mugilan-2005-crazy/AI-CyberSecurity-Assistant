import mongoose from 'mongoose';

const securityAlertSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    alertType: {
      type: String,
      enum: ['malware_detected', 'phishing_attempt', 'risk_threshold', 'suspicious_login', 'repeated_attack', 'threat_intel_hit', 'cve_match', 'custom'],
      required: true,
    },
    severity: {
      type: String,
      enum: ['INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    message: { type: String, required: true, trim: true, maxlength: 1000 },
    source: { type: String, default: 'system', trim: true, maxlength: 100 },
    relatedIncident: { type: mongoose.Schema.Types.ObjectId, ref: 'SecurityIncident', index: true },
    status: {
      type: String,
      enum: ['unread', 'read', 'acknowledged', 'resolved'],
      default: 'unread',
      index: true,
    },
    acknowledgedAt: { type: Date },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

securityAlertSchema.index({ userId: 1, createdAt: -1 });
securityAlertSchema.index({ userId: 1, status: 1, createdAt: -1 });
securityAlertSchema.index({ severity: 1, status: 1 });

securityAlertSchema.pre('save', function (next) {
  if (this.status === 'acknowledged' || this.status === 'read') {
    if (!this.acknowledgedAt) this.acknowledgedAt = new Date();
  }
  next();
});

const SecurityAlert = mongoose.model('SecurityAlert', securityAlertSchema);
export default SecurityAlert;
