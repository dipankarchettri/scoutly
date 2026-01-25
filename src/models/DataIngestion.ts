import mongoose from 'mongoose';

// Data Source tracking
const DataSourceSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    type: { 
        type: String, 
        enum: ['api', 'rss', 'scraper', 'government'], 
        required: true 
    },
    url: { type: String },
    cost: { 
        type: String, 
        enum: ['free', 'freemium', 'paid', 'usage_based'], 
        required: true 
    },
    reliability: { 
        type: Number, 
        min: 0, 
        max: 1, 
        default: 0.5 
    },
    lastSuccess: { type: Date },
    lastError: { type: String },
    isActive: { type: Boolean, default: true }
}, { timestamps: true });

// Pending startup data (validation layer)
const PendingStartupSchema = new mongoose.Schema({
    // Core identity
    name: { type: String, required: true, index: true },
    canonicalName: { type: String, required: true, index: true },
    description: { type: String, required: true },
    website: { type: String },
    logo: { type: String },
    location: { type: String },
    
    // Funding information
    fundingAmount: { type: String },
    fundingAmountNum: { type: Number },
    roundType: { type: String },
    dateAnnounced: { type: String },
    dateAnnouncedISO: { type: Date },
    
    // Metadata
    tags: [String],
    industry: String,
    
    // Source tracking
    sources: [{
        sourceName: { type: String, required: true },
        sourceUrl: { type: String, required: true },
        extractedAt: { type: Date, required: true },
        confidence: { type: Number, required: true, min: 0, max: 1 }
    }],
    
    // Validation metrics
    confidenceScore: { type: Number, min: 0, max: 1, default: 0.3 },
    sourceCount: { type: Number, default: 1 },
    validationStatus: { 
        type: String, 
        enum: ['pending', 'validated', 'rejected', 'enriched'], 
        default: 'pending' 
    },
    
    // Timestamps
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    lastValidatedAt: { type: Date }
}, { timestamps: true });

// Confidence scoring history
const ConfidenceHistorySchema = new mongoose.Schema({
    startupId: { type: mongoose.Schema.Types.ObjectId, ref: 'PendingStartup', required: true },
    previousScore: { type: Number, required: true },
    newScore: { type: Number, required: true },
    sources: [String],
    algorithm: { type: String, required: true },
    reason: { type: String },
    createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

// Indexes for performance
PendingStartupSchema.index({ canonicalName: 1 });
PendingStartupSchema.index({ confidenceScore: -1 });
PendingStartupSchema.index({ validationStatus: 1, sources: 1 });
PendingStartupSchema.index({ dateAnnouncedISO: -1 });

export const DataSource = mongoose.model('DataSource', DataSourceSchema);
export const PendingStartup = mongoose.model('PendingStartup', PendingStartupSchema);
export const ConfidenceHistory = mongoose.model('ConfidenceHistory', ConfidenceHistorySchema);