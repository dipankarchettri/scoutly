
import { BaseScraper } from './BaseScraper';
import { ScraperResult } from './interfaces';
import Parser from 'rss-parser';

export class RssScraper extends BaseScraper {
    private parser: Parser;

    constructor(config: any) {
        super(config);
        this.parser = new Parser();
    }

    async scrape(): Promise<ScraperResult> {
        let processed = 0;
        let errors = 0;
        const items: any[] = [];
        
        if (!this.config.rss) {
             this.logger.error(`[${this.name}] No RSS feed URL configured.`);
             return { source: this.name, processedCount: 0, errors: 1, items: [] };
        }

        this.logger.log(`[${this.name}] 📡 Fetching RSS Feed: ${this.config.rss}`);

        try {
            const feed = await this.parser.parseURL(this.config.rss);
            const entries = feed.items.slice(0, 15); // Process top 15

            this.logger.log(`[${this.name}] Found ${entries.length} entries.`);

            for (const entry of entries) {
                if (!entry.link) continue;

                // Basic deduplication check before heavy processing
                // (Optional: check if link exists in DB already? strict check)
                
                try {
                    // We need full content for AI. RSS descriptions are often too short.
                    // Ideally we fetch the page content here.
                    // For now, let's pass the description + title to see if it's enough, 
                    // or implement a simple fetcher in BaseScraper if needed.
                    // BUT: BaseScraper processItem expects "text".
                    // Let's combine title + contentSnippet. 
                    // Realistically, for high quality AI validation, we might *need* to visit the link.
                    // But to keep it "no limitations" fast, let's try with RSS data first if robust.
                    // Scoutly usually visits the page. 
                    
                    // Let's implement a lightweight fetch for the link content using the AI service's "scout" capability logic
                    // OR just rely on the text we have. 
                    // Users wanted "modular". Let's assume for RSS we might want to fetch content if description is short.
                    
                    const textContent = `${entry.title}\n\n${entry.content || entry.contentSnippet || ''}`;
                    const date = entry.isoDate || entry.pubDate || new Date().toISOString();

                    const saved = await this.processItem(textContent, date, entry.link);
                    if (saved) processed++;
                    items.push({ title: entry.title, link: entry.link, saved });

                } catch (e) {
                    this.logger.error(`[${this.name}] Error processing item ${entry.title}:`, e);
                    errors++;
                }
            }

        } catch (e) {
            this.logger.error(`[${this.name}] Failed to parse RSS:`, e);
            errors++;
        }

        return { source: this.name, processedCount: processed, errors, items };
    }
}
