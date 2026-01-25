// SearxNG Search Source - Self-hosted metasearch engine (FREE)

import { ISearchSource, SearchResult, SearchSourceResult } from '../interfaces';
import { FREE_SOURCES } from '../../../config/searchConfig';

export class SearxNGSource implements ISearchSource {
    name = 'SearxNG';
    enabled: boolean;
    priority: number;
    private baseUrl: string;
    private timeout: number;

    constructor() {
        const config = FREE_SOURCES.searxng;
        this.enabled = config.enabled;
        this.priority = config.priority;
        this.baseUrl = config.baseUrl;
        this.timeout = config.timeout;
    }

    async search(query: string): Promise<SearchSourceResult> {
        const startTime = Date.now();

        if (!this.enabled) {
            return {
                source: this.name,
                results: [],
                error: 'SearxNG is not enabled',
                latencyMs: 0
            };
        }

        try {
            const searchUrl = `${this.baseUrl}/search?q=${encodeURIComponent(query)}&format=json&categories=general,news`;

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this.timeout);

            const response = await fetch(searchUrl, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'User-Agent': 'Scoutly/1.0 (Startup Discovery)'
                },
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`SearxNG returned ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();

            const results: SearchResult[] = (data.results || []).map((item: any) => ({
                title: item.title || '',
                url: item.url || '',
                snippet: item.content || item.snippet || '',
                source: this.name,
                timestamp: item.publishedDate ? new Date(item.publishedDate) : undefined,
                relevanceScore: item.score || 0.5
            }));

            return {
                source: this.name,
                results,
                latencyMs: Date.now() - startTime
            };

        } catch (error: any) {
            console.error(`❌ SearxNG search failed:`, error.message);
            return {
                source: this.name,
                results: [],
                error: error.message,
                latencyMs: Date.now() - startTime
            };
        }
    }
}
