import mongoose from 'mongoose';
import { encrypt, decrypt } from '../utils/encryption.js';

const cloudProviderSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    provider: { type: String, enum: ['aws', 'azure', 'gcp'], required: true, index: true },
    accountId: { type: String, required: true, trim: true },
    accountName: { type: String, trim: true },
    region: { type: String, default: 'us-east-1' },
    status: { type: String, enum: ['connected', 'disconnected', 'error', 'pending'], default: 'pending', index: true },
    credentials: {
      accessKeyId: { type: String },
      secretAccessKey: {
        type: String,
        set: (v) => (v ? encrypt(v) : v),
        get: (v) => (v ? decrypt(v) : v),
      },
      sessionToken: {
        type: String,
        set: (v) => (v ? encrypt(v) : v),
        get: (v) => (v ? decrypt(v) : v),
      },
      tenantId: { type: String },
      clientId: { type: String },
      clientSecret: {
        type: String,
        set: (v) => (v ? encrypt(v) : v),
        get: (v) => (v ? decrypt(v) : v),
      },
      subscriptionId: { type: String },
      serviceAccountKey: {
        type: String,
        set: (v) => (v ? encrypt(v) : v),
        get: (v) => (v ? decrypt(v) : v),
      },
    },
    lastScanAt: { type: Date },
    lastScanStatus: { type: String, enum: ['pending', 'running', 'completed', 'failed'], default: 'pending' },
    riskScore: { type: Number, min: 0, max: 100, default: 0 },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    isEnabled: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

cloudProviderSchema.index({ provider: 1, accountId: 1 }, { unique: true });

cloudProviderSchema.virtual('decryptedSecret').get(function () {
  return this.credentials?.secretAccessKey;
});

cloudProviderSchema.set('toJSON', { virtuals: true });

const CloudProvider = mongoose.model('CloudProvider', cloudProviderSchema);
export default CloudProvider;
