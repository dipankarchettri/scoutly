import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { Startup } from './models/Startup';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGODB_URI || '';

app.use(cors());
app.use(express.json());

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, '../dist')));
}

// Connect to MongoDB
mongoose.connect(MONGO_URI)
  .then(() => console.log('✅ Connected to MongoDB Atlas'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// Routes

// POST /api/scrape - Trigger scraper

import { ScraperService } from './services/scraperService';

// ... existing code

// POST /api/scrape - Trigger scraper (Legacy/Background)
app.post('/api/scrape', (req, res) => {
    // ... existing logic
    res.json({ message: 'Legacy scrape started' });
});

// POST /api/scrapers/run - Trigger Agentic Scraper
app.post('/api/scrapers/run', async (req, res) => {
    const { source } = req.body;
    const scraper = new ScraperService();
    
    console.log(`Received agentic scrape request for: ${source}`);
    res.json({ message: `Started scraping ${source || 'all'}` }); // Respond immediately

    // Run in background
    try {
        if (source === 'all') {
            await scraper.runAll();
        } else {
             // Fallback/Legacy or Config filter (Future: scraper.runSource(source))
             await scraper.runAll(); 
        }
        console.log("Scraping finished.");
    } catch (err) {
        console.error("Scraping process failed:", err);
    }
});


// GET /api/startups - Fetch recent startups
app.get('/api/startups', async (req, res) => {
  try {
    const { timeframe, domain, sort } = req.query;
    let filter: any = {};

    // Timeframe filter
    if (timeframe && timeframe !== 'all') { // Added 'all' check
      // ... existing timeframe logic (kept for fallback)
      const now = new Date();
      let daysBack = 0;
      switch (timeframe) {
        case 'today': daysBack = 1; break; // Fixed 0 to 1 for "within 24h" logic usually
        case 'yesterday': daysBack = 2; break;
        case 'week': daysBack = 7; break;
        case 'month': daysBack = 30; break;
        case 'quarter': daysBack = 90; break;
        default: daysBack = 30;
      }
      // If we had a real date field:
      // filter.dateAnnounced = { $gte: new Date(now.setDate(now.getDate() - daysBack)).toISOString() };
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
    let sortOptions: any = { createdAt: -1 }; // Default
    if (sort === 'date') {
        sortOptions = { dateAnnouncedISO: -1, createdAt: -1 };
    } else if (sort === 'amount') {
        sortOptions = { fundingAmountNum: -1, createdAt: -1 };
    }

    const startups = await Startup.find(filter).sort(sortOptions).limit(100);
    res.json(startups);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch startups' });
  }
});

// GET /api/stats - Simple stats
app.get('/api/stats', async (req, res) => {
    try {
        const total = await Startup.countDocuments();
        const byIndustry = await Startup.aggregate([
            { $group: { _id: "$industry", count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 5 }
        ]);
        res.json({ total, byIndustry });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

// Catch-all for SPA
if (process.env.NODE_ENV === 'production') {
    app.get('*', (req, res) => {
        res.sendFile(path.resolve(__dirname, '../dist', 'index.html'));
    });
}

import cron from 'node-cron';
import { runGalleryScrape } from './services/galleryScraperService';

// ... existing code ...

// CRON JOBS
// Schedule: Every hour at minute 0
cron.schedule('0 * * * *', async () => {
    console.log('⏰ Running Hourly Scrapers...');
    const scraper = new ScraperService();
    
    // 1. News Scrapers (Config-Driven)
    try {
        await scraper.runAll();
    } catch (e) {
        console.error('Hourly Scraper Error:', e);
    }

    // 2. Startups Gallery
    try {
        await runGalleryScrape();
    } catch (e) {
        console.error('Gallery Scraper Error:', e);
    }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
