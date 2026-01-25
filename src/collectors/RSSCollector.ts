import { Parser } from 'rss-parser';
import Logger from '../utils/logger';

interface RSSItem {
    title?: string;
    description?: string;
    link?: string;
    pubDate?: string;
    source?: string;
}

interface ParsedStartup {
    name: string;
    description: string;
    fundingAmount?: string;
    roundType?: string;
    date: string;
    source: string;
    sourceUrl: string;
    extractedAt: Date;
    confidence: number;
}

class RSSCollector {
    private userAgent = 'Scoutly-RSS-Bot/1.0';

    constructor(private name: string, private url: string) {
        this.name = name;
        this.url = url;
    }

    async fetchAndParse(): Promise<ParsedStartup[]> {
        try {
            Logger.info(`📡 Fetching RSS feed: ${this.name}`);
            
            const response = await fetch(this.url, {
                method: 'GET',
                headers: {
                    'User-Agent': this.userAgent,
                    'Accept': 'application/rss+xml, application/xml'
                },
                signal: null,
                timeout: 15000
            });

            if (!response.ok) {
                throw new Error(`RSS fetch failed for ${this.name}: ${response.status} ${response.statusText}`);
            }

            const xmlData = await response.text();
            const parser = new Parser();
            const feed = await parser.parseString(xmlData);

            if (!feed || !feed.items) {
                throw new Error(`No valid RSS data found in ${this.name}`);
            }

            const startups: ParsedStartup[] = [];
            
            for (const item of feed.items) {
                const startup = this.extractStartupData(item);
                if (startup) {
                    startups.push(startup);
                }
            }

            Logger.info(`✅ Parsed ${startups.length} potential startups from ${this.name}`);
            return startups;
            
        } catch (error) {
            Logger.error(`❌ RSS parsing failed for ${this.name}:`, error);
            throw error;
        }
    }

    private extractStartupData(item: RSSItem): ParsedStartup | null {
        try {
            const description = item.description || '';
            const title = item.title || '';
            const pubDate = item.pubDate || '';
            const link = item.link || '';
            const sourceUrl = item.source?.url || this.url;

            // Extract funding information using keywords
            const fundingInfo = this.extractFundingInfo(description + ' ' + title);
            
            if (!fundingInfo.fundingAmount) {
                return null; // Not a funding announcement
            }

            return {
                name: fundingInfo.name || this.extractCompanyName(title),
                description: description.substring(0, 500), // Limit description length
                fundingAmount: fundingInfo.fundingAmount,
                roundType: fundingInfo.roundType,
                date: pubDate || new Date().toISOString().split('T')[0],
                source: this.name,
                sourceUrl,
                extractedAt: new Date(),
                confidence: this.calculateConfidence(description, title),
                industry: this.extractIndustry(title, description),
                canonicalName: this.extractCompanyName(fundingInfo.name)
            };
            
        } catch (error) {
            Logger.error(`❌ Failed to extract startup data:`, error);
            return null;
        }
    }

    private extractFundingInfo(text: string): {
        name?: string;
        fundingAmount?: string;
        roundType?: string;
    } {
        const keywords = [
            'raised', 'secured', 'funding', 'investment', 'financing', 'seed', 'pre-seed', 'series a', 'series b', 'venture',
            'round', 'series', 'investment'
        ];

        const amountPattern = /\$([0-9.]+(?:,[0-9]{3})?\s*[0-9])/gi;
        const amountMatch = text.match(amountPattern);

        let name = '';
        let roundType = '';

        // Extract round type
        for (const keyword of keywords) {
            const lowerText = text.toLowerCase();
            if (lowerText.includes(keyword)) {
                roundType = keyword.charAt(0).toUpperCase() + keyword.slice(1);
                break;
            }
        }

        // Extract company name
        for (const keyword of ['company', 'startup', 'announces']) {
            const match = text.match(new RegExp(`\\b${keyword}\\s+(\\w+\\s)+\\w*`, 'i'));
            if (match) {
                name = match[2];
                break;
            }
        }

        return {
            name: name || this.extractCompanyName(text),
            fundingAmount: amountMatch ? amountMatch[1] : undefined,
            roundType: roundType || 'Unknown'
        };
    }

    private extractCompanyName(text: string): string {
        // Simple extraction - get the first capitalised words that look like a company
        const words = text.split(/\s+/);
        const companyWords = words.filter(word => 
            /^[A-Z]/.test(word) && 
            word.length >= 2 &&
            !['The', 'A', 'New'].includes(word) &&
            !['and', 'or', 'but', 'with', 'for', 'in', 'on', 'at', 'to', 'from', 'by'].includes(word)
        );

        return companyWords[0] || text;
    }

    private extractIndustry(title: string, description: string): string {
        const text = (title + ' ' + description).toLowerCase();
        
        const industryMap: Record<string, string> = {
            'ai': 'artificial intelligence',
            'fintech': 'financial technology',
            'healthtech': 'healthcare',
            'biotech': 'biotechnology',
            'saas': 'software as a service',
            'ecommerce': 'e-commerce',
            'robotics': 'robotics',
            'climate': 'climate tech',
            'crypto': 'cryptocurrency',
            'gaming': 'gaming'
        };

        for (const [industry, keywords] of Object.entries(industryMap)) {
            if (keywords.some(keyword => text.includes(keyword))) {
                return industry;
            }
        }

        return 'technology'; // Default
    }

    private calculateConfidence(description: string, title: string): number {
        let confidence = 0.3; // Base confidence for RSS

        // Boost for authoritative sources
        if (this.name.includes('techcrunch')) confidence += 0.3;
        if (this.name.includes('venturebeat')) confidence += 0.25;
        if (this.name.includes('reuters')) confidence += 0.4;

        // Boost for specific funding keywords
        if (description.toLowerCase().includes('series a')) confidence += 0.2;
        if (description.toLowerCase().includes('series b')) confidence += 0.2;
        if (description.toLowerCase().includes('venture capital')) confidence += 0.2;

        // Boost for clear title structure
        if (title.includes('raises')) confidence += 0.1;

        return Math.min(confidence, 1.0);
    }
}

export default RSSCollector;