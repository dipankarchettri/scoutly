import mongoose from 'mongoose';

const StartupSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, required: true },
  website: { type: String },
  dateAnnounced: { type: String },
  dateAnnouncedISO: { type: Date }, // For proper sorting
  location: { type: String },
  investors: [String], // Backed by...
  teamSize: { type: String }, // e.g. 11-50
  tags: [String],
  fundingAmount: { type: String },
  fundingAmountNum: { type: Number }, // For sorting
  roundType: { type: String }, // e.g. Pre-Seed, Seed, Series A
  industry: { type: String }, // Classification (e.g. AI, Fintech)
  source: { type: String },
  sourceUrl: { type: String },
  contactInfo: {
    founders: [String],
    email: { type: String },
    socials: {
        type: {
            twitter: { type: String },
            linkedin: { type: String }
        },
        default: {}
    }
  },
  confidenceScore: { type: Number },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
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
