import { DataSource } from '../models/DataIngestion';
import mongoose from 'mongoose';

interface SourceConfig {
    id: string;
    name: string;
    type: 'api' | 'rss' | 'scraper' | 'government';
    url?: string;
    cost: 'free' | 'freemium' | 'paid' | 'usage_based';
    reliability: number; // 0-1 scale
    isActive: boolean;
    schedule?: string; // cron expression
    lastSuccess?: Date;
    settings?: Record<string, any>;
}

class SourceManager {
    private sources: Map<string, SourceConfig> = new Map();

    constructor() {
        this.initializeSources();
    }

    private initializeSources(): void {
        // Tier 1: Free & High-Trust Sources
        this.sources.set('sec-edgar', {
            id: 'sec-edgar',
            name: 'SEC EDGAR Form D API',
            type: 'api',
            url: 'https://data.sec.gov/submissions/',
            cost: 'free',
            reliability: 0.95, // Official government data
            isActive: true,
            schedule: '0 2 * * *', // Every 2 hours
            settings: {
                apiKey: null, // No API key needed
                rateLimit: 10, // requests per second
                timeout: 30000 // 30 seconds
            }
        });

        this.sources.set('techcrunch-rss', {
            id: 'techcrunch-rss',
            name: 'TechCrunch RSS Feed',
            type: 'rss',
            url: 'https://techcrunch.com/feed/',
            cost: 'free',
            reliability: 0.85, // Journalism, occasional errors
            isActive: true,
            schedule: '0 */1 * * *', // Every hour
            settings: {
                timeout: 10000,
                retries: 3,
                headers: {
                    'User-Agent': 'Scoutly-Bot/1.0'
                }
            }
        });

        this.sources.set('signal-nfx', {
            id: 'signal-nfx',
            name: 'Signal by NFX',
            type: 'api',
            url: 'https://api.signalnfx.com/v1/',
            cost: 'free',
            reliability: 0.75, // Community-sourced, less reliable
            isActive: true,
            schedule: '0 3 * * *', // Every 3 hours
            settings: {
                rateLimit: 5,
                timeout: 15000
            }
        });

        this.sources.set('ycombinator-api', {
            id: 'ycombinator-api',
            name: 'Y Combinator API',
            type: 'api',
            url: 'https://www.ycombinator.com/api/v1/',
            cost: 'usage_based', // Free tier, pay-per-call
            reliability: 0.90, // High quality but usage limits
            isActive: true,
            schedule: '0 */6 * * *', // Every 6 hours
            settings: {
                rateLimit: 100,
                tier: 'free'
            }
        });

        // Tier 2: Job Boards & Social Signals
        this.sources.set('hackernews-api', {
            id: 'hackernews-api',
            name: 'Hacker News API',
            type: 'api',
            url: 'http://hn.algolia.com/api/v1/',
            cost: 'free',
            reliability: 0.80, // User-submitted content
            isActive: true,
            schedule: '*/15 * * *', // Every 15 minutes
            settings: {
                rateLimit: 100
            }
        });

        this.sources.set('producthunt-api', {
            id: 'producthunt-api',
            name: 'Product Hunt API',
            type: 'api',
            url: 'https://api.producthunt.com/v2/api/',
            cost: 'freemium', // Limited free tier
            reliability: 0.82, // Community-driven
            isActive: false, // Disabled for cost savings
            schedule: '0 */2 * * *',
            settings: {
                rateLimit: 50,
                tier: 'free'
            }
        });

        // Tier 3: AI-Powered Deep Search (Emergency Use)
        this.sources.set('google-dorks', {
            id: 'google-dorks',
            name: 'AI Google Dorks',
            type: 'scraper',
            url: null, // Generated dynamically
            cost: 'usage_based', // LLM API costs
            reliability: 0.60, // Varies by search quality
            isActive: false, // Disabled by default
            schedule: 'on-demand', // Only when user searches
            settings: {
                llmProvider: 'groq', // Low-cost LLM
                maxDorks: 10,
                timeout: 30000
            }
        });
    }

    public getActiveSources(): SourceConfig[] {
        return Array.from(this.sources.values()).filter(source => source.isActive);
    }

    public getSource(id: string): SourceConfig | undefined {
        return this.sources.get(id);
    }

