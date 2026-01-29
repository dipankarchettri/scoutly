import { ISearchSource, SearchSourceResult } from '../interfaces';
import { FREE_SOURCES } from '../../../config/searchConfig';

export class PuppeteerSearchSource implements ISearchSource {
    name = 'PuppeteerSearch';
    enabled: boolean = true;
    priority: number = 2;

    async search(query: string): Promise<SearchSourceResult> {
        const startTime = Date.now();
        
        try {
            const puppeteer = (await import('puppeteer')).default;
            const browser = await puppeteer.launch({
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            });

            const page = await browser.newPage();
            // Use a realistic user agent
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');

            // Using DuckDuckGo HTML version for easier scraping and less blocking
            const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
            
            await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });

            // Scrape results
            const results = await page.evaluate(() => {
                const items: any[] = [];
                const results = document.querySelectorAll('.result');
                
                results.forEach((el) => {
                    const titleEl = el.querySelector('.result__title .result__a');
                    const snippetEl = el.querySelector('.result__snippet');
                    const linkEl = el.querySelector('.result__url');

                    if (titleEl && linkEl) {
                        const title = (titleEl as HTMLElement).innerText;
                        const url = (linkEl as HTMLElement).innerText.trim();
                        // DDG HTML sometimes puts relative links or huge urls, try to extract href if possible
                        const href = (titleEl as HTMLAnchorElement).href;
                        
                        const snippet = snippetEl ? (snippetEl as HTMLElement).innerText : '';

                        if (href && !href.includes('duckduckgo.com')) {
                             items.push({
                                title,
                                url: href,
                                snippet: snippet,
                                source: 'DuckDuckGo (Puppeteer)',
                                relevanceScore: 0.8 // Decent default
                            });
                        }
                    }
                });
                return items;
            });

            await browser.close();

            return {
                source: this.name,
                results: results.slice(0, 10), // Limit to top 10
                latencyMs: Date.now() - startTime
            };

        } catch (error: any) {
            console.error('Puppeteer search failed:', error);
            return {
                source: this.name,
                results: [],
                error: error.message,
                latencyMs: Date.now() - startTime
            };
        }
    }
}
