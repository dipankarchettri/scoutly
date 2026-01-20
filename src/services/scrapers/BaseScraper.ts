
import { ScraperConfig, ScraperResult, IScraper } from './interfaces';
import { validateAndExtractStartup } from '../aiService';
import { Startup } from '../../models/Startup';
import { EnrichmentQueue } from '../enrichmentQueue';

export abstract class BaseScraper implements IScraper {
    name: string;
    config: ScraperConfig;
    logger: Console;

    constructor(config: ScraperConfig) {
        this.name = config.name;
        this.config = config;
        this.logger = console;
    }

    abstract scrape(): Promise<ScraperResult>;

    protected async processItem(text: string, date: string, sourceUrl: string) {
        if (!text || text.length < 100) {
            this.logger.log(`[${this.name}] Content too short, skipping.`);
            return false;
        }

        const result = await validateAndExtractStartup(text, date);

        if (result.isValid && result.data) {
            if (!result.data.name || !result.data.fundingAmount) {
                this.logger.log(`[${this.name}] ❌ Rejected: Missing Name or Funding Amount`);
                return false;
            }

            // Additional validation checks
            if (result.data.fundingAmount === 'null' || result.data.fundingAmount.toLowerCase().includes('unknown')) {
                this.logger.log(`[${this.name}] ❌ Rejected: Invalid funding amount (null/unknown)`);
                return false;
            }

            // Reject if too many founders (likely extraction error)
            if (result.data.contactInfo?.founders && result.data.contactInfo.founders.length > 4) {
                this.logger.log(`[${this.name}] ❌ Rejected: Too many founders (${result.data.contactInfo.founders.length}) - likely extraction error`);
                return false;
            }

            this.logger.log(`[${this.name}] ✅ FOUND STARTUP: ${result.data.name} (${result.data.fundingAmount})`);

            const exists = await Startup.findOne({ $or: [{ name: result.data.name }, { sourceUrl }] });
            if (!exists) {
                const newStartup = await Startup.create({
                    ...result.data,
                    source: this.name,
                    sourceUrl,
                    confidenceScore: 0.95
                });
                this.logger.log(`[${this.name}] Saved ${newStartup.name} to DB.`);
                EnrichmentQueue.add(newStartup.id);
                return true;
            } else {
                this.logger.log(`[${this.name}] Duplicate found, skipping.`);
                return false;
            }
        }
        return false;
    }
}
