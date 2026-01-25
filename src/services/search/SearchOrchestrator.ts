// Search Orchestrator - Main coordinator for startup discovery searches

import { SearxNGSource, BraveSource, Crawl4AISource, ExaSource, TavilySource } from './sources';
import { ResultAggregator } from './ResultAggregator';
import {
    ISearchSource,
    SearchResult,
    SearchSourceResult,
    CompanyData,
    AggregatedSearchResult,
    CreditInfo
} from './interfaces';
import { PRICING_TIERS, SEARCH_CONFIG, PricingTier } from '../../config/searchConfig';
import { validateAndExtractStartup } from '../aiService';

export class SearchOrchestrator {
    private sources: ISearchSource[] = [];
    private aggregator: ResultAggregator;
    private crawl4ai: Crawl4AISource;

    constructor() {
        // Initialize all sources
        this.sources = [
            new SearxNGSource(),
            new BraveSource(),
            new ExaSource(),
            new TavilySource()
        ];

        this.crawl4ai = new Crawl4AISource();
        this.aggregator = new ResultAggregator();
    }

    /**
     * Main search method - orchestrates all sources in parallel
     */
    async search(
        query: string,
        tier: PricingTier = 'free',
        page: number = 1,
        apiKey?: string
    ): Promise<AggregatedSearchResult> {
        const startTime = Date.now();
        const config = PRICING_TIERS[tier];

        console.log(`🔍 Starting search: "${query}" (tier: ${tier}, page: ${page})`);

        // Get enabled sources for this tier
        const enabledSources = this.sources.filter(s =>
            s.enabled && config.sources.includes(s.name.toLowerCase().replace(' ', ''))
        );

        // Also include sources that are enabled regardless of tier
        const activeSources = this.sources.filter(s => s.enabled);

        if (activeSources.length === 0) {
            console.warn('⚠️ No search sources available!');
            return this.emptyResult(query, startTime);
        }

        // Generate enhanced search queries
        const searchQueries = this.generateSearchQueries(query);

        // Execute searches in parallel across all sources and queries
        const searchPromises: Promise<SearchSourceResult>[] = [];

        for (const source of activeSources) {
            for (const searchQuery of searchQueries.slice(0, 2)) { // Limit to 2 queries per source
                searchPromises.push(
                    source.search(searchQuery).catch(error => ({
                        source: source.name,
                        results: [],
                        error: error.message,
                        latencyMs: 0
                    }))
                );
            }
        }

        // Wait for all searches with Promise.allSettled (never fails)
        const results = await Promise.allSettled(searchPromises);

        // Extract successful results
        const sourceResults: SearchSourceResult[] = results
            .filter((r): r is PromiseFulfilledResult<SearchSourceResult> => r.status === 'fulfilled')
            .map(r => r.value);

        // Track successful and failed sources
        const successfulSources = new Set<string>();
        const failedSources = new Set<string>();

        for (const result of sourceResults) {
            if (result.error) {
                failedSources.add(result.source);
            } else if (result.results.length > 0) {
                successfulSources.add(result.source);
            }
        }

        // Merge and deduplicate results
        const mergedResults = this.aggregator.mergeResults(sourceResults);

        // Filter for funding-related content
        const fundingResults = this.aggregator.filterFundingRelated(mergedResults);

        console.log(`📊 Found ${mergedResults.length} total results, ${fundingResults.length} funding-related`);

        // Extract company data from top results
        const companies = await this.extractCompanies(
            fundingResults.slice(0, config.maxCompaniesPerSearch * 2), // Get extra for filtering
            config.maxCompaniesPerSearch,
            apiKey
        );

        // Deduplicate companies
        const dedupedCompanies = this.aggregator.deduplicateCompanies(companies);

        // Paginate
        const perPage = config.companiesPerPage;
        const totalCompanies = Math.min(dedupedCompanies.length, config.maxCompaniesPerSearch);
        const totalPages = Math.min(Math.ceil(totalCompanies / perPage), config.pagesPerSearch);
        const startIndex = (page - 1) * perPage;
        const endIndex = Math.min(startIndex + perPage, totalCompanies);
        const paginatedCompanies = dedupedCompanies.slice(startIndex, endIndex);

        const totalLatency = Date.now() - startTime;
        console.log(`✅ Search completed in ${totalLatency}ms`);

        return {
            companies: paginatedCompanies,
            pagination: {
                page,
                totalPages,
                totalCompanies,
                perPage
            },
            meta: {
                query,
                sources: activeSources.map(s => s.name),
                successfulSources: Array.from(successfulSources),
                failedSources: Array.from(failedSources),
                totalLatencyMs: totalLatency
            }
        };
    }

