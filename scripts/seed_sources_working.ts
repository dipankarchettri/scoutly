import mongoose from 'mongoose';

// Simple logger for this script
const Logger = {
    info: (message: string) => console.log(`[INFO] ${message}`),
    error: (message: string) => console.error(`[ERROR] ${message}`)
};

// SourceSeeder - simplified and working
class SourceSeeder {
    private static async checkSourceExists(id: string): Promise<boolean> {
        try {
            const { DataSource } = mongoose.connection.model('DataSource');
            const existing = await DataSource.findOne({ id });
            return existing !== null;
        } catch (error) {
            log(`Source check failed: ${error}`);
            return false;
        }
    }

    private static async addOrUpdateSource(id: string, sourceData: any): Promise<void> {
        const { DataSource } = mongoose.connection.model('DataSource');
        
        try {
            if (await this.checkSourceExists(id)) {
                // Update existing source
                await DataSource.findOneAndUpdate(
                    { id },
                    { $set: sourceData }
                );
                log(`✅ Updated source: ${id}`);
            } else {
                // Add new source
                const newSource = new DataSource({
                    id,
                    name: sourceData.name,
                    type: sourceData.type,
                    url: sourceData.url,
                    cost: sourceData.cost || 'free',
                    reliability: sourceData.reliability || 0.5,
                    isActive: true,
                    lastSuccess: new Date(),
                    settings: sourceData.settings || {}
                });
                await newSource.save();
                log(`✅ Added source: ${id}`);
            }
        } catch (error) {
            log(`Failed to save source ${id}: ${error}`);
        }
    }

    static async seedSources(): Promise<void> {
        const sources = [
            {
                id: 'techcrunch',
                name: 'TechCrunch RSS Feed',
                type: 'rss',
                url: 'https://techcrunch.com/feed/',
                reliability: 0.85
            },
            {
                id: 'venturebeat',
                name: 'VentureBeat RSS Feed',
                type: 'rss',
                url: 'https://venturebeat.com/feed/',
                reliability: 0.80
            }
        ];

        for (const source of sources) {
            try {
                await this.addOrUpdateSource(source.id, source);
            } catch (error) {
                log(`❌ Failed to seed source ${source.id}: ${error}`);
            }
        }

        log('✅ Data sources seeded successfully');
    }
}

export default SourceSeeder;