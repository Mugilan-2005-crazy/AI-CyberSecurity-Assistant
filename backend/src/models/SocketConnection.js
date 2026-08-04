/**
 * models/SocketConnection.js
 * ------------------------------------------------------------
 * Tracks active Socket.IO connections for heartbeat monitoring,
 * stale-session detection, and audit logging.
 */
import mongoose from 'mongoose';

const socketConnectionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    socketId: { type: String, required: true, unique: true, index: true },
    connectionId: { type: String, index: true },
    ip: { type: String, default: '' },
    userAgent: { type: String, default: '' },
    connectedAt: { type: Date, default: Date.now },
    lastPing: { type: Date, default: Date.now, index: true },
    lastSeen: { type: Date, default: Date.now, index: true },
    status: { type: String, enum: ['connected', 'stale', 'disconnected'], default: 'connected', index: true },
  },
  { timestamps: true }
);

socketConnectionSchema.index({ user: 1, status: 1 });

const SocketConnection = mongoose.model('SocketConnection', socketConnectionSchema);
export default SocketConnection;
