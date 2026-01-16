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

// Index for valid search and deduplication
StartupSchema.index({ name: 1 });
StartupSchema.index({ website: 1 });
StartupSchema.index({ fundingAmountNum: -1 });
StartupSchema.index({ dateAnnouncedISO: -1 });

export const Startup = mongoose.model('Startup', StartupSchema);
