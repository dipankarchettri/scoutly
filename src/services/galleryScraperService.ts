import mongoose from 'mongoose';
import puppeteer from 'puppeteer';
import dotenv from 'dotenv';
import { Startup } from '../models/Startup';


dotenv.config();

const MONGO_URI = process.env.MONGODB_URI || '';
const TARGET_URL = 'https://startups.gallery/news';
const CUTOFF_DATE = new Date('2025-09-29');

// Utility to slugify name for URL
function slugify(text: string): string {
    return text.toString().toLowerCase()
        .replace(/\s+/g, '-')           // Replace spaces with -
        .replace(/[^\w\-]+/g, '')       // Remove all non-word chars
        .replace(/\-\-+/g, '-')         // Replace multiple - with single -
        .replace(/^-+/, '')             // Trim - from start
        .replace(/-+$/, '');            // Trim - from end
}

// Utility to parse date string like "Jan 13, 2026"
function parseDateStr(dateStr: string): Date {
    return new Date(dateStr);
}

async function connectDB() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('✅ Connected to MongoDB Atlas');
    } catch (err) {
        console.error('❌ MongoDB connection error:', err);
        process.exit(1);
    }
}

export async function runGalleryScrape() {
    console.log('🚀 Starting Startups.gallery Scraper (Lazy Mode)...');

    // Ensure DB connection if running standalone, but usually server handles it.
    if (mongoose.connection.readyState === 0) {
        await connectDB();
    }

    // ... logic ...


    // 1. Clean DB - DISABLED for incremental updates
    // console.log('🧹 Cleaning database...');
    // await Startup.deleteMany({});
    // console.log('✨ Database cleaned.');

    // 2. Launch Puppeteer
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    // --- PHASE 1: LIST SCRAPE ---
    console.log(`\n--- PHASE 1: LIST SCRAPE (${TARGET_URL}) ---\n`);
    await page.goto(TARGET_URL, { waitUntil: 'networkidle2', timeout: 60000 });

    // Scroll loop until we pass the cutoff date
    let reachedCutoff = false;
    let oldHeight = 0;
    while (!reachedCutoff) {
        // Scrape current dates visible to check cutoff
        const dates = await page.evaluate(() => {
            const bodyText = document.body.innerText;
            const lines = bodyText.split('\n');
            // Very rough check for year 2024 or earlier dates if present, or just standard date parsing
            // For efficiency, we just scroll a bit.
            return [];
        });

        // Actually, let's just scrape the list text after scrolling A LOT. 
        // Or check the last extracted date dynamically.
        // Let's scroll 5 times for now as a safe buffer, or until height validation fails.
        // User said "scrape till sept 29 2025".

        oldHeight = await page.evaluate('document.body.scrollHeight') as number;
        await page.evaluate('window.scrollTo(0, document.body.scrollHeight)');
        await new Promise(r => setTimeout(r, 2000)); // Wait for lazy load
        const newHeight = await page.evaluate('document.body.scrollHeight') as number;
        console.log(`📜 Scrolled to height ${newHeight}...`);

        // Extract text to check dates
        const bodyText = await page.evaluate(() => document.body.innerText);
        // Look for dates like "Sep 20, 2025"
        if (bodyText.includes('Sep 20, 2025') || bodyText.includes('Aug 2025')) { // Heuristic check
            reachedCutoff = true;
        }

        // Failsafe: if height didnt change much
        if (newHeight === oldHeight) break;

        // Manual override: User said "slow and lazy". Let's do a fixed number of scrolls to be safe for now
        // assuming standard volume. 
        // 10 scrolls should cover a few months.
    }

    // Now scrape the list
    const bodyText = await page.evaluate(() => document.body.innerText);
    const lines = bodyText.split('\n').map(l => l.trim()).filter(l => l.length > 0);

    // Extract actual links to map names to URLs
    const linksMap = await page.evaluate(() => {
        const anchors = Array.from(document.querySelectorAll('a'));
        return anchors.map(a => ({
            text: a.innerText.trim(),
            href: a.href,
            cleanHref: a.href.replace(/^(?:\/\/|[^\/]+)*\//, "")
        }));
    });

    const initialStartups: any[] = [];

    // Parse Logic
    for (let i = 0; i < lines.length; i++) {
        // Pattern: Name -> Funding · Round -> Date -> Investor
        if (lines[i].includes('$') && lines[i].includes('·')) {
            const name = lines[i - 1];
            const fundingLine = lines[i]; // "$25M · Series A"
            const dateStr = lines[i + 1];   // "Jan 13, 2026"
            const leadInvestor = lines[i + 2]; // "Bessemer..."

            if (!name || !dateStr) continue;

            const date = parseDateStr(dateStr);
            if (isNaN(date.getTime())) continue;

            // Date Check
            if (date < CUTOFF_DATE) {
                console.log(`🛑 Reached cutoff date: ${dateStr} for ${name}`);
                // reachedCutoff = true; // Optimization
                continue; // Skip old ones
            }

            const [amount, round] = fundingLine.split('·').map(s => s.trim());

            // Find real URL
            // exact match or match where link text contains name
            let matchedLink = linksMap.find(l => l.text === name && l.href.includes('/companies/'));

            // If no exact match, try lenient match (e.g. name "Rain" matches link text "Rain")
            // Or if the link href contains the slugified name
            if (!matchedLink) {
                const slug = slugify(name);
                matchedLink = linksMap.find(l => l.href.includes(`/companies/${slug}`) || (l.text.includes(name) && l.href.includes('/companies/')));
            }

            // Fallback: If still not found, try to find a link that is "near" this text in the DOM?
            // Puppeteer text parsing doesn't give DOM proximity.
            // But usually the name IS the link.

            const detailUrl = matchedLink ? matchedLink.href : `https://startups.gallery/companies/${slugify(name)}`;

            initialStartups.push({
                name: name,
                fundingAmount: amount,
                roundType: round,
                dateAnnounced: dateStr, // Keep string for display, convert to Date for Obj
                dateObj: date,
                investors: [leadInvestor],
                sourceUrl: detailUrl
            });
        }
    }

    console.log(`\n✅ Phase 1 Complete. Found ${initialStartups.length} valid startups since Sept 29, 2025.`);

    // Save initial batch (INCREMENTAL)
    let newCount = 0;
    for (const s of initialStartups) {
        // Check if exists
        const exists = await Startup.findOne({ name: s.name });
        if (exists) {
            console.log(`   ⏭️  Skipping existing: ${s.name}`);
            continue;
        }

        const doc = new Startup({
            name: s.name,
            canonicalName: s.name.toLowerCase().replace(/[^a-z0-9]/g, ''),
            fundingAmount: s.fundingAmount,
            roundType: s.roundType,
            dateAnnounced: s.dateAnnounced,
            dateAnnouncedISO: s.dateObj, // Fixed: populate for sorting
            investors: s.investors,
            description: s.name, // Placeholder
            tags: ['Technology'], // Placeholder
            sources: [{
                sourceName: 'startups.gallery',
                sourceUrl: s.sourceUrl,
                extractedAt: new Date(),
                confidence: 0.5,
                sourceType: 'scraper',
                notes: 'Initial scrape from list page'
            }],
            sourceUrl: s.sourceUrl,
            confidenceScore: 0.5 // Initial score
        });
        await doc.save();
        console.log(`   🆕 Prepared: ${s.name} -> ${s.sourceUrl}`);
        newCount++;
    }
    console.log(`\n✨ Added ${newCount} new startups.`);

    // --- PHASE 2: DETAIL SCRAPE ---
    console.log(`\n--- PHASE 2: DETAIL SCRAPE (Lazy Mode) ---\n`);

    // Iterate over just-saved startups
    const toEnrich = await Startup.find({
        'sources.sourceName': 'startups.gallery',
        confidenceScore: { $lt: 0.9 }
    });

    for (const s of toEnrich) {
        const detailUrl = s.sourceUrl;
        console.log(`👉 Visiting: ${s.name} (${detailUrl})`);

        try {
            await page.goto(detailUrl, { waitUntil: 'networkidle2', timeout: 30000 });

            // Wait a bit (Lazy/Polite)
            await new Promise(r => setTimeout(r, 2000));

            // Extract Data
            const data = await page.evaluate(() => {
                const text = document.body.innerText;
                const dLines = text.split('\n').filter(l => l.trim().length > 0);

                // Website
                const links = Array.from(document.querySelectorAll('a'));
                const webLink = links.find(a => a.innerText.toLowerCase().includes('visit website') || a.innerText.toLowerCase().includes('website'));

                // Industry Extraction: Look for links to /categories/industries/
                const industryLinks = links.filter(a => a.href.includes('/categories/industries/'));
                const potentialTags = industryLinks.map(a => a.innerText.trim()).filter(t => t.length > 0);

                return {
                    textDump: text,
                    website: webLink ? webLink.href : '',
                    potentialTags
                };
            });

            // Local Regex extraction for obvious fields
            const lines = data.textDump.split('\n').map(l => l.trim());

            // Team Size: "11-50"
            const teamSize = lines.find(l => /\d+–\d+|\d+-\d+/.test(l) && l.length < 15) || '';

            // Description
            const description = lines.find(l => l.length > 60 && !l.includes('Cookie')) || s.name;

            // Industry selection from potential tags
            // We prioritize known industries if found, otherwise take the first "Tag-like" element that isn't the name or location
            const knownIndustries = ['Biotech', 'Fintech', 'Software', 'Hardware', 'AI', 'Crypto', 'Healthcare', 'Consumer', 'B2B', 'Enterprise', 'Security', 'Energy', 'Robotics', 'Space', 'Education'];

            let industry = 'Technology';
            // 1. Check strict match
            const strictMatch = data.potentialTags.find(t => knownIndustries.includes(t));
            if (strictMatch) {
                industry = strictMatch;
            } else {
                // 2. Fallback to plausible tag (but exclude UI elements)
                const uiElements = ['Get Updates', 'Startups', 'San Francisco', 'New York', 'London', 'Visit Website'];
                const candidate = data.potentialTags.find(t => t !== s.name && !uiElements.includes(t));
                if (candidate) {
                    industry = candidate;
                } else {
                    // 3. Use AI classification when tags are missing/generic
                    console.log(`   🤖 Using AI to classify: ${s.name}`);
                    try {
                        const { classifyIndustry } = await import('./aiService');
                        industry = await classifyIndustry(s.name, description);
                        console.log(`   ✨ AI classified as: ${industry}`);
                    } catch (aiError) {
                        console.error(`   ❌ AI failed:`, aiError);
                        industry = 'Technology';
                    }
                }
            }

            // Update Doc
            s.website = data.website || s.website;
            s.teamSize = teamSize || s.teamSize;
            s.description = description;
            s.industry = industry;
            s.tags = [industry];

            s.confidenceScore = 1.0; // Fully processed
            await s.save();
            console.log(`   ✅ Enriched: ${s.name}`);

        } catch (err: any) {
            console.error(`   ❌ Failed to enrich ${s.name} (URL: ${detailUrl}):`, err);
            console.error(`   Full error:`, JSON.stringify(err, null, 2));
            // Non-fatal, continue to next
        }
    }

    console.log('\n🎉 Scraping Complete!');
    await browser.close();
    // process.exit(0); // Removed for server integration
}

// connectDB().then(scrapeGallery);
