import mongoose from 'mongoose';

const threatIntelSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    ioc: { type: String, required: true, index: true },
    iocType: {
      type: String,
      enum: ['ip', 'domain', 'url', 'hash', 'email', 'cve'],
      required: true,
      index: true,
    },
    reputationScore: { type: Number, min: 0, max: 100, default: 0 },
    classification: {
      type: String,
      enum: ['malicious', 'suspicious', 'clean', 'unknown'],
      default: 'unknown',
      index: true,
    },
    threatCategory: { type: String, default: 'unknown', index: true },
    malwareInfo: {
      family: { type: String, default: '' },
      type: { type: String, default: '' },
      isMalware: { type: Boolean, default: false },
      names: { type: [String], default: [] },
    },
    relatedCves: [{ type: String }],
    threatPriority: { type: String, enum: ['Unknown', 'Low', 'Medium', 'High', 'Critical'], default: 'Unknown', index: true },
    recommendedResponse: { type: String, default: 'monitor' },
    mitreTechniques: {
      type: [
        {
          techniqueId: String,
          techniqueName: String,
          tactic: String,
          severity: String,
          confidence: { type: Number, min: 0, max: 1 },
        },
      ],
      default: [],
    },
    attackTimeline: [
      {
        date: Date,
        event: String,
        source: String,
        description: String,
      },
    ],
    providers: { type: mongoose.Schema.Types.Mixed, default: {} },
    providerSuccess: { type: mongoose.Schema.Types.Mixed, default: {} },
    aiSummary: {
      response: { type: String, default: '' },
      provider: { type: String, default: 'none' },
      dangerousReason: { type: String, default: '' },
      attackPossibility: { type: String, default: '' },
      recommendedResponse: { type: String, default: '' },
    },
    cached: { type: Boolean, default: false },
    cachedAt: { type: Date },
  },
  { timestamps: true }
);

threatIntelSchema.index({ user: 1, createdAt: -1 });
threatIntelSchema.index({ ioc: 1, iocType: 1 });
threatIntelSchema.index({ reputationScore: -1 });
threatIntelSchema.index({ classification: 1, createdAt: -1 });
threatIntelSchema.index({ threatCategory: 1, createdAt: -1 });
threatIntelSchema.index({ user: 1, ioc: 1, iocType: 1 }, { unique: true });

const ThreatIntel = mongoose.model('ThreatIntel', threatIntelSchema);
export default ThreatIntel;
