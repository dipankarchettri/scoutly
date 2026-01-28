
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
            this.logger.log(`[${this.name}] ⚠️ Content too short (${text ? text.length : 0} chars), skipping.`);
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

            // Check if name is generic (e.g. "Startup", "Company") - simple heuristic
            if (['startup', 'company', 'unknown'].includes(result.data.name.toLowerCase())) {
                this.logger.log(`[${this.name}] ❌ Rejected: Generic name "${result.data.name}"`);
                return false;
            }

            this.logger.log(`[${this.name}] ✅ VALIDATED: ${result.data.name} (${result.data.fundingAmount}) - Confidence: 0.95`);

            try {
                const exists = await Startup.findOne({ $or: [{ name: result.data.name }, { sourceUrl }] });
                if (!exists) {
                    const newStartup = await Startup.create({
                        ...result.data,
                        canonicalName: result.data.name.toLowerCase().replace(/[^a-z0-9]/g, ''),
                        sources: [{
                            sourceName: this.name,
                            sourceUrl,
                            extractedAt: new Date(),
                            confidence: 0.95,
                            sourceType: this.config.type === 'rss' ? 'rss' : 'scraper',
                            notes: `Extracted from ${this.config.type}`
                        }],
                        sourceUrl,
                        confidenceScore: 0.95
                    });
                    this.logger.log(`[${this.name}] 💾 Saved ${newStartup.name} to DB (ID: ${newStartup._id}).`);
                    try {
                        await EnrichmentQueue.add(newStartup.id);
                        this.logger.log(`[${this.name}] 📨 Added to enrichment queue.`);
                    } catch (qError) {
                        this.logger.error(`[${this.name}] ⚠️ Failed to add to enrichment queue:`, qError);
                    }
                    return true;
                } else {
                    this.logger.log(`[${this.name}] ⏭️ Duplicate found (${exists.name}), skipping.`);
                    return false;
                }
            } catch (dbError) {
                this.logger.error(`[${this.name}] 💥 Database Error saving ${result.data.name}:`, dbError);
                return false;
            }
        } else {
            this.logger.log(`[${this.name}] ❌ Extraction Failed or Invalid: ${JSON.stringify(result)}`);
        }
        return false;
    }
}
