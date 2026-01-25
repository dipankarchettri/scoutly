// Search interfaces and types

export interface SearchResult {
    title: string;
    url: string;
    snippet: string;
    source: string;
    timestamp?: Date;
    relevanceScore?: number;
}

export interface CompanyData {
    id?: string;
    name: string;
    description: string;
    website?: string;
    fundingAmount?: string;
    fundingAmountNum?: number;
    roundType?: string;
    dateAnnounced?: string;
    dateAnnouncedISO?: Date;
    location?: string;
    industry?: string;
    founders?: string[];
    investors?: string[];
    tags?: string[];
    source: string;
    sourceUrl: string;
    confidence: number;
}

export interface SearchSourceResult {
    source: string;
    results: SearchResult[];
    error?: string;
    latencyMs: number;
}

export interface AggregatedSearchResult {
    companies: CompanyData[];
    pagination: {
        page: number;
        totalPages: number;
        totalCompanies: number;
        perPage: number;
    };
    meta: {
        query: string;
        sources: string[];
        successfulSources: string[];
        failedSources: string[];
        totalLatencyMs: number;
    };
}

export interface ISearchSource {
    name: string;
    enabled: boolean;
    priority: number;
    search(query: string): Promise<SearchSourceResult>;
}

export interface CreditInfo {
    tier: 'free' | 'paid';
    total: number;
    used: number;
    remaining: number;
    pagesPerSearch: number;
    companiesPerPage: number;
}
