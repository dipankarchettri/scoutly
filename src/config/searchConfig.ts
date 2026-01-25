// Search configuration for pricing tiers and sources

export const PRICING_TIERS = {
    free: {
        name: 'Free',
        price: 0,
        credits: 2,
        pagesPerSearch: 2,
        companiesPerPage: 10,
        maxCompaniesPerSearch: 20,
        sources: ['searxng', 'bravesearch', 'crawl4ai'] as string[]
    },
    paid: {
        name: 'Pro',
        price: 20,
        credits: 50,
        pagesPerSearch: 50,
        companiesPerPage: 10,
        maxCompaniesPerSearch: 50,
        sources: ['searxng', 'bravesearch', 'crawl4ai', 'exa', 'tavily'] as string[]
    }
};

export type PricingTier = keyof typeof PRICING_TIERS;

// Free source configurations
export const FREE_SOURCES = {
    searxng: {
        enabled: true,
        name: 'SearxNG',
        baseUrl: process.env.SEARXNG_URL || 'http://localhost:8080',
        timeout: 15000,
        priority: 1
    },
    brave: {
        enabled: !!process.env.BRAVE_API_KEY,
        name: 'Brave Search',
        apiKey: process.env.BRAVE_API_KEY || '',
        baseUrl: 'https://api.search.brave.com/res/v1',
        timeout: 10000,
        freeLimit: 5000,
        priority: 2
    },
    crawl4ai: {
        enabled: true,
        name: 'Crawl4AI',
        timeout: 30000,
        concurrent: 3,
        priority: 3
    }
} as const;

// Paid source configurations (placeholders - enable when API keys added)
export const PAID_SOURCES = {
    exa: {
        enabled: false,
        name: 'EXA',
        apiKey: process.env.EXA_API_KEY || '',
        baseUrl: 'https://api.exa.ai',
        timeout: 15000,
        priority: 1
    },
    tavily: {
        enabled: false,
        name: 'Tavily',
        apiKey: process.env.TAVILY_API_KEY || '',
        baseUrl: 'https://api.tavily.com',
        timeout: 15000,
        priority: 2
    },
    perplexity: {
        enabled: false,
        name: 'Perplexity',
        apiKey: process.env.PERPLEXITY_API_KEY || '',
        baseUrl: 'https://api.perplexity.ai',
        timeout: 15000,
        priority: 3
    }
} as const;

// Search configuration
export const SEARCH_CONFIG = {
    maxResultsPerSource: 30,
    deduplicationThreshold: 0.8,
    minConfidenceScore: 0.3,
    maxParallelRequests: 5,
    cacheExpiryMs: 1000 * 60 * 60, // 1 hour
    searchPatterns: [
        '{query} startup funding 2025 2026',
        '{query} raised seed series funding',
        'site:techcrunch.com {query} funding',
        'site:venturebeat.com {query} raised',
        '{query} pre-seed seed series a funding announcement'
    ]
} as const;
