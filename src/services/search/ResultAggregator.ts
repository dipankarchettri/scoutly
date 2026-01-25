// Result Aggregator - Merges, deduplicates, and ranks search results

import { SearchResult, SearchSourceResult, CompanyData } from './interfaces';
import { SEARCH_CONFIG } from '../../config/searchConfig';

export class ResultAggregator {

    /**
     * Merge results from multiple sources, deduplicate, and rank
     */
    mergeResults(sourceResults: SearchSourceResult[]): SearchResult[] {
        const allResults: SearchResult[] = [];

        // Collect all results
        for (const source of sourceResults) {
            if (source.results && source.results.length > 0) {
                allResults.push(...source.results);
            }
        }

        // Deduplicate by URL
        const deduped = this.deduplicateByUrl(allResults);

        // Rank by relevance
        const ranked = this.rankResults(deduped);

        return ranked;
    }

    /**
     * Remove duplicate URLs, keeping the one with highest relevance
     */
    private deduplicateByUrl(results: SearchResult[]): SearchResult[] {
        const urlMap = new Map<string, SearchResult>();

        for (const result of results) {
            // Normalize URL for comparison
            const normalizedUrl = this.normalizeUrl(result.url);

            if (!urlMap.has(normalizedUrl)) {
                urlMap.set(normalizedUrl, result);
            } else {
                // Keep the one with higher relevance score
                const existing = urlMap.get(normalizedUrl)!;
                if ((result.relevanceScore || 0) > (existing.relevanceScore || 0)) {
                    urlMap.set(normalizedUrl, result);
                }
            }
        }

        return Array.from(urlMap.values());
    }

    /**
     * Normalize URL for deduplication (remove trailing slashes, www, etc)
     */
    private normalizeUrl(url: string): string {
        try {
            const parsed = new URL(url);
            // Remove www prefix
            let host = parsed.hostname.replace(/^www\./, '');
            // Remove trailing slash from pathname
            let path = parsed.pathname.replace(/\/$/, '');
            return `${host}${path}`.toLowerCase();
        } catch {
            return url.toLowerCase();
        }
    }

    /**
     * Rank results by relevance, freshness, and source quality
     */
    private rankResults(results: SearchResult[]): SearchResult[] {
        const scored = results.map(result => {
            let score = result.relevanceScore || 0.5;

            // Boost for recent content
            if (result.timestamp) {
                const ageInDays = (Date.now() - result.timestamp.getTime()) / (1000 * 60 * 60 * 24);
                if (ageInDays < 7) score += 0.2;
                else if (ageInDays < 30) score += 0.1;
            }

            // Boost for known quality sources
            const qualitySources = ['techcrunch', 'venturebeat', 'crunchbase', 'ycombinator'];
            const urlLower = result.url.toLowerCase();
            if (qualitySources.some(s => urlLower.includes(s))) {
                score += 0.15;
            }

            // Boost for funding-related keywords in title
            const fundingKeywords = ['funding', 'raises', 'raised', 'million', 'seed', 'series', 'investment'];
            const titleLower = result.title.toLowerCase();
            const keywordCount = fundingKeywords.filter(k => titleLower.includes(k)).length;
            score += keywordCount * 0.05;

            return { ...result, relevanceScore: Math.min(score, 1) };
        });

        // Sort by score descending
        return scored.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));
    }

    /**
     * Filter results that are likely to be about startup funding
     */
    filterFundingRelated(results: SearchResult[]): SearchResult[] {
        const fundingIndicators = [
            'funding', 'raises', 'raised', 'million', 'seed', 'series',
            'investment', 'investor', 'startup', 'venture', 'capital',
            'pre-seed', 'series a', 'series b', 'backed', 'announces'
        ];

        return results.filter(result => {
            const text = `${result.title} ${result.snippet}`.toLowerCase();
            return fundingIndicators.some(indicator => text.includes(indicator));
        });
    }

    /**
     * Deduplicate companies by name similarity
     */
    deduplicateCompanies(companies: CompanyData[]): CompanyData[] {
        const seen = new Map<string, CompanyData>();

        for (const company of companies) {
            const key = this.normalizeCompanyName(company.name);

            if (!seen.has(key)) {
                seen.set(key, company);
            } else {
                // Merge data from duplicate, keeping higher confidence
                const existing = seen.get(key)!;
                if (company.confidence > existing.confidence) {
                    seen.set(key, { ...existing, ...company });
                }
            }
        }

        return Array.from(seen.values());
    }

    private normalizeCompanyName(name: string): string {
        return name
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '')
            .replace(/inc|llc|ltd|corp|company|co$/g, '');
    }
}
