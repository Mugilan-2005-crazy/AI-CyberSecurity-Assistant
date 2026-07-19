/**
 * models/ChatLog.js
 * ============================================================
 * MODULE 5 — ChatLog collection.
 * Stores AI chatbot messages per user/session so conversation
 * history persists and can be audited. Additive: does not
 * modify any previous module's models.
 *
 * Note: only safe, non-sensitive metadata is stored. We do NOT
 * store raw secrets; messages are kept for support/analytics.
 */
import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema(
  {
    role: { type: String, enum: ['user', 'model'], required: true },
    text: { type: String, required: true, maxlength: 8000 },
  },
  { _id: false }
);

const chatLogSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    sessionId: { type: String, required: true, index: true },
    messages: { type: [messageSchema], default: [] },
  },
  { timestamps: true }
);

chatLogSchema.index({ user: 1, sessionId: 1 });

const ChatLog = mongoose.model('ChatLog', chatLogSchema);
export default ChatLog;
