/**
 * models/ScanHistory.js
 * ------------------------------------------------------------
 * "ScanHistory" collection. Every scan performed by a user
 * (URL, password, email, file, QR) is recorded here with a
 * normalized risk score (0-100) and verdict, so the dashboard
 * and analytics can aggregate activity.
 */
import mongoose from 'mongoose';

const scanSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: {
      type: String,
      enum: ['url', 'password', 'email', 'file', 'qr'],
      required: true,
    },
    input: { type: String, default: '' }, // sanitized/redacted target
    riskScore: { type: Number, min: 0, max: 100, default: 0 },
    verdict: {
      type: String,
      enum: ['safe', 'suspicious', 'malicious', 'unknown'],
      default: 'unknown',
    },
    details: { type: mongoose.Schema.Types.Mixed, default: {} },
    ip: { type: String },
  },
  { timestamps: true }
);

scanSchema.index({ user: 1, createdAt: -1 });

const ScanHistory = mongoose.model('ScanHistory', scanSchema);
export default ScanHistory;
