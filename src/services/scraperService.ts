
import { RssScraper } from './scrapers/RssScraper';
import { ProductHuntScraper } from './scrapers/ProductHuntScraper';
import { RedditScraper } from './scrapers/RedditScraper';
import { HackerNewsScraper } from './scrapers/HackerNewsScraper';
import { IScraper, ScraperConfig } from './scrapers/interfaces';

// Import Config
import { SCRAPER_CONFIGS } from '../config/scrapers';

export class ScraperService {
  
  async runAll() {
    console.log('🚀 Starting All Scrapers (Modular & Config-Driven)...');
    
    // 1. Initialize Scraper Instances based on Config
    const scrapers: IScraper[] = [];

    // Add Configured Scrapers
    for (const config of SCRAPER_CONFIGS) {
        if (!config.enabled) continue;
        
        // Factory Logic
        switch(config.type) {
            case 'rss':
                scrapers.push(new RssScraper(config));
                break;
            case 'producthunt':
                scrapers.push(new ProductHuntScraper(config));
                break;
            case 'reddit':
                scrapers.push(new RedditScraper(config));
                break;
            case 'hackernews':
                scrapers.push(new HackerNewsScraper(config));
                break;
            case 'generic':
            default:
                // For now, we can use RssScraper if RSS is present, else log warning
                // In future, we can add PuppeteerScraper here if needed.
                if (config.rss) {
                    scrapers.push(new RssScraper(config));
                } else {
                    console.warn(`Unknown scraper type for ${config.name} and no RSS. Skipping.`);
                }
        }
    }
    
    // 2. Execute
    for (const scraper of scrapers) {
        console.log(`\n▶️ Running ${scraper.name}...`);
        try {
            const result = await scraper.scrape();
            console.log(`✔️ ${scraper.name} Finished: ${result.processedCount} processed, ${result.errors} errors.`);
        } catch (e) {
            console.error(`❌ ${scraper.name} Failed:`, e);
        }
    }
  }

  // Keeping scoutUrl for backward compatibility/utilities

  async scoutUrl(url: string) {
       console.log(`Scouting single URL: ${url}`);
       // Dynamic import to avoid eagerness in some envs, though consistent import is fine.
       // We use a basic puppeteer launch here, similar to BaseScraper logic but one-off.
       const puppeteer = (await import('puppeteer')).default;
       const { validateAndExtractStartup } = await import('./aiService'); // Lazy import service

       const browser = await puppeteer.launch({ 
           headless: true,
           args: ['--no-sandbox', '--disable-setuid-sandbox'] 
       });
       
       try {
           const page = await browser.newPage();
           await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
           await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
           
           // Simple content extraction
           const content = await page.evaluate(() => document.body.innerText);
           
           if (!content || content.length < 100) return { error: "Failed to load page content or content too short" };

           console.log("Extracted content length:", content.length);
           // AI Validation
           const result = await validateAndExtractStartup(content);
           return result;

       } catch (e) {
           console.error("Scout failed:", e);
           return { error: String(e) };
       } finally {
           await browser.close();
       }
  }
}
