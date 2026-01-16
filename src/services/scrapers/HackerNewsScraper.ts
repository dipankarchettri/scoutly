
import { BaseScraper } from './BaseScraper';
import { ScraperResult } from './interfaces';

export class HackerNewsScraper extends BaseScraper {
    
    constructor(config: any) {
        super(config);
    }

    async scrape(): Promise<ScraperResult> {
        // Hacker News API: https://github.com/HackerNews/API
        // We will look at "Show HN" stories which are specifically for new products/startups.
        
        let processed = 0;
        let errors = 0;
        const items: any[] = [];
        const MAX_ITEMS = 20;

        try {
            // 1. Get Top "Show HN" IDs
            this.logger.log(`[${this.name}] Fetching Show HN stories...`);
            const response = await fetch('https://hacker-news.firebaseio.com/v0/showstories.json');
            if (!response.ok) throw new Error(`HN API Error: ${response.status}`);
            
            const ids = await response.json();
            const topIds = ids.slice(0, MAX_ITEMS);

            this.logger.log(`[${this.name}] Processing ${topIds.length} stories...`);

            for (const id of topIds) {
                try {
                    // 2. Get Item Details
                    const itemRes = await fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`);
                    if (!itemRes.ok) continue;
                    
                    const item = await itemRes.json();
                    if (!item || !item.url) continue; // Skip if no URL (e.g. text only, unless we parse text)

                    // Context Text
                    const textContent = `Title: ${item.title}\n\n${item.text || 'No description provided.'}`;
                    const date = new Date(item.time * 1000).toISOString(); // HN time is unix seconds
                    const sourceUrl = item.url || `https://news.ycombinator.com/item?id=${id}`;

                    // Process
                    const saved = await this.processItem(textContent, date, sourceUrl);
                    if (saved) processed++;
                    
                } catch (e) {
                    errors++;
                }
            }

        } catch (e) {
            this.logger.error(`[${this.name}] Error:`, e);
            return { source: this.name, processedCount: processed, errors: 1, items: [] };
        }

        return { source: this.name, processedCount: processed, errors, items };
    }
}
