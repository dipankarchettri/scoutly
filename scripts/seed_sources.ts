import mongoose from 'mongoose';
import Logger from '../utils/logger';

// Model imports for Phase 2
const DataSource = (await import('../models/DataIngestion')).DataSource;
const PendingStartup = (await import('../models/DataIngestion')).PendingStartup;

const SECCollector = (await import('../collectors/SEC')).default;
const RSSCollector = (await import('../collectors/RSSCollector')).default;

// Import models and services for Phase 2
const DataSource = mongoose.model('DataSource');
const PendingStartup = mongoose.model('PendingStartup');

// Import logging utility
const Logger = {
    info: (message: string) => console.log(`[INFO] ${message}`),
    error: (message: string) => console.error(`[ERROR] ${message}`)
};

class SourceSeeder {
    private static sources = [
        {
            id: 'techcrunch',
            name: 'TechCrunch RSS Feed',
            type: 'rss',
            url: 'https://techcrunch.com/feed/',
            settings: {
                timeout: 10000,
                retries: 3
            }
        },
        {
            id: 'venturebeat',
            name: 'VentureBeat RSS Feed',
            type: 'rss',
            url: 'https://venturebeat.com/feed/',
            settings: {
                timeout: 10000,
                retries: 3
            }
        },
        {
            id: 'ycombinator',
            name: 'Y Combinator',
            type: 'api',
            url: 'https://www.ycombinator.com/api/v1/companies',
            settings: {
                timeout: 15000,
                rateLimit: 100,
                tier: 'free'
            }
        },
        {
            id: 'signal-nfx',
            name: 'Signal by NFX',
            type: 'api',
            url: 'https://api.signalnfx.com/v1/',
            settings: {
                timeout: 15000,
                rateLimit: 5
            }
        }
    ];

    static async seedSources(): Promise<void> {
        Logger.info('🌱 Seeding data sources to DataSource collection...');

        for (const source of SourceSeeder.sources) {
            try {
                // Check if source already exists
                const existing = await DataSource.findOne({ id: source.id });
                
                if (existing) {
                    Logger.info(`✅ Source ${source.name} already exists, updating`);
                    await DataSource.findOneAndUpdate(
                        { id: source.id },
                        {
                            name: source.name,
                            type: source.type,
                            url: source.url,
                            cost: source.cost === 'api' ? 'usage_based' : 'free',
                            reliability: source.id === 'sec-edgar' ? 0.95 : 
                                         source.id === 'ycombinator' ? 0.90 : 
                                         source.id === 'signal-nfx' ? 0.75 : 0.85,
                            isActive: true,
                            lastSuccess: new Date(),
                            $set: {
                                settings: source.settings
                            }
                        },
                        { upsert: true }
                    );
                } else {
                    Logger.info(`➕ Adding new source: ${source.name}`);
                    
                    const newSource = new DataSourceModel({
                        id: source.id,
                        name: source.name,
                        type: source.type,
                        url: source.url,
                        cost: source.cost === 'api' ? 'usage_based' : 'free',
                        reliability: source.id === 'sec-edgar' ? 0.95 : 
                                         source.id === 'ycombinator' ? 0.90 : 
                                         source.id === 'signal-nfx' ? 0.75 : 0.85,
                        isActive: true,
                        lastSuccess: new Date(),
                        settings: source.settings
                    });
                    
                    await newSource.save();
                    Logger.info(`✅ Added source: ${source.name}`);
                }
            } catch (error) {
                Logger.error(`❌ Failed to seed source ${source.name}:`, error);
            }
        }

        Logger.info('✅ Data sources seeding complete');
    }

    static async collectInitialData(): Promise<void> {
        Logger.info('🚀 Starting initial data collection...');

        const secCollector = new SECCollector();
        
        // Collect recent Form D filings (last 90 days)
        try {
            const filings = await secCollector.fetchFormDFilings();
            
            for (const filing of filings) {
                await this.savePendingStartup({
                    name: filing.companyName,
                    description: filing.description,
                    fundingAmount: filing.amount,
                    dateAnnounced: filing.filingDate,
                    sourceUrl: filing.url,
                    source: {
                        sourceName: 'SEC EDGAR',
                        sourceUrl: 'https://data.sec.gov/submissions/',
                        extractedAt: new Date(filing.sourceDate),
                        confidence: 0.95
                    }
                });
            }
            
            Logger.info(`✅ Collected ${filings.length} SEC Form D filings`);
        } catch (error) {
            Logger.error('❌ SEC collection failed:', error);
        }

        // Collect RSS feeds
        for (const source of SourceSeeder.sources) {
            if (source.type === 'rss') {
                try {
                    const rssCollector = new RSSCollector(source.name, source.url);
                    const startups = await rssCollector.fetchAndParse();
                    
                    for (const startup of startups) {
                        await this.savePendingStartup({
                            name: startup.name,
                            description: startup.description,
                            fundingAmount: startup.fundingAmount,
                            roundType: startup.roundType,
                            dateAnnounced: startup.date,
                            sourceUrl: startup.sourceUrl,
                            source: {
                                sourceName: startup.source,
                                sourceUrl: source.url,
                                extractedAt: startup.extractedAt,
                                confidence: startup.confidence
                            }
                        });
                    }
                    
                    Logger.info(`✅ Collected ${startups.length} startups from ${source.name}`);
                } catch (error) {
                    Logger.error(`❌ RSS collection failed for ${source.name}:`, error);
                }
            }
        }

        Logger.info('📊 Initial data collection complete');
    }

    private     private static async savePendingStartup(data: any): Promise<void> {
        name: string;
        description: string;
        fundingAmount?: string;
        roundType?: string;
        dateAnnounced: string;
        sourceUrl: string;
        source: any;
    }): Promise<void> {
        const pending = new PendingStartup({
            name: data.name,
            canonicalName: data.name.toLowerCase().replace(/[^a-z0-9\s]/g, ''),
            description: data.description,
            website: data.sourceUrl,
            dateAnnounced: data.dateAnnounced,
            dateAnnouncedISO: new Date(data.dateAnnounced),
            fundingAmount: data.fundingAmount,
            roundType: data.roundType,
            sources: [data.source],
            confidenceScore: data.confidence || 0.7,
            validationStatus: 'pending'
        });

        await pending.save();
}

export default SourceSeeder;