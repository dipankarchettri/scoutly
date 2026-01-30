// Company Extractor - LLM-powered extraction of company data from text

import { CompanyData } from '../search/interfaces';

// LLM Provider preference
type LLMProvider = 'ollama' | 'openrouter';

const OLLAMA_BASE_URL = process.env.OLLAMA_URL || "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "llama3.1:8b";
const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
const OPENROUTER_MODEL = "meta-llama/llama-3.1-8b-instruct";

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export class CompanyExtractor {
    private provider: LLMProvider;

    constructor() {
        // Prefer Ollama (free) if configured
        if (process.env.OLLAMA_URL) {
            this.provider = 'ollama';
        } else if (process.env.OPENROUTER_API_KEY) {
            this.provider = 'openrouter';
        } else {
            this.provider = 'ollama'; // Default to Ollama
        }
        console.log(`🧠 CompanyExtractor initialized with provider: ${this.provider}`);
    }

    /**
     * Extract company data from raw text using LLM
     */
    /**
     * Extract company data from raw text using LLM, falling back to simple extraction
     */
    async extract(text: string, sourceUrl: string, apiKey?: string): Promise<CompanyData | null> {
        // Fallback immediately if text is too short
        if (!text || text.length < 10) return null;

        // FILTER: Reject obvious HTTP Error pages
        if (text.match(/403 Forbidden|Access Denied|Cloudflare|Captcha|404 Not Found|Error: Forbidden/i)) {
            console.warn(`⚠️ Skipped processing error page: ${sourceUrl}`);
            return null;
        }

        try {
            const prompt = this.buildPrompt(text);
            const response = await this.callLLM(prompt, apiKey);
            const data = this.parseResponse(response, sourceUrl);
            if (data) return data;

            // If LLM returned valid structure but indicated "not a startup", return null
            // But if it failed to parse or whatever, we might want fallback?
            // Actually parseResponse returns null if !isStartup.
            // So if null, we might want to try simple extraction if we are desperate?
            // No, if LLM says no, it's likely no. 
            // BUT, if callLLM throws error (401 etc), we catch it below.
            return this.simpleExtract(text, sourceUrl);

        } catch (error) {
            console.warn('CompanyExtractor LLM failed, using fallback:', error instanceof Error ? error.message : error);
            return this.simpleExtract(text, sourceUrl);
        }
    }

    /**
     * Simple fallback extraction when LLM is unavailable
     */
    private simpleExtract(text: string, sourceUrl: string): CompanyData | null {
        // Text is expected to be "Title\n\nSnippet"
        const parts = text.split('\n\n');
        const name = parts[0]?.trim() || "Unknown Company";

        // Filter out obvious article titles if we are falling back
        const invalidPatterns = [/Top \d+/, /Startups? to watch/i, /Funding Trends/i, /Roundup/i, /Boom in/i, /Investors/i];
        if (name.length > 50 || name.split(' ').length > 6 || invalidPatterns.some(p => p.test(name))) {
            return null;
        }

        const description = parts.length > 1 ? parts.slice(1).join(' ').trim() : parts[0];

        return {
            name: name,
            description: description,
            website: '', // Hard to extract accurately without LLM
            fundingAmount: 'Undisclosed',
            roundType: 'Unknown',
            dateAnnounced: new Date().toISOString().split('T')[0],
            location: 'Unknown',
            industry: 'Technology',
            founders: [],
            investors: [],
            tags: [],
            source: 'Web Search (Fallback)',
            sourceUrl: sourceUrl,
            confidence: 0.3 // Low confidence
        };
    }

    /**
     * Extract multiple companies from batch of texts
     */
    async extractBatch(items: { text: string; url: string }[], apiKey?: string): Promise<CompanyData[]> {
        const companies: CompanyData[] = [];

        for (const item of items) {
            const company = await this.extract(item.text, item.url, apiKey);
            if (company) {
                companies.push(company);
            }
            // Small delay to avoid rate limiting
            await delay(100);
        }

        return companies;
    }

    private buildPrompt(text: string): string {
        return `
    You are a venture capital analyst. Analyze the following text and determine if it is about a SPECIFIC startup receiving funding or launching a major product.
    
    Rules:
    1. If it is a generic industry news, opinion piece, or "top 10" list, return isValid: false.
    2. If it is about a specific startup getting funded, launched, or acquired, return isValid: true.
    3. If valid, extract the structured data.
    4. CRITICAL: Extract FOUNDER NAMES and any CONTACT INFO.
    5. CRITICAL: "website" field MUST be the STARTUP'S official website. If not found, return null.
    6. DESCRIPTION: Write a clear, 2-sentence description of what the company DOES.
    
    Return ONLY valid JSON in this format (no markdown, no bold keys):
    {
      "isValid": boolean,
      "reason": "short explanation",
      "data": {
        "name": "Startup Name",
        "dateAnnounced": "YYYY-MM-DD",
        "description": "High quality description",
        "website": "company.com",
        "fundingAmount": "$X Million",
        "roundType": "Seed/Series A",
        "location": "City, Country",
        "founders": ["Name 1", "Name 2"],
        "industry": "Specific Sector",
        "investors": ["Investor 1", "Investor 2"],
        "tags": ["tag1", "tag2"]
      },
      "confidence": 0.0-1.0
    }

    IMPORTANT: Do not use **bold** syntax for keys. Do not return markdown. Return PURE JSON.
    {
      "isValid": boolean,
      "reason": "short explanation",
      "data": {
        "name": "Startup Name",
        "dateAnnounced": "YYYY-MM-DD",
        "description": "High quality description",
        "website": "company.com",
        "fundingAmount": "$X Million",
        "roundType": "Seed/Series A",
        "location": "City, Country",
        "founders": ["Name 1", "Name 2"],
        "industry": "Specific Sector",
        "investors": ["Investor 1", "Investor 2"],
        "tags": ["tag1", "tag2"]
      },
      "confidence": 0.0-1.0
    }

    TEXT:
    ${text.substring(0, 15000)}`;
    }

    private async callLLM(prompt: string, apiKey?: string): Promise<string> {
        if (apiKey || this.provider === 'openrouter') {
            return this.callOpenRouter(prompt, apiKey);
        } else {
            return this.callOllama(prompt);
        }
    }

    private async callOllama(prompt: string): Promise<string> {
        const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                model: OLLAMA_MODEL,
                prompt,
                stream: false,
                options: { temperature: 0.1 }
            })
        });

        if (!response.ok) {
            throw new Error(`Ollama error: ${response.status}`);
        }

        const data = await response.json();
        return data.response || "";
    }

    private async callOpenRouter(prompt: string, userKey?: string): Promise<string> {
        const apiKey = userKey || process.env.OPENROUTER_API_KEY;
        if (!apiKey) throw new Error("OPENROUTER_API_KEY not set and no user key provided");

        const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: OPENROUTER_MODEL,
                messages: [{ role: "user", content: prompt }],
                temperature: 0.1
            })
        });

        if (!response.ok) {
            throw new Error(`OpenRouter error: ${response.status}`);
        }

        const data = await response.json();
        return data.choices?.[0]?.message?.content || "";
    }

    private parseResponse(response: string, sourceUrl: string): CompanyData | null {
        try {
            let parsed: any = null;

            // STRATEGY 1: Try JSON Extraction & Parse
            try {
                let cleanJson = response
                    .replace(/```json/g, '')
                    .replace(/```/g, '')
                    .trim();

                const firstOpen = cleanJson.indexOf('{');
                const lastClose = cleanJson.lastIndexOf('}');

                if (firstOpen !== -1 && lastClose !== -1) {
                    let jsonStr = cleanJson.substring(firstOpen, lastClose + 1);

                    // Simple repairs
                    jsonStr = jsonStr
                        .replace(/\*\*([a-zA-Z0-9_]+)\*\*\s*:/g, '"$1":') // Fix **key**:
                        .replace(/,\s*}/g, '}')
                        .replace(/,\s*]/g, ']');

                    parsed = JSON.parse(jsonStr);
                }
            } catch (e) {
                // Formatting is broken, fall through to Strategy 2
            }

            // STRATEGY 2: Fallback Regex Extraction (if JSON failed)
            if (!parsed) {
                console.log("⚠️ JSON parse failed, using fallback Regex extractor...");
                const fallbackObj: any = {};

                // Matches **key**: value OR key: value
                const extract = (key: string) => {
                    const match = response.match(new RegExp(`\\*\\*${key}\\*\\*:\\s*(.+)`, 'i')) ||
                        response.match(new RegExp(`${key}:\\s*(.+)`, 'i'));
                    return match ? match[1].trim() : '';
                };

                // Validity Check - Robust Regex for "true" / "false" with optional quotes/bold
                if (response.match(/isValid\*\*?:\s*["'*]*true/i)) fallbackObj.isValid = true;
                if (response.match(/isValid\*\*?:\s*["'*]*false/i)) fallbackObj.isValid = false;

                const reasonMatch = response.match(/reason\*\*?:\s*(.+)/i);
                if (reasonMatch) fallbackObj.reason = reasonMatch[1].trim();

                if (fallbackObj.isValid) {
                    fallbackObj.data = {
                        name: extract('name').replace(/^"|"$/g, '').replace(/,$/, ''),
                        description: extract('description').replace(/^"|"$/g, '').replace(/,$/, ''),
                        website: extract('website').replace(/^"|"$/g, '').replace(/,$/, ''),
                        industry: extract('industry').replace(/^"|"$/g, '').replace(/,$/, ''),
                        fundingAmount: extract('fundingAmount').replace(/^"|"$/g, '').replace(/,$/, ''),
                        founders: []
                    };

                    const foundersStr = extract('founders');
                    if (foundersStr) {
                        // Try to split by comma or parse array
                        if (foundersStr.startsWith('[')) {
                            try { fallbackObj.data.founders = JSON.parse(foundersStr); } catch (e) { }
                        } else {
                            fallbackObj.data.founders = foundersStr.split(',').map(s => s.trim().replace(/^"|"$/g, ''));
                        }
                    }

                    console.log(`✅ Fallback Parser Success: Extracted "${fallbackObj.data.name}" (${fallbackObj.data.industry})`);
                } else {
                    console.log(`❌ Fallback Parser Failed: 'isValid: true' not found or explicitly false. Reason: ${fallbackObj.reason || 'Unknown'}`);
                    // console.log("Debug Response:", response.substring(0, 100)); // Optional debug
                }
                parsed = fallbackObj;
            }

            // STRICT VALIDATION
            if (!parsed.isValid || !parsed.data?.name) {
                return null;
            }

            const c = parsed.data;

            // Extra Validation: Reject generic titles acting as names
            const invalidPatterns = [/Top \d+/, /Startups? to watch/i, /Funding Trends/i, /Roundup/i, /Boom in/i];
            if (invalidPatterns.some(p => p.test(c.name))) {
                return null;
            }

            return {
                name: c.name,
                description: c.description || '',
                website: c.website,
                fundingAmount: c.fundingAmount,
                roundType: c.roundType,
                dateAnnounced: c.dateAnnounced,
                location: c.location,
                industry: c.industry,
                founders: c.founders || [],
                investors: c.investors || [],
                tags: c.tags || [],
                source: 'LLM Extraction',
                sourceUrl,
                confidence: parsed.confidence || 0.8
            };
        } catch (error) {
            console.warn('Failed to parse LLM response:', response.substring(0, 100));
            return null;
        }
    }
}

// Export singleton
export const companyExtractor = new CompanyExtractor();
