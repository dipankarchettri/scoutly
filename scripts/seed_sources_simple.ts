import mongoose from 'mongoose';

// Simple logger for this script
const Logger = {
    info: (message: string) => console.log(`[INFO] ${message}`),
    error: (message: string) => console.error(`[ERROR] ${message}`)
};

interface IStartupData {
    name: string;
    description: string;
    fundingAmount?: string;
    roundType?: string;
    dateAnnounced: string;
    sourceUrl: string;
    source: any;
    confidence?: number;
}

// Simple logger for this script
const Logger = {
    info: (message: string) => console.log(`[INFO] ${message}`),
    error: (message: string) => console.error(`[ERROR] ${message}`)
};

class SourceSeeder {
    private static async savePendingStartup(data: IStartupData): Promise<void> {
        const pending = new mongoose.models.PendingStartup(data);
        await pending.save();
    }

    static async checkSourceExists(id: string): Promise<boolean> {
        const DataSource = mongoose.models.DataSource;
        const existing = await DataSource.findOne({ id });
        return existing !== null;
    }

    static async addOrUpdateSource(id: string, sourceData: any): Promise<void> {
        const DataSource = mongoose.models.DataSource;
        
            try {
                if (await this.checkSourceExists(id)) {
                    // Update existing source
                    const updated = await DataSource.findOneAndUpdate(
                        { id },
                        { $set: sourceData }
                    );
                    Logger.info(`✅ Updated source: ${id}`);
                } else {
                    // Add new source
                    const newSource = new DataSource({ id, ...sourceData });
                    await newSource.save();
                    log(`✅ Added source: ${id}`);
                }
        } catch (error) {
            Logger.error(`❌ Failed to save source ${id}:`, error);
        }
    }

    static async seedSources(): Promise<void> {
        const sources = [
            {
                id: 'techcrunch',
                name: 'TechCrunch RSS Feed',
                type: 'rss',
                url: 'https://techcrunch.com/feed/',
                cost: 'free',
                reliability: 0.85,
                isActive: true,
                settings: { timeout: 10000, retries: 3 }
            },
            {
                id: 'venturebeat',
                name: 'VentureBeat RSS Feed',
                type: 'rss',
                url: 'https://venturebeat.com/feed/',
                cost: 'free',
                reliability: 0.80,
                isActive: true,
                settings: { timeout: 10000, retries: 3 }
            }
        ];

        for (const source of sources) {
            const sourceData = {
                id: source.id,
                name: source.name,
                type: source.type,
                url: source.url,
                cost: source.cost,
                reliability: source.reliability,
                isActive: source.isActive,
                settings: source.settings
            };
            
            try {
                if (await this.checkSourceExists(sourceData.id)) {
                    // Update existing source
                    const updated = await DataSource.findOneAndUpdate(
                        { id: sourceData.id },
                        { $set: sourceData }
                    );
                    log(`✅ Updated source: ${sourceData.id}`);
                } else {
                    // Add new source
                    const newSource = new DataSourceModel({ ...sourceData });
                    await newSource.save();
                    log(`✅ Added source: ${sourceData.id}`);
                }
            } catch (error) {
                log(`❌ Failed to seed source ${sourceData.id}:`, error);
            }
        }
        }

        Logger.info('✅ Data sources seeded successfully');
    }
}

export default SourceSeeder;