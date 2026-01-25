import { Startup, Timeframe, FilterConfig, SearchResponse } from '../../types';

const API_BASE_URL = 'http://localhost:5000/api';

export async function fetchStartups(timeframe: Timeframe, filters: FilterConfig): Promise<Startup[]> {
    const params = new URLSearchParams();
    params.append('timeframe', timeframe);
    if (filters.domain) params.append('domain', filters.domain);
    if (filters.sort) params.append('sort', filters.sort);

    const response = await fetch(`${API_BASE_URL}/startups?${params.toString()}`);
    if (!response.ok) {
        throw new Error('Failed to fetch startups');
    }
    return response.json();
}

export async function searchStartups(
    query: string,
    page: number = 1,
    tier: string = 'free',
    apiKey?: string
): Promise<SearchResponse> {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
    };

    if (apiKey) {
        headers['x-llm-api-key'] = apiKey;
    }

    const response = await fetch(`${API_BASE_URL}/search`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ query, page, tier }),
    });

    if (!response.ok) {
        throw new Error('Search failed');
    }
    return response.json();
}

export async function fetchStats() {
    const response = await fetch(`${API_BASE_URL}/stats`);
    if (!response.ok) throw new Error('Failed to fetch stats');
    return response.json();
}
