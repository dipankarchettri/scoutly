import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { Startup } from './models/Startup';
import Logger from './utils/logger';
import { scrapeQueue, connection } from './config/queue';
import { setupWorker } from './workers/scraperWorker';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGODB_URI || '';

setupWorker();

app.use(helmet({
    contentSecurityPolicy: false, // Disabled for now to avoid breaking Vite scripts if inline
}));
app.use(cors()); // In production, configure this strictly: { origin: 'https://yourdomain.com' }
app.use(express.json());

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    limit: 100, // Limit each IP to 100 requests per `window` (here, per 15 minutes)
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Too many requests from this IP, please try again after 15 minutes'
});
app.use('/api', limiter);

if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, '../dist')));
}

mongoose.connect(MONGO_URI)
    .then(() => Logger.info('✅ Connected to MongoDB'))
    .catch(err => Logger.error('❌ MongoDB connection error:', err));


import { ScraperService } from './services/scraperService';
import cron from 'node-cron';
import { runGalleryScrape } from './services/galleryScraperService';

app.post('/api/scrape', (req, res) => {
    res.json({ message: 'Legacy scrape started' });
});

app.post('/api/scrapers/run', async (req, res) => {
    const { source } = req.body;

    Logger.info(`Received agentic scrape request for: ${source}`);

    try {
        // Use BullMQ Pro features - group related scraping jobs
        const options = source ? {
            // Group jobs by source to prevent race conditions
            groupKey: `scrape-${source}`,
            // Prioritize certain sources
            priority: source === 'gallery' ? 10 : 5,
        } : {};

        await scrapeQueue.add('scrape-all', { source }, options);
        res.json({ message: `Queued scraping job for ${source || 'all'} with BullMQ Pro optimizations` });
        Logger.info(`Job successfully queued with options:`, options);
    } catch (err) {
        Logger.error("Failed to queue job:", err);
        res.status(500).json({ error: "Failed to queue job" });
    }
});


// Health check endpoint for Docker health checks
app.get('/api/health', async (req, res) => {
    try {
        // Check database connection
        const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
        
        // Check Redis/DragonflyDB connection
        const redisStatus = connection.status || 'connected';
        
        res.json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            services: {
                database: dbStatus,
                cache: redisStatus,
                uptime: process.uptime(),
                memory: process.memoryUsage(),
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
                default: daysBack = 30;
            }
        }

        // Domain/Search filter
        if (domain && domain !== 'all') {
            filter.$or = [
                { name: { $regex: domain, $options: 'i' } },
                { description: { $regex: domain, $options: 'i' } },
                { industry: { $regex: domain, $options: 'i' } }
            ];
        }

        // Sort Logic
        let sortOptions: any = { createdAt: -1 };
        if (sort === 'date') {
            sortOptions = { dateAnnouncedISO: -1, createdAt: -1 };
        } else if (sort === 'amount') {
            sortOptions = { fundingAmountNum: -1, createdAt: -1 };
        }

        const startups = await Startup.find(filter).sort(sortOptions).limit(100);
        res.json(startups);
    } catch (err) {
        next(err); // Pass to error handler
    }
});

app.get('/api/stats', async (req, res, next) => {
    try {
        const total = await Startup.countDocuments();
        const byIndustry = await Startup.aggregate([
            { $group: { _id: "$industry", count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 5 }
        ]);
        res.json({ total, byIndustry });
    } catch (err) {
        next(err);
    }
});

if (process.env.NODE_ENV === 'production') {
    app.get('*', (req, res) => {
        res.sendFile(path.resolve(__dirname, '../dist', 'index.html'));
    });
}


cron.schedule('0 * * * *', async () => {
    Logger.info('⏰ Triggering Hourly Scrapers (via Queue)...');

    // 1. News Scrapers
    try {
        await scrapeQueue.add('scrape-all', { source: 'cron' });
    } catch (e) {
        Logger.error('Hourly Scraper Queue Error:', e);
    }

    // 2. Startups Gallery
    try {
        await runGalleryScrape();
    } catch (e) {
        Logger.error('Gallery Scraper Error:', e);
    }
});

app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    Logger.error(err.stack);
    res.status(500).json({ error: 'Something broke!', details: process.env.NODE_ENV === 'development' ? err.message : undefined });
});

app.listen(PORT, () => {
    Logger.info(`🚀 Server running on http://localhost:${PORT}`);
});