    /**
     * Generate enhanced search queries from user input
     */
    private generateSearchQueries(query: string): string[] {
        const queries = [query];

        // Add search patterns
        for (const pattern of SEARCH_CONFIG.searchPatterns) {
            queries.push(pattern.replace('{query}', query));
        }

        return queries;
    }

    /**
     * Extract company data from search results using LLM
     */
    private async extractCompanies(
        results: SearchResult[],
        maxCompanies: number,
        apiKey?: string
    ): Promise<CompanyData[]> {
        const companies: CompanyData[] = [];

        // Import extractor dynamically to avoid circular deps if any
        const { companyExtractor } = await import('../llm/CompanyExtractor');

        // First, try to extract from snippets directly (fast)
        for (const result of results) {
            if (companies.length >= maxCompanies) break;

            try {
                // Combine title and snippet for extraction
                const content = `${result.title}\n\n${result.snippet}`;

                // Use CompanyExtractor with optional BYOK key
                const extracted = await companyExtractor.extract(content, result.url, apiKey);

                if (extracted) {
                    companies.push({
                        ...extracted,
                        source: result.source,
                        confidence: result.relevanceScore || 0.5
                    });
                }
            } catch (error) {
                console.warn(`⚠️ Failed to extract from result: ${result.url}`);
            }
        }

        // If we need more companies, crawl the actual URLs
        if (companies.length < maxCompanies) {
            const urlsToCrawl = results
                .slice(companies.length, companies.length + (maxCompanies - companies.length) * 2)
                .map(r => r.url);

            if (urlsToCrawl.length > 0) {
                try {
                    const crawledContent = await this.crawl4ai.crawlUrls(urlsToCrawl);

                    for (const crawled of crawledContent) {
                        if (companies.length >= maxCompanies) break;
                        if (crawled.error || !crawled.content) continue;

                        try {
                            const extracted = await companyExtractor.extract(crawled.content, crawled.url, apiKey);

                            if (extracted) {
                                // Check if we already have this company
                                const exists = companies.some(c =>
                                    c.name.toLowerCase() === extracted.name.toLowerCase()
                                );

                                if (!exists) {
                                    companies.push({
                                        ...extracted,
                                        source: 'Crawl4AI',
                                        confidence: 0.7
                                    });
                                }
                            }
                        } catch (error) {
                            console.warn(`⚠️ Failed to extract from crawled URL: ${crawled.url}`);
                        }
                    }
                } catch (error) {
                    console.warn('⚠️ Crawl4AI extraction failed:', error);
                }
            }
        }

        return companies;
    }

    /**
     * Return empty result structure
     */
    private emptyResult(query: string, startTime: number): AggregatedSearchResult {
        return {
            companies: [],
            pagination: {
                page: 1,
                totalPages: 0,
                totalCompanies: 0,
                perPage: 10
            },
            meta: {
                query,
                sources: [],
                successfulSources: [],
                failedSources: [],
                totalLatencyMs: Date.now() - startTime
            }
        };
    }

    /**
     * Get list of available sources and their status
     */
    getSourceStatus(): { name: string; enabled: boolean; priority: number }[] {
        return this.sources.map(s => ({
            name: s.name,
            enabled: s.enabled,
            priority: s.priority
        }));
    }
}

// Export singleton instance
export const searchOrchestrator = new SearchOrchestrator();
