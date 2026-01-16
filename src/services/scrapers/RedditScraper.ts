
import { BaseScraper } from './BaseScraper';
import { ScraperResult } from './interfaces';

export class RedditScraper extends BaseScraper {
    
    constructor(config: any) {
        super(config);
    }

    async scrape(): Promise<ScraperResult> {
        // Reddit JSON API is free and easy for basic usage.
        // URL: https://www.reddit.com/r/startups/new.json?limit=25
        
        let processed = 0;
        let errors = 0;
        const items: any[] = [];
        const subreddits = ['startups', 'SaaS', 'Entrepreneur']; // Could be configurable

        for (const sub of subreddits) {
            this.logger.log(`[${this.name}] Scraping r/${sub}...`);
            try {
                const response = await fetch(`https://www.reddit.com/r/${sub}/new.json?limit=20`, {
                    headers: { 'User-Agent': 'Scoutly/1.0' }
                });

                if (!response.ok) {
                    this.logger.warn(`[${this.name}] Failed to fetch r/${sub}: ${response.status}`);
                    errors++;
                    continue;
                }

                const data = await response.json();
                const children = data.data?.children || [];

                for (const child of children) {
                    const post = child.data;
                    if (post.is_self && post.selftext?.length < 100) continue; // Skip short posts
                    
                    const textContent = `Title: ${post.title}\n\n${post.selftext}`;
                    const date = new Date(post.created_utc * 1000).toISOString();
                    const sourceUrl = `https://www.reddit.com${post.permalink}`;

                    try {
                        const saved = await this.processItem(textContent, date, sourceUrl);
                        if (saved) processed++;
                    } catch (e) {
                         errors++;
                    }
                }

            } catch (e) {
                this.logger.error(`[${this.name}] Error scraping r/${sub}:`, e);
                errors++;
            }
        }

        return { source: this.name, processedCount: processed, errors, items };
    }
}
