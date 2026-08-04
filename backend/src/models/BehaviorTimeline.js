import mongoose from 'mongoose';

const behaviorTimelineSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    eventType: { type: String, required: true, trim: true, index: true },

    category: {
      type: String,
      enum: ['authentication', 'security_activity', 'network_behavior', 'user_action'],
      required: true,
      index: true,
    },

    description: { type: String, required: true, trim: true, maxlength: 500 },

    details: { type: mongoose.Schema.Types.Mixed, default: {} },

    riskScore: { type: Number, min: 0, max: 100, default: 0 },

    anomalyMatched: { type: String, default: null },

    timestamp: { type: Date, default: Date.now },
  },
  { timestamps: { createdAt: false, updatedAt: false } }
);

behaviorTimelineSchema.index({ userId: 1, timestamp: -1 }, { expireAfterSeconds: 7776000 });
behaviorTimelineSchema.index({ userId: 1, category: 1, timestamp: -1 });

const BehaviorTimeline = mongoose.model('BehaviorTimeline', behaviorTimelineSchema);
export default BehaviorTimeline;
