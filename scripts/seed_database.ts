import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { ScraperService } from '../src/services/scraperService';
import { runGalleryScrape } from '../src/services/galleryScraperService';
import { EnrichmentQueue } from '../src/services/enrichmentQueue';
import Logger from '../src/utils/logger';

dotenv.config();

const DAYS_BACK = 30; // Scrape last 30 days for initial seed

async function seedDatabase() {
    console.log(`🌱 Starting Initial Database Seeding (Last ${DAYS_BACK} days)...\\n`);

    const MONGO_URI = process.env.MONGODB_URI || '';

    if (!MONGO_URI) {
        console.error('❌ MONGODB_URI missing');
        return;
    }

    try {
        await mongoose.connect(MONGO_URI);
        Logger.info('✅ Connected to MongoDB');

        const startDate = new Date();
        startDate.setDate(startDate.getDate() - DAYS_BACK);

        console.log(`📅 Scraping window: ${startDate.toISOString().split('T')[0]} to ${new Date().toISOString().split('T')[0]}`);
        console.log('   Note: RSS feeds naturally include recent posts (last 30-60 days)');
        console.log('   Reddit/HN/Product Hunt APIs will fetch latest posts\\n');

        // Run all scrapers
        const service = new ScraperService();
        await service.runAll();

        // Run gallery scraper for additional sources
        try {
            await runGalleryScrape();
        } catch (e) {
            Logger.error('Gallery Scrape Error (Non-Fatal):', e);
        }

        Logger.info('\\n✅ All scraping jobs completed.');

        // Wait for enrichment queue to finish
        Logger.info('⏳ Waiting for enrichment queue to drain...');
        await EnrichmentQueue.waitForIdle();
        Logger.info('✅ Enrichment queue empty.');

    } catch (e) {
        Logger.error('❌ Seeding failed:', e);
    } finally {
        await mongoose.disconnect();
        Logger.info('\\n🎉 Initial seeding complete!');
    }
}

seedDatabase();
