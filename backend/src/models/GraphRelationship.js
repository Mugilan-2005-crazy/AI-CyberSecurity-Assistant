import mongoose from 'mongoose';

const graphRelationshipSchema = new mongoose.Schema(
  {
    sourceEntityId: { type: String, required: true, index: true },
    targetEntityId: { type: String, required: true, index: true },
    relationshipType: {
      type: String,
      enum: [
        'communicates_with',
        'delivers',
        'uses',
        'affects',
        'contains',
        'generated_by',
        'related_to',
        'exploits',
        'targets',
        'references',
        'mitigates',
        'indicates',
      ],
      required: true,
      index: true,
    },
    weight: { type: Number, min: 0, max: 100, default: 50 },
    confidence: { type: Number, min: 0, max: 1, default: 0.5 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

graphRelationshipSchema.index({ sourceEntityId: 1, targetEntityId: 1, relationshipType: 1 }, { unique: true });
graphRelationshipSchema.index({ relationshipType: 1, weight: -1 });

const GraphRelationship = mongoose.model('GraphRelationship', graphRelationshipSchema);
export default GraphRelationship;
