/**
 * models/Notification.js
 * ------------------------------------------------------------
 * "Notifications" collection. In-app alerts for users and
 * admins (e.g. new threat detected, account events).
 *
 * Extended for Phase 3 — Enterprise Real-Time Security Operations:
 *  - added `severity` and `category` fields for filtering/priority
 *  - added `type` enum for classification (ai_alert, ioc_alert,
 *    threat, scan_complete, incident_update, system)
 *  - added `metadata` for structured payload
 *  - backward compatible: `type` (info/warning/danger/success) is
 *    preserved and mapped to severity on read
 */
import mongoose from 'mongoose';

const NOTIFICATION_TYPES = ['ai_alert', 'ioc_alert', 'threat', 'scan_complete', 'incident_update', 'system'];
const SEVERITIES = ['low', 'medium', 'high', 'critical'];

const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    type: { type: String, enum: ['info', 'warning', 'danger', 'success'], default: 'info' },
    read: { type: Boolean, default: false },

    // Phase 3 extensions
    category: { type: String, enum: NOTIFICATION_TYPES, default: 'system', index: true },
    severity: { type: String, enum: SEVERITIES, default: 'low', index: true },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

notificationSchema.index({ user: 1, read: 1, createdAt: -1 });
notificationSchema.index({ user: 1, severity: 1, createdAt: -1 });
notificationSchema.index({ user: 1, category: 1, createdAt: -1 });

const Notification = mongoose.model('Notification', notificationSchema);
export { NOTIFICATION_TYPES, SEVERITIES };
export default Notification;
