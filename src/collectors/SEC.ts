import mongoose from 'mongoose';
import Logger from '../utils/logger';

interface SECFiling {
    companyName: string;
    filingType: string;
    filingDate: string;
    amount?: string;
    investors?: string[];
    description?: string;
    url: string;
}

interface SECFilingResponse {
    filings: SECFiling[];
    total: {
        value: number;
        format: string;
    date?: string;
    pages?: number;
    nextPage?: string;
    }
}

class SECCollector {
    private baseUrl = 'https://data.sec.gov/submissions/';
    private apiKey: string | null = null;
    
    constructor() {
        this.apiKey = process.env.SEC_API_KEY || null;
        if (!this.apiKey) {
            // SEC API doesn't require an API key for public data
            Logger.info('🔍 SEC API key not configured, using public access');
        }
    }

    async fetchFormDFilings(ticker?: string, company?: string, date?: string): Promise<SECFiling[]> {
        try {
            const currentDate = new Date().toISOString().split('T')[0];
            
            let url = `${this.baseUrl}search.json`;
            const params = new URLSearchParams();
            
            if (ticker) {
                params.append('tickers', ticker.toUpperCase());
            }
            
            if (company) {
                params.append('entityNames', company);
            }
            
            if (date) {
                params.append('filingDate', date);
            }
            
            // Filter for recent Form D filings
            params.append('forms', 'D');
            params.append('startDate', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
            params.append('endDate', currentDate);
            params.append('page', '1');
            params.append('per_page', '100');
            params.append('hideFilings', 'true'); // Hide older forms like 424B
            
            url += `?${params.toString()}`;
            
            Logger.info(`📋 Fetching SEC Form D filings: ${url}`);
            
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'User-Agent': 'Scoutly-SEC-Bot/1.0',
                    'Accept': 'application/json'
                },
                signal: null
            });
            
            if (!response.ok) {
                throw new Error(`SEC API error: ${response.status} ${response.statusText}`);
            }
            
            const data = await response.json() as SECFilingResponse;
            
            // Extract funding information from filings
            const filings = data.filings
                .filter((filing: SECFiling) => {
                    return filing.form === 'D' && (
                        filing.description?.toLowerCase().includes('securities') ||
                        filing.description?.toLowerCase().includes('financing') ||
                        filing.description?.toLowerCase().includes('offering') ||
                        filing.description?.toLowerCase().includes('investment')
                    );
                })
                .map((filing: SECFiling) => {
                    return {
                        companyName: filing.companyName || this.extractCompanyFromDocument(filing),
                        filingType: filing.filingType,
                        filingDate: filing.filingDate,
                        amount: this.extractFundingAmount(filing.description),
                        investors: this.extractInvestors(filing.description),
                        description: filing.description,
                        url: `https://www.sec.gov/Archives/edgar/data/${filing.accessionNumber!}/index.htm`,
                        sourceDate: filing.filingDate
                    };
                });
            
            Logger.info(`✅ Found ${filings.length} Form D filings`);
            return filings;
            
        } catch (error) {
            Logger.error('❌ SEC fetch failed:', error);
            throw error;
        }
    }

    private extractCompanyFromDocument(filing: SECFiling): string {
        // Simple extraction - look for company name in description
        const match = filing.description?.match(/company name:\s*([^\n]+)/i);
        return match ? match[1].trim() : filing.companyName || '';
    }

    private extractFundingAmount(description: string): string {
        // Look for funding amounts in SEC filings
        const amountRegex = /\$([0-9,]+(?:,[0-9]{3})?\s*[0-9])/gi;
        const match = description?.match(amountRegex);
        return match ? match[1] : undefined;
    }

    private extractInvestors(description: string): string[] {
        // Simple extraction of investor names from description
        const investors: string[] = [];
        
        // Look for common investor patterns
        const patterns = [
            /([^a-z0-9])([^a-z0-9\s]+)/g,
            /(?:led by|underwriters?:?s*([^\n]+)/gi,
            /(?:investment by|managed by|series [a-z]):?s*([^\n]+)/gi
        ];
        
        for (const pattern of patterns) {
            const matches = description?.match(pattern);
            if (matches && matches[1]) {
                // Clean up the investor names
                const investorList = matches[1]
                    .split(/,\s*(?:and|&)?\s*/g)
                    .map(inv => inv.trim())
                    .filter(inv => inv.length > 2) // Filter out single letters
                    .slice(0, 10); // Limit to 10 investors
                
                investors.push(...investorList);
            }
        }
        
        return investors;
    }

    async getCompanyByCIK(cik: string): Promise<SECFiling[]> {
        try {
            const url = `${this.baseUrl}company/CIK${cik}.json`;
            
            Logger.info(`📋 Fetching company info for CIK: ${cik}`);
            
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'User-Agent': 'Scoutly-SEC-Bot/1.0',
                    'Accept': 'application/json'
                },
                signal: null
            });
            
            if (!response.ok) {
                throw new Error(`SEC company info error: ${response.status} ${response.statusText}`);
            }
            
            const data = await response.json();
            
            // Get all recent Form D filings
            const filings = [];
            if (data.recentFilings) {
                for (const filing of data.recentFilings) {
                    if (filing.form === 'D') {
                        filings.push({
                            companyName: data.entityName,
                            filingType: filing.form,
                            filingDate: filing.filingDate,
                            amount: this.extractFundingAmount(filing.description),
                            description: filing.description,
                            url: filing.links?.filingDetails?.href || '',
                            sourceDate: filing.filingDate
                        });
                    }
                }
            }
            
            Logger.info(`✅ Found ${filings.length} recent filings for ${data.entityName}`);
            return filings;
            
        } catch (error) {
            Logger.error('❌ SEC CIK lookup failed:', error);
            throw error;
        }
    }
}

export default SECCollector;