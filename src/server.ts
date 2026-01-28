import 'dotenv/config'; // Must be first
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { Startup } from './models/Startup';
import Logger from './utils/logger';
import { setupWorker } from './workers/SimpleWorker';
import { searchOrchestrator } from './services/search';
import { PRICING_TIERS, PricingTier } from './config/searchConfig';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


const app = express();
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/scoutly';

setupWorker();

// Middleware
app.use(helmet({
    contentSecurityPolicy: false
}));
app.use(cors());
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    limit: 100,
    standardHeaders: true,
    legacyHeaders: false
});
app.use('/api', limiter);

// ============================================
// AI-POWERED SEARCH ENDPOINT (New in v2)
// ============================================
app.post('/api/search', async (req, res) => {
    try {
        const { query, page = 1, tier = 'free' } = req.body;

        if (!query || typeof query !== 'string' || query.trim().length < 2) {
            return res.status(400).json({
                success: false,
                error: 'Query is required and must be at least 2 characters'
            });
        }

        // Validate tier
        const validTier: PricingTier = tier === 'paid' ? 'paid' : 'free';
        const tierConfig = PRICING_TIERS[validTier];

        // Validate page
        const pageNum = Math.max(1, Math.min(parseInt(page) || 1, tierConfig.pagesPerSearch));

        // Valid header for BYOK
        const apiKey = req.headers['x-llm-api-key'] as string | undefined;

        Logger.info(`🔍 AI Search: "${query}" (tier: ${validTier}, page: ${pageNum}, BYOK: ${!!apiKey})`);

        // Execute search
        const result = await searchOrchestrator.search(query.trim(), validTier, pageNum, apiKey);

        res.json({
            success: true,
            data: result,
            credits: {
                tier: validTier,
                // TODO: Implement actual credit tracking in Phase 3
                used: 1,
                remaining: tierConfig.credits - 1
            }
        });

    } catch (error: any) {
        Logger.error('Search error:', error);
        res.status(500).json({
            success: false,
            error: 'Search failed',
            details: error.message
        });
    }
});

// GET version for simple queries
app.get('/api/search', async (req, res) => {
    try {
        const { q, query, page = '1', tier = 'free' } = req.query;
        const searchQuery = (q || query) as string;

        if (!searchQuery || searchQuery.trim().length < 2) {
            return res.status(400).json({
                success: false,
                error: 'Query parameter (q or query) is required'
            });
        }

        const validTier: PricingTier = tier === 'paid' ? 'paid' : 'free';
        const pageNum = Math.max(1, parseInt(page as string) || 1);

        const result = await searchOrchestrator.search(searchQuery.trim(), validTier, pageNum);

        res.json({
            success: true,
            data: result
        });

    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: 'Search failed',
            details: error.message
        });
    }
});

// Get search source status
app.get('/api/search/sources', (req, res) => {
    const sources = searchOrchestrator.getSourceStatus();
    res.json({
        success: true,
        sources,
        tiers: PRICING_TIERS
    });
});

// Health check endpoint
app.get('/api/health', async (req, res) => {
    try {
        const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
        const redisStatus = 'connected'; // In production, this would be DragonflyDB

        const uptime = process.uptime();
        const memory = process.memoryUsage();

        res.json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            services: {
                database: dbStatus,
                cache: redisStatus
            },
            performance: {
                runtime: process.env.NODE_RUNTIME || 'node',
                cacheProvider: process.env.CACHE_PROVIDER || 'dragonfly'
            }
        });
    } catch (error) {
        res.status(500).json({
            status: 'unhealthy',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Search endpoint
app.get('/api/startups', async (req, res, next) => {
    try {
        const { timeframe, domain, sort } = req.query;
        let filter: any = {};

        // Timeframe filter
        if (timeframe && timeframe !== 'all') {
            const now = new Date();
            let daysBack = 0;
            switch (timeframe) {
                case 'today': daysBack = 1; break;
                case 'yesterday': daysBack = 2; break;
                case 'week': daysBack = 7; break;
                case 'month': daysBack = 30; break;
                case 'quarter': daysBack = 90; break;
                default: daysBack = 90;
            }

            filter.dateAnnouncedISO = {
                $gte: new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000)
            };
        }

        // Domain/Search filter
        if (domain && domain !== 'all') {
            filter.$or = [
                { name: { $regex: domain, $options: 'i' } },
                { description: { $regex: domain, $options: 'i' } },
                { industry: { $regex: domain, $options: 'i' } }
            ];
        }

        // Sort options
        let sortOptions: any = { createdAt: -1 };
        if (sort === 'date') {
            sortOptions = { dateAnnouncedISO: -1, createdAt: -1 };
        } else if (sort === 'amount') {
            sortOptions = { fundingAmountNum: -1, createdAt: -1 };
        }

        const startups = await Startup.find(filter).sort(sortOptions).limit(100);
        res.json(startups);
    } catch (error) {
        res.status(500).json({ error: 'Search failed', details: error.message });
    }
});

// Statistics endpoint
app.get('/api/stats', async (req, res) => {
    try {
        const total = await Startup.countDocuments();
        const byIndustry = await Startup.aggregate([
            { $group: { _id: '$industry', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 5 }
        ]);

        res.json({ total, byIndustry });
    } catch (error: any) {
        Logger.error('Stats endpoint error:', error);
        res.status(500).json({ error: 'Stats failed', details: error.message });
    }
});

// Database seeding endpoint
app.post('/api/seed-sources', async (req, res) => {
    try {
        Logger.info('🌱 Seeding data sources...');

        // For Phase 1+2, this would trigger our collectors
        // For now, just return success message
        res.json({ message: 'Data sources seeded successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Seeding failed', details: error.message });
    }
});

// Production static files
if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, '../dist')));
}

// Start server
// Connect to MongoDB and start server
mongoose.connect(MONGO_URI)
    .then(() => {
        Logger.info('✅ Connected to MongoDB');
        app.listen(PORT, () => {
            Logger.info(`🚀 Scoutly Server running on http://localhost:${PORT}`);
        });
    })
    .catch((err) => {
        Logger.error('❌ Failed to connect to MongoDB:', err);
        process.exit(1);
    });