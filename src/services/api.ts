import { Startup, Timeframe, FilterConfig } from '../../types';

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

export async function fetchStats() {
    const response = await fetch(`${API_BASE_URL}/stats`);
    if (!response.ok) throw new Error('Failed to fetch stats');
    return response.json();
}