    public async updateSourceStatus(id: string, status: Partial<SourceConfig>): Promise<void> {
        const source = this.sources.get(id);
        if (source) {
            Object.assign(source, status);
            
            // Update in database
            await DataSource.findOneAndUpdate(
                { id },
                { 
                    $set: status,
                    lastSuccess: status.isActive ? new Date() : undefined,
                    lastError: status.isActive ? undefined : 'Deactivated by system'
                },
                { upsert: true }
            );
        }
    }

    public async getSourceHealth(id: string): Promise<{
        isHealthy: boolean;
        responseTime?: number;
        error?: string;
    }> {
        const source = this.sources.get(id);
        if (!source || !source.isActive) {
            return { isHealthy: false, error: 'Source not found or inactive' };
        }

        const startTime = Date.now();
        try {
            // Test source accessibility
            if (source.type === 'api') {
                const response = await fetch(source.url + 'health', {
                    method: 'GET',
                    signal: undefined,
                    timeout: 5000
                });
                const isHealthy = response.ok;
                const responseTime = Date.now() - startTime;
                
                // Update source health
                await this.updateSourceStatus(source.id, {
                    lastSuccess: isHealthy ? new Date() : undefined,
                    lastError: isHealthy ? undefined : 'Health check failed'
                });
                
                return { isHealthy, responseTime };
            }
            
            return { isHealthy: true };
        } catch (error) {
            const responseTime = Date.now() - startTime;
            await this.updateSourceStatus(source.id, {
                lastSuccess: undefined,
                lastError: error.message
            });
            
            return { isHealthy: false, responseTime, error: error.message };
        }
    }

    public async getSourcePriority(query: string): Promise<SourceConfig[]> {
        // Return sources ordered by reliability and cost-effectiveness
        const activeSources = this.getActiveSources();
        
        // Simple prioritization: prefer free, high-reliability sources
        return activeSources
            .filter(source => source.cost === 'free' || source.cost === 'usage_based')
            .sort((a, b) => {
                // Primary: reliability
                if (b.reliability !== a.reliability) return b.reliability - a.reliability;
                // Secondary: cost (free is better)
                if (b.reliability === a.reliability) return b.cost === 'free' ? -1 : 1;
                return 0; // tie
            })
            .slice(0, 3); // Top 3 sources
    }

    public getCostOptimizedSources(maxCost: number): SourceConfig[] {
        return this.getActiveSources()
            .filter(source => {
                switch (source.cost) {
                    case 'free': return true;
                    case 'freemium': return true;
                    case 'usage_based': return source.settings?.tier === 'free';
                    case 'paid': return false;
                    default: return false;
                }
            })
            .filter(source => {
                // Exclude expensive sources unless necessary
                if (source.cost === 'paid') return false;
                if (source.reliability < 0.7) return false;
                return true;
            })
            .slice(0, maxCost);
    }

    public async scheduleSourceExecution(id: string, data: any = {}): Promise<void> {
        const source = this.sources.get(id);
        if (!source || !source.isActive) {
            throw new Error(`Source ${id} not available`);
        }

        // Add to job queue with source-specific settings
        const jobData = {
            sourceId: id,
            sourceName: source.name,
            sourceType: source.type,
            sourceUrl: source.url,
            settings: source.settings,
            data,
            scheduledAt: new Date()
        };

        // This will be picked up by the worker pool
        console.log(`📋 Scheduling job for ${source.name} with settings:`, source.settings);
        
        // In real implementation, this would add to BullMQ:
        // await scrapeQueue.add(`process-${id}`, jobData, {
        //     priority: this.calculatePriority(source),
        //     delay: 0,
        //     attempts: 3
        // });
        
        console.log(`✅ Job scheduled for ${source.name}`);
    }

    private calculatePriority(source: SourceConfig): number {
        // Higher priority for more reliable and free sources
        let priority = 5; // default
        
        if (source.cost === 'free') priority += 10;
        if (source.reliability > 0.8) priority += 5;
        if (source.type === 'government') priority += 10; // Official data
        
        return 100 - priority; // Lower number = higher priority
    }

    public async initialize(): Promise<void> {
        // Initialize sources on startup
        const promises = Array.from(this.sources.values()).map(source => 
            this.updateSourceStatus(source.id, { isActive: source.isActive })
        );
        
        await Promise.all(promises);
        console.log('✅ Source Manager initialized with', this.sources.size, 'sources');
    }
}
}

export default SourceManager;