import mongoose from 'mongoose';

// Enhanced startup model for Phase 2 multi-source architecture
const StartupSchema = new mongoose.Schema({
  // Core identity
  name: { type: String, required: true, index: true },
  canonicalName: { type: String, required: true, index: true },
  description: { type: String, required: true },
  website: { type: String },
  logo: { type: String },
  location: { type: String },
  
  // Funding information
  fundingAmount: { type: String },
  fundingAmountNum: { type: Number }, // For sorting
  roundType: { type: String },
  dateAnnounced: { type: String },
  dateAnnouncedISO: { type: Date }, // For proper sorting
  
  // Industry and classification
  industry: { type: String },
  tags: [String],
  
  // Enhanced source tracking
  sources: [{
    sourceName: { type: String, required: true },
    sourceUrl: { type: String, required: true },
    extractedAt: { type: Date, required: true },
    confidence: { type: Number, required: true, min: 0, max: 1 },
    sourceType: { type: String, required: true, enum: ['api', 'rss', 'scraper', 'government'] },
    notes: String // Additional notes about the source
  }],
  
  // Contact information (enhanced)
  contactInfo: {
    founders: [String],
    emails: [String], // Multiple validated emails
    primaryEmail: String, // Most reliable email
    socials: {
      twitter: String,
      linkedin: String,
      crunchbase: String,
      github: String,
      website: String
    },
    lastContactUpdate: Date // When contact info was last verified
  },
  
  // Validation and confidence
  confidenceScore: { type: Number, min: 0, max: 1, default: 0.3 },
  validationStatus: { 
    type: String, 
    enum: ['pending', 'validated', 'rejected', 'enriched', 'archived'], 
    default: 'pending' 
  },
  sourceCount: { type: Number, default: 1 },
  lastValidatedAt: Date,
  validationHistory: [{
    recordId: { type: mongoose.Schema.Types.ObjectId, ref: 'ValidationHistory' },
    previousScore: Number,
    newScore: Number,
    reason: String,
    timestamp: { type: Date, default: Date.now }
  }],
  
  // Temporal tracking
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  firstSeenAt: Date, // When first discovered across any source
  lastActivityAt: Date // Last funding round, hiring, etc.
}, { 
  timestamps: true 
});

// Performance-optimized indexes for query patterns
StartupSchema.index({ name: 1 }); // Exact match for deduplication
StartupSchema.index({ website: 1 }); // URL-based lookups
StartupSchema.index({ fundingAmountNum: -1 }); // Sort by funding
StartupSchema.index({ dateAnnouncedISO: -1 }); // Time-based queries
StartupSchema.index({ industry: 1, dateAnnouncedISO: -1 }); // Industry + timeframe
StartupSchema.index({ tags: 1 }); // Tag-based filtering
StartupSchema.index({ source: 1 }); // Source-based queries
StartupSchema.index({ 'contactInfo.founders': 1 }); // Founder searches
// Compound index for common query pattern (industry + date + funding)
StartupSchema.index({ 
  industry: 1, 
  dateAnnouncedISO: -1, 
  fundingAmountNum: -1 
});

export const Startup = mongoose.model('Startup', StartupSchema);
