// Paid Sources - Placeholders for EXA, Tavily, Perplexity (Add API keys later)

import { ISearchSource, SearchResult, SearchSourceResult } from '../interfaces';
import { PAID_SOURCES } from '../../../config/searchConfig';

/**
 * EXA Search Source (Paid - $49+/month)
 * Enable by adding EXA_API_KEY to environment
 */
export class ExaSource implements ISearchSource {
    name = 'EXA';
    enabled: boolean;
    priority: number;
    private apiKey: string;
    private baseUrl: string;

    constructor() {
        const config = PAID_SOURCES.exa;
        this.enabled = config.enabled && !!config.apiKey;
        this.priority = config.priority;
        this.apiKey = config.apiKey;
        this.baseUrl = config.baseUrl;
    }

    async search(query: string): Promise<SearchSourceResult> {
        const startTime = Date.now();

        if (!this.enabled || !this.apiKey) {
            return {
                source: this.name,
                results: [],
                error: 'EXA API key not configured (add EXA_API_KEY to .env)',
                latencyMs: 0
            };
        }

        try {
            const response = await fetch(`${this.baseUrl}/search`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': this.apiKey
                },
                body: JSON.stringify({
                    query,
                    type: 'neural',
                    useAutoprompt: true,
                    numResults: 20,
                    contents: {
                        text: { maxCharacters: 2000 }
                    }
                })
            });

            if (!response.ok) {
                throw new Error(`EXA API error: ${response.status}`);
            }

            const data = await response.json();

            const results: SearchResult[] = (data.results || []).map((item: any) => ({
                title: item.title || '',
                url: item.url || '',
                snippet: item.text || item.snippet || '',
                source: this.name,
                timestamp: item.publishedDate ? new Date(item.publishedDate) : undefined,
                relevanceScore: item.score || 0.8
            }));

            return {
                source: this.name,
                results,
                latencyMs: Date.now() - startTime
            };

        } catch (error: any) {
            return {
                source: this.name,
                results: [],
                error: error.message,
                latencyMs: Date.now() - startTime
            };
        }
    }
}

/**
 * Tavily Search Source (Paid - $40+/month)
 * Enable by adding TAVILY_API_KEY to environment
 */
export class TavilySource implements ISearchSource {
    name = 'Tavily';
    enabled: boolean;
    priority: number;
    private apiKey: string;
    private baseUrl: string;

    constructor() {
        const config = PAID_SOURCES.tavily;
        this.enabled = config.enabled && !!config.apiKey;
        this.priority = config.priority;
        this.apiKey = config.apiKey;
        this.baseUrl = config.baseUrl;
    }

    async search(query: string): Promise<SearchSourceResult> {
        const startTime = Date.now();

        if (!this.enabled || !this.apiKey) {
            return {
                source: this.name,
                results: [],
                error: 'Tavily API key not configured (add TAVILY_API_KEY to .env)',
                latencyMs: 0
            };
        }

        try {
            const response = await fetch(`${this.baseUrl}/search`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    api_key: this.apiKey,
                    query,
                    search_depth: 'advanced',
                    include_answer: true,
                    max_results: 20
                })
            });

            if (!response.ok) {
                throw new Error(`Tavily API error: ${response.status}`);
            }

            const data = await response.json();

            const results: SearchResult[] = (data.results || []).map((item: any) => ({
                title: item.title || '',
                url: item.url || '',
                snippet: item.content || '',
                source: this.name,
                relevanceScore: item.score || 0.8
            }));

            return {
                source: this.name,
                results,
                latencyMs: Date.now() - startTime
            };

        } catch (error: any) {
            return {
                source: this.name,
                results: [],
                error: error.message,
                latencyMs: Date.now() - startTime
            };
        }
    }
}

// Export all paid sources
export const PaidSources = {
    ExaSource,
    TavilySource
};
