
import puppeteer from 'puppeteer';
import { Startup } from '../models/Startup';
import { FounderDiscoveryService } from './founderDiscoveryService';
import { validateAndExtractStartup } from './aiService';

export class EnrichmentService {

    static async enrichStartup(startupId: string) {
        console.log(`✨ Enriching Startup ID: ${startupId}`);
        try {
            const startup = await Startup.findById(startupId);
            if (!startup) {
                console.error("Startup not found for enrichment");
                return;
            }


            const s = startup as any;
            const needsWebsite = !s.website || s.website.includes('techcrunch') || s.website.includes('finsmes');
            const needsFounders = !s.contactInfo?.founders || s.contactInfo.founders.length === 0;

            const genericDomains = ['Startup', 'Startups', 'Technology', 'Company', 'Uncategorized', 'Industry'];
            const needsDomainUpdate = !s.industry || genericDomains.includes(s.industry);

            if (!needsWebsite && !needsFounders && !needsDomainUpdate) {
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

                if (needsWebsite) {
                    console.log(`Searching for website (DDG): ${startup.name}`);
                    await page.goto(`https://html.duckduckgo.com/html?q=${encodeURIComponent(startup.name + " official website")}`, { waitUntil: 'domcontentloaded' });

                    const result = await page.evaluate(() => {
                        const el = document.querySelector('.result__url');
                        return el ? (el as HTMLElement).innerText.trim() : null;
                    });

                    let websiteUrl = result ? result.trim() : null;
                    if (websiteUrl) {
                        if (!websiteUrl.startsWith('http')) {
                            websiteUrl = 'https://' + websiteUrl;
                        }
                        console.log(`Found website: ${websiteUrl}`);
                        startup.website = websiteUrl;

                        try {
                            console.log(`headerless visit to ${websiteUrl} for description...`);
                            await page.goto(websiteUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });

                            const metaDesc = await page.evaluate(() => {
                                const d = document.querySelector('meta[name="description"]');
                                const og = document.querySelector('meta[property="og:description"]');
                                return (d as HTMLMetaElement)?.content || (og as HTMLMetaElement)?.content || document.body.innerText.substring(0, 300);
                            });

                            if (metaDesc && metaDesc.length > 20) {
                                if (!startup.description || startup.description.length < 50 || startup.description.includes('AI startup in')) {
                                    console.log(`Updating description from website: ${metaDesc.substring(0, 50)}...`);
                                    startup.description = metaDesc.substring(0, 500); // Reasonable limit
                                }
                            }
                        } catch (e) {
                            console.warn(`Could not scrape website content: ${e}`);
                        }

                    } else {
                        console.log("No website found on DDG.");
                    }
                }


                // AI Re-classification for generic domains
                if (needsDomainUpdate) {
                    console.log(`🧠 Re-evaluating generic industry: ${startup.industry}`);
                    try {
                        const context = `Startup Name: ${startup.name}\nDescription: ${startup.description}\nWebsite: ${startup.website || 'N/A'}`;
                        const result = await validateAndExtractStartup(context);

                        if (result.isValid && result.data?.industry) {
                            const newIndustry = result.data.industry;
                            if (!genericDomains.includes(newIndustry)) {
                                console.log(`✅ Updated domain from '${startup.industry}' to '${newIndustry}'`);
                                startup.industry = newIndustry;
                            }
                        }
                    } catch (e) {
                        console.warn(`Domain update failed: ${e}`);
                    }
                }

                await browser.close();

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

                if (!s.canonicalName) {
                    s.canonicalName = s.name.toLowerCase().replace(/[^a-z0-9]/g, '');
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
