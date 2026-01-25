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
    }

    /**
     * Extract company data from raw text using LLM
     */
    async extract(text: string, sourceUrl: string, apiKey?: string): Promise<CompanyData | null> {
        const prompt = this.buildPrompt(text);

        try {
            const response = await this.callLLM(prompt, apiKey);
            return this.parseResponse(response, sourceUrl);
        } catch (error) {
            console.warn('CompanyExtractor failed:', error);
            return null;
        }
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
        return `You are analyzing text to extract startup funding information.

Extract the following data if present:
- Company name
- Description (2 sentences max)
- Funding amount (e.g., "$10M")
- Round type (Seed, Series A, etc.)
- Date announced (YYYY-MM-DD)
- Location
- Industry
- Founders (names only)
- Investors

Return ONLY valid JSON (no markdown):
{
  "isStartup": true/false,
  "company": {
    "name": "...",
    "description": "...",
    "fundingAmount": "...",
    "roundType": "...",
    "dateAnnounced": "...",
    "location": "...",
    "industry": "...",
    "founders": ["..."],
    "investors": ["..."]
  },
  "confidence": 0.0-1.0
}

If this is NOT about a specific startup getting funded, return:
{"isStartup": false, "confidence": 0}

TEXT:
${text.substring(0, 8000)}`;
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
            // Clean JSON response
            const cleanJson = response
                .replace(/```json/g, '')
                .replace(/```/g, '')
                .trim();

            const parsed = JSON.parse(cleanJson);

            if (!parsed.isStartup || !parsed.company?.name) {
                return null;
            }

            const c = parsed.company;

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
                tags: [],
                source: 'LLM Extraction',
                sourceUrl,
                confidence: parsed.confidence || 0.5
            };
        } catch (error) {
            console.warn('Failed to parse LLM response:', response.substring(0, 100));
            return null;
        }
    }
}

// Export singleton
export const companyExtractor = new CompanyExtractor();
