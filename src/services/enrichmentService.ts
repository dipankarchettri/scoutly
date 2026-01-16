
import puppeteer from 'puppeteer';
import { Startup } from '../models/Startup';
import { FounderDiscoveryService } from './founderDiscoveryService';

export class EnrichmentService {
  
  // Enrich a startup by ID (Called after save)
  static async enrichStartup(startupId: string) {
    console.log(`✨ Enriching Startup ID: ${startupId}`);
    try {
        const startup = await Startup.findById(startupId);
        if (!startup) {
            console.error("Startup not found for enrichment");
            return;
        }

        // Check what's missing
        const s = startup as any;
        const needsWebsite = !s.website || s.website.includes('techcrunch') || s.website.includes('finsmes');
        const needsFounders = !s.contactInfo?.founders || s.contactInfo.founders.length === 0;

        if (!needsWebsite && !needsFounders) {
            console.log("Startup already enriched.");
            return;
        }

        const browser = await puppeteer.launch({ 
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled'] 
        });

        try {
            const page = await browser.newPage();
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

            // 1. Search for Website
            if (needsWebsite) {
                console.log(`Searching for website (DDG): ${startup.name}`);
                await page.goto(`https://html.duckduckgo.com/html?q=${encodeURIComponent(startup.name + " official website")}`, { waitUntil: 'domcontentloaded' });
                
                // DDG HTML Selectors
                const result = await page.evaluate(() => {
                    const el = document.querySelector('.result__url');
                    return el ? (el as HTMLElement).innerText.trim() : null;
                });
                
                // Often DDG returns "  www.example.com  ", need to clean and ensure protocol
                let websiteUrl = result ? result.trim() : null;
                if (websiteUrl) {
                    if (!websiteUrl.startsWith('http')) {
                        websiteUrl = 'https://' + websiteUrl;
                    }
                    console.log(`Found website: ${websiteUrl}`);
                    startup.website = websiteUrl;
                } else {
                     console.log("No website found on DDG.");
                }
            }

            await browser.close();

            // 2. Search for Founders using Enhanced Discovery Service
            if (needsFounders) {
                console.log(`🔍 Using multi-source founder discovery...`);
                
                try {
                    const founders = await FounderDiscoveryService.discoverFounders(
                        startup.name,
                        startup.website || undefined
                    );
                    
                    if (founders && founders.length > 0) {
                        console.log(`✅ Found ${founders.length} founder(s): ${founders.join(', ')}`);
                        startup.contactInfo = {
                            ...startup.contactInfo,
                            founders: founders
                        };
                    } else {
                        console.log("No founders found via enhanced discovery.");
                    }
                } catch (e) {
                    console.warn(`Enhanced founder discovery failed: ${e}`);
                }
            }

            await startup.save();
            console.log("✅ Enrichment Complete & Saved.");

        } catch (err) {
            console.error("Enrichment browser error:", err);
        }

    } catch (e) {
        console.error("Enrichment failed:", e);
    }
  }
}
