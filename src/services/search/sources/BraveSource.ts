// Brave Search API Source (FREE tier: 5,000 queries/month)

import { ISearchSource, SearchResult, SearchSourceResult } from '../interfaces';
import { FREE_SOURCES } from '../../../config/searchConfig';

export class BraveSource implements ISearchSource {
    name = 'Brave Search';
    enabled: boolean;
    priority: number;
    private apiKey: string;
    private baseUrl: string;
    private timeout: number;

    constructor() {
        const config = FREE_SOURCES.brave;
        this.enabled = config.enabled;
        this.priority = config.priority;
        this.apiKey = config.apiKey;
        this.baseUrl = config.baseUrl;
        this.timeout = config.timeout;
    }

    async search(query: string): Promise<SearchSourceResult> {
        const startTime = Date.now();

        if (!this.enabled || !this.apiKey) {
            return {
                source: this.name,
                results: [],
                error: 'Brave Search API key not configured',
                latencyMs: 0
            };
        }

        try {
            const searchUrl = `${this.baseUrl}/web/search?q=${encodeURIComponent(query)}&count=20&freshness=pw`;

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this.timeout);

            const response = await fetch(searchUrl, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Accept-Encoding': 'gzip',
                    'X-Subscription-Token': this.apiKey
                },
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Brave API returned ${response.status}: ${errorText}`);
            }

            const data = await response.json();

            const results: SearchResult[] = [];

            // Process web results
            if (data.web?.results) {
                for (const item of data.web.results) {
                    results.push({
                        title: item.title || '',
                        url: item.url || '',
                        snippet: item.description || '',
                        source: this.name,
                        timestamp: item.page_age ? new Date(item.page_age) : undefined,
                        relevanceScore: 0.7
                    });
                }
            }

            // Process news results if available
            if (data.news?.results) {
                for (const item of data.news.results) {
                    results.push({
                        title: item.title || '',
                        url: item.url || '',
                        snippet: item.description || '',
                        source: `${this.name} (News)`,
                        timestamp: item.age ? new Date(item.age) : undefined,
                        relevanceScore: 0.8 // News often more relevant
                    });
                }
            }

            return {
                source: this.name,
                results,
                latencyMs: Date.now() - startTime
            };

        } catch (error: any) {
            console.error(`❌ Brave search failed:`, error.message);
            return {
                source: this.name,
                results: [],
                error: error.message,
                latencyMs: Date.now() - startTime
            };
        }
    }
}
