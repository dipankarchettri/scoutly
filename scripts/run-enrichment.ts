
import mongoose from 'mongoose';
import { EnrichmentService } from '../src/services/enrichmentService';
import { Startup } from '../src/models/Startup';
import 'dotenv/config';

async function runEnrichment() {
    console.log('✨ Starting Bulk Enrichment...');

    const MONGO_URI = process.env.MONGODB_URI;
    if (!MONGO_URI) {
        throw new Error('MONGODB_URI not defined');
    }

    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Find startups that need enrichment (missing website or founders)
    // Or just process the last 50 to be safe/quick
    const genericDomains = ['Startup', 'Startups', 'Technology', 'Company', 'Uncategorized', 'Industry'];

    // Find startups that need enrichment (missing website, founders, OR generic domain)
    const startups = await Startup.find({
        $or: [
            { website: { $exists: false } },
            { website: '' },
            { 'contactInfo.founders': { $size: 0 } },
            { 'contactInfo.founders': { $exists: false } },
            { industry: { $in: genericDomains } }
        ]
    }).limit(20).sort({ dateAnnounced: -1 });

    console.log(`Found ${startups.length} startups potentially needing enrichment.`);

    for (const startup of startups) {
        await EnrichmentService.enrichStartup(startup._id.toString());
    }

    console.log('✅ Enrichment Complete');
    await mongoose.disconnect();
    process.exit(0);
}

runEnrichment().catch(console.error);
