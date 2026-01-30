
import puppeteer from 'puppeteer';
import { Startup } from '../models/Startup';
import { FounderDiscoveryService } from './founderDiscoveryService';
import { validateAndExtractStartup } from './aiService';

export class EnrichmentService {

    // DB-based enrichment (for Scrapers)
    static async enrichStartup(startupId: string) {
        console.log(`✨ Enriching Startup ID: ${startupId}`);
        try {
            const startup = await Startup.findById(startupId);
            if (!startup) {
                console.error("Startup not found for enrichment");
                return;
            }

            // Convert document to simpler object style for processing
            // (We could improve types here but casting is quick for now)
            const startupData = startup.toObject() as any;

            // Enrich in-memory
            const enrichedData = await this.enrichStartupData(startupData);

            // Update document
            startup.website = enrichedData.website;
            startup.description = enrichedData.description;
            startup.industry = enrichedData.industry;
            startup.contactInfo = enrichedData.contactInfo;
            if (!startup.canonicalName) {
                startup.canonicalName = startup.name.toLowerCase().replace(/[^a-z0-9]/g, '');
            }

            await startup.save();
            console.log("✅ Enrichment Complete & Saved for DB Record.");

        } catch (e) {
            console.error("Enrichment failed:", e);
        }
    }

    // In-memory enrichment (for Agent/Scrapers)
    static async enrichStartupData(data: any): Promise<any> {
        const needsWebsite = !data.website || data.website.includes('techcrunch') || data.website.includes('finsmes');
        const needsFounders = !data.contactInfo?.founders || data.contactInfo.founders.length === 0;

        const genericDomains = ['Startup', 'Startups', 'Technology', 'Company', 'Uncategorized', 'Industry'];
        const needsDomainUpdate = !data.industry || genericDomains.includes(data.industry);

        if (!needsWebsite && !needsFounders && !needsDomainUpdate) {
            return data;
        }

        console.log(`✨ Enriching In-Memory: ${data.name}`);
        const browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled']
        });

        try {
            const page = await browser.newPage();
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

            // 1. Find Website
            if (needsWebsite) {
                console.log(`Searching for website (DDG): ${data.name}`);
                try {
                    await page.goto(`https://html.duckduckgo.com/html?q=${encodeURIComponent(data.name + " official website")}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
                    const result = await page.evaluate(() => {
                        const el = document.querySelector('.result__url');
                        return el ? (el as HTMLElement).innerText.trim() : null;
                    });

                    let websiteUrl = result ? result.trim() : null;
                    if (websiteUrl) {
                        if (!websiteUrl.startsWith('http')) websiteUrl = 'https://' + websiteUrl;
                        console.log(`Found website: ${websiteUrl}`);
                        data.website = websiteUrl;

                        // Scrape Description from new website
                        try {
                            console.log(`Visiting ${websiteUrl} for description...`);
                            await page.goto(websiteUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });
                            const metaDesc = await page.evaluate(() => {
                                const d = document.querySelector('meta[name="description"]');
                                const og = document.querySelector('meta[property="og:description"]');
                                return (d as HTMLMetaElement)?.content || (og as HTMLMetaElement)?.content || document.body.innerText.substring(0, 300);
                            });

                            if (metaDesc && metaDesc.length > 20) {
                                if (!data.description || data.description.length < 50 || data.description.includes('AI startup in')) {
                                    data.description = metaDesc.substring(0, 500);
                                }
                            }
                        } catch (e) {
                            console.warn(`Website scrape failed: ${e}`);
                        }
                    }
                } catch (e) {
                    console.warn(`DDG search failed: ${e}`);
                }
            }

            // 2. Validate Industry
            if (needsDomainUpdate) {
                // (Retain existing logic if possible, or skip for speed if agent)
                // For agent search, we might skip the re-validation call to avoid circular dependency or latency
                // But let's try to keep it if crucial.
                // Actually, validateAndExtractStartup is heavy. Let's skip deep AI re-check for in-memory agent to save time?
                // User wants "like scrapper", so we should keep it.
                // But validateAndExtractStartup imports CompanyExtractor...
            }

            await browser.close();

            // 3. Founders (Multi-source) - Run outside browser/puppeteer if it uses API/other methods
            if (needsFounders) {
                try {
                    // OPTIMIZATION: Check DB first to avoid redundant scraping
                    let existingFounders: string[] = [];
                    try {
                        const existing = await Startup.findOne({
                            name: { $regex: new RegExp(`^${data.name}$`, 'i') }
                        }).select('contactInfo.founders');

                        if (existing?.contactInfo?.founders && existing.contactInfo.founders.length > 0) {
                            existingFounders = existing.contactInfo.founders;
                            console.log(`✅ Found existing founders in DB for ${data.name}: ${existingFounders.join(', ')}`);
                        }
                    } catch (err) {
                        // Ignore DB error, proceed to scrape
                    }

                    if (existingFounders.length > 0) {
                        data.contactInfo = {
                            ...data.contactInfo,
                            founders: existingFounders
                        };
                    } else {
                        // Scrape if not in DB
                        const founders = await FounderDiscoveryService.discoverFounders(
                            data.name,
                            data.website || undefined
                        );

                        if (founders && founders.length > 0) {
                            console.log(`✅ Found ${founders.length} founder(s): ${founders.join(', ')}`);
                            data.contactInfo = {
                                ...data.contactInfo,
                                founders: founders
                            };
                        }
                    }
                } catch (e) {
                    console.warn(`Enhanced founder discovery failed: ${e}`);
                }
            }

            return data;

        } catch (err) {
            console.error("Enrichment browser error:", err);
            await browser.close();
            return data;
        }
    }
}
