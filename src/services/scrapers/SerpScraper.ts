
import puppeteer from 'puppeteer';
import { IScraper, ScraperConfig, ScrapeResult } from './interfaces';
import { validateAndExtractStartup } from '../aiService';
import { Startup } from '../../models/Startup';

export class SerpScraper implements IScraper {
    name: string;
    config: ScraperConfig;
    logger: Console = console;

    constructor(config: ScraperConfig) {
        this.name = config.name;
        this.config = config;
    }

    private getDiscoveryQueries(): string[] {
        // Queries to find NEW startups announcing themselves
        return [
            // Twitter/X - High intent
            'site:twitter.com "announcing" "seed round" -filter:replies',
            'site:x.com "announcing" "seed round" -filter:replies',
            'site:twitter.com "just launched" "startup" -filter:replies',
            'site:x.com "just launched" "startup" -filter:replies',
            'site:twitter.com "Y Combinator" S25 "batch" -filter:replies',

            // LinkedIn - Announcements
            'site:linkedin.com/posts "excited to announce" "seed round"',
            'site:linkedin.com/posts "launching stealth"',
            'site:linkedin.com/posts "we just raised" "funding"'
        ];
    }

    async scrape(): Promise<ScrapeResult> {
        let processedCount = 0;
        let errors = 0;

        console.log(`🔎 Starting SERP Discovery (DuckDuckGo)...`);

        const browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled']
        });

        try {
            const page = await browser.newPage();
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

            const queries = this.getDiscoveryQueries();

            for (const query of queries) {
                console.log(`  📡 Searching: "${query}"`);

                try {
                    // Search DuckDuckGo with "Past Week" filter (df=w)
                    await page.goto(`https://html.duckduckgo.com/html?q=${encodeURIComponent(query)}&df=w`, { waitUntil: 'domcontentloaded', timeout: 30000 });

                    // Extract snippets
                    const snippets = await page.evaluate(() => {
                        const items: { title: string, snippet: string, link: string }[] = [];
                        const resultElements = document.querySelectorAll('.result');

                        resultElements.forEach((el, idx) => {
                            if (idx >= 5) return; // Top 5 per query to avoid noise

                            const titleEl = el.querySelector('.result__a');
                            const snippetEl = el.querySelector('.result__snippet');
                            const urlEl = el.querySelector('.result__url');

                            if (titleEl && snippetEl) {
                                items.push({
                                    title: titleEl.textContent?.trim() || '',
                                    snippet: snippetEl.textContent?.trim() || '',
                                    link: urlEl?.textContent?.trim() || '' // Sometimes url is text, sometimes href
                                });
                            }
                        });
                        return items;
                    });

                    console.log(`     Found ${snippets.length} results. Processing with AI...`);

                    // Process each snippet with AI
                    for (const item of snippets) {
                        // AI Prompt Construction to convert snippet to Startup
                        const context = `Source: ${item.link}\nTitle: ${item.title}\nSnippet: ${item.snippet}`;

                        try {
                            const validation = await validateAndExtractStartup(context, new Date().toISOString().split('T')[0]);

                            if (validation.isValid && validation.data) {
                                // Date Filter: 5 days Max
                                const announced = new Date(validation.data.dateAnnounced);
                                const diffTime = Math.abs(new Date().getTime() - announced.getTime());
                                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                                if (diffDays > 5) {
                                    console.log(`     Skipping old startup: ${validation.data.name} (${diffDays} days old)`);
                                    continue;
                                }

                                console.log(`     ✅ Discovered: ${validation.data.name} (${diffDays} days ago)`);

                                // Save to DB
                                const exists = await Startup.findOne({ name: validation.data.name });
                                if (!exists) {
                                    const doc = new Startup({
                                        ...validation.data,
                                        source: 'serp_discovery',
                                        sourceUrl: item.link,
                                        confidenceScore: 0.6 // Medium confidence for SERP snippets
                                    });
                                    await doc.save();
                                    processedCount++;
                                    console.log(`        🆕 Saved!`);
                                } else {
                                    console.log(`        Skipping duplicate.`);
                                }
                            }
                        } catch (err) {
                            // AI Error validatable, ignore
                        }
                    }

                    // Polite delay
                    await new Promise(r => setTimeout(r, 2000));

                } catch (qErr) {
                    console.error(`  ⚠️ Query failed: ${query}`, qErr);
                    errors++;
                }
            }

        } catch (e) {
            console.error('SERP Scraper Fatal Error:', e);
            errors++;
        } finally {
            await browser.close();
        }

        return { processedCount, errors };
    }
}
