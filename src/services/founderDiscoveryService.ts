import puppeteer from 'puppeteer';
import { extractFounders } from './aiService';

interface SearchResult {
    title: string;
    snippet: string;
    link: string;
}

export class FounderDiscoveryService {
    
    // Google dorking queries for finding founders
    private static getSearchQueries(companyName: string, companyWebsite?: string): string[] {
        let domain = '';
        
        // Safely extract domain from website
        if (companyWebsite && companyWebsite !== 'null') {
            try {
                // Add protocol if missing
                const urlToProcess = companyWebsite.startsWith('http') 
                    ? companyWebsite 
                    : `https://${companyWebsite}`;
                domain = new URL(urlToProcess).hostname;
            } catch (e) {
                console.warn(`Invalid website URL: ${companyWebsite}`);
                domain = '';
            }
        }
        
        return [
            `"${companyName}" CEO founder`,
            `"${companyName}" "founded by"`,
            `"${companyName}" CEO site:linkedin.com/in/`,
            `"${companyName}" founder site:crunchbase.com`,
            `"${companyName}" founders site:techcrunch.com`,
            domain ? `site:${domain} "founder" OR "CEO" OR "team"` : '',
            `"${companyName}" "co-founder"`,
        ].filter(Boolean);
    }
    
    // Search using DuckDuckGo HTML (no API key needed)
    private static async searchDuckDuckGo(query: string): Promise<SearchResult[]> {
        const browser = await puppeteer.launch({ 
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox'] 
        });
        
        try {
            const page = await browser.newPage();
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
            
            const searchUrl = `https://html.duckduckgo.com/html?q=${encodeURIComponent(query)}`;
            await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
            
            const results = await page.evaluate(() => {
                const items: SearchResult[] = [];
                const resultElements = document.querySelectorAll('.result');
                
                resultElements.forEach((el, idx) => {
                    if (idx >= 5) return; // Top 5 results
                    
                    const titleEl = el.querySelector('.result__a');
                    const snippetEl = el.querySelector('.result__snippet');
                    const urlEl = el.querySelector('.result__url');
                    
                    if (titleEl && snippetEl) {
                        items.push({
                            title: titleEl.textContent?.trim() || '',
                            snippet: snippetEl.textContent?.trim() || '',
                            link: urlEl?.textContent?.trim() || ''
                        });
                    }
                });
                
                return items;
            });
            
            return results;
        } catch (error) {
            console.warn('DuckDuckGo search failed:', error);
            return [];
        } finally {
            await browser.close();
        }
    }
    
    // Extract founders from search results using AI
    private static async extractFoundersFromResults(companyName: string, results: SearchResult[]): Promise<string[]> {
        if (results.length === 0) return [];
        
        const combinedText = results.map(r => 
            `Title: ${r.title}\nSnippet: ${r.snippet}\nSource: ${r.link}\n---`
        ).join('\n\n');
        
        const prompt = `
        Extract the names of FOUNDERS or CEO of "${companyName}" from these search results.
        Return ONLY a JSON array of founder names, e.g. ["John Doe", "Jane Smith"].
        If no founders found, return [].
        
        Rules:
        - Only include real human names
        - Include CEO if mentioned with the company
        - Exclude investors unless labeled as founder
        - Return valid JSON only, no markdown
        
        Search Results:
        ${combinedText.substring(0, 8000)}
        `;
        
        try {
            const founders = await extractFounders(prompt);
            return founders;
        } catch (error) {
            console.error('AI extraction failed:', error);
            return [];
        }
    }
    
    // Main discovery function
    static async discoverFounders(companyName: string, companyWebsite?: string): Promise<string[]> {
        console.log(`🔍 Discovering founders for: ${companyName}`);
        
        const queries = this.getSearchQueries(companyName, companyWebsite);
        let allFounders: Set<string> = new Set();
        
        // Try multiple search queries
        for (const query of queries.slice(0, 3)) { // Limit to top 3 queries to save time
            console.log(`  📡 Searching: "${query.substring(0, 60)}..."`);
            
            try {
                const results = await this.searchDuckDuckGo(query);
                
                if (results.length > 0) {
                    const founders = await this.extractFoundersFromResults(companyName, results);
                    
                    if (founders.length > 0) {
                        console.log(`  ✅ Found ${founders.length} founder(s): ${founders.join(', ')}`);
                        founders.forEach(f => allFounders.add(f));
                        
                        // If we found founders, we can stop early
                        if (allFounders.size >= 3) break;
                    }
                }
                
                // Small delay between searches
                await new Promise(resolve => setTimeout(resolve, 1000));
                
            } catch (error) {
                console.warn(`  ⚠️ Search failed for query: ${query}`);
            }
        }
        
        const finalFounders = Array.from(allFounders);
        
        if (finalFounders.length > 0) {
            console.log(`🎯 Total unique founders found: ${finalFounders.join(', ')}`);
        } else {
            console.log(`❌ No founders found for ${companyName}`);
        }
        
        return finalFounders;
    }
}
