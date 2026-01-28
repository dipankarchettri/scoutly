
import mongoose from 'mongoose';
import { ScraperService } from '../src/services/scraperService';
import 'dotenv/config';

async function runTest() {
    console.log('🧪 Starting Scraper Test...');

    const MONGO_URI = process.env.MONGODB_URI;
    if (!MONGO_URI) {
        throw new Error('MONGODB_URI not defined');
    }

    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB');

    const scraperService = new ScraperService();
    await scraperService.runAll();

    console.log('✅ Test Complete');
    await mongoose.disconnect();
}

runTest().catch(console.error);
