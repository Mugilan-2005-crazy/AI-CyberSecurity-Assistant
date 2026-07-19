/**
 * models/Report.js
 * ------------------------------------------------------------
 * "Reports" collection. Stores metadata for reports generated
 * by the Security Report Generator (the PDF binary itself is
 * returned to the client, not stored here).
 */
import mongoose from 'mongoose';

const reportSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true },
    period: {
      from: { type: Date },
      to: { type: Date },
    },
    summary: {
      totalScans: { type: Number, default: 0 },
      avgRiskScore: { type: Number, default: 0 },
      threatsDetected: { type: Number, default: 0 },
    },
    moduleBreakdown: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

const Report = mongoose.model('Report', reportSchema);
export default Report;
