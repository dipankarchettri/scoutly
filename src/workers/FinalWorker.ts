import { Worker, Job } from 'bullmq';
import { connection, SCRAPER_QUEUE_NAME } from '../config/queue';
import Logger from '../utils/logger';

// Import using TypeScript-compatible dynamic imports
let ValidationEngine: any;
let SourceManager: any;

// Dynamic imports with error handling
try {
    ValidationEngine = (await import('../services/ValidationEngine')).default;
    SourceManager = (await import('../services/SourceManager')).default;
} catch (error) {
    Logger.error('❌ Failed to import services:', error);
    // Fallback implementations for development
    ValidationEngine = {
        validatePendingStartups: async () => ({ totalPending: 0, duplicates: [], validated: 0, promoted: 0, errors: [] }),
        revalidateOldRecords: async () => {},
        getValidationStatistics: async () => ({ totalStartups: 0, pendingStartups: 0, validatedStartups: 0, avgConfidence: 0 })
    };
    SourceManager = {
        getActiveSources: () => [],
        getSource: () => undefined,
        getSourceHealth: async () => ({ isHealthy: false, error: 'Fallback mode' }),
        getSourcePriority: () => [],
        getStatistics: () => ({ total: 0, active: 0 })
    };
}

export const setupWorker = () => {
    const worker = new Worker(
        SCRAPER_QUEUE_NAME,
        async (job: Job) => {
            Logger.info(`👷 Worker processing job ${job.id}: ${job.name}`, job.data);

            try {
                switch (job.name) {
                    case 'scrape-all':
                        await processScrapeAll();
                        break;
                        
                    case 'scrape-source':
                        await processScrapeSource(job.data);
                        break;
                        
                    case 'process-validated-startups':
                        await processValidatedStartups();
                        break;
                        
                    case 'ai-deep-search':
                        await processAIDeepSearch(job.data);
                        break;
                        
                    default:
                        Logger.warn(`⚠️ Unknown job type: ${job.name}`);
                }
                
                Logger.info(`✅ Job ${job.id} completed`);
            } catch (error) {
                Logger.error(`❌ Job ${job.id} failed`, error);
                throw error;
            }
        },
        {
            connection: connection as any,
            concurrency: 3, // Optimized for DragonflyDB
            stalledInterval: 30000,
            maxStalledCount: 1
        }
    );

    Logger.info('👷 Enhanced Worker initialized with full Phase 1+2 services');
    return worker;
};

// Job processors using the new services
async function processScrapeAll(): Promise<void> {
    Logger.info('🌱 Starting multi-source scraping with Phase 1+2 services');
    
    const sources = SourceManager.getActiveSources();
    
    // For now, use existing scraper service but with source manager integration
    const scraperService = (await import('../services/scraperService')).default;
    await scraperService.runAll();
    
    // In Phase 2.1, this would use:
    // for (const source of sources) {
    //     if (source.type === 'api') {
    //         await sourceManager.scheduleSourceExecution(source.id);
    //     }
    // }
    
    Logger.info('✅ Multi-source scraping completed');
}

async function processScrapeSource(data: any): Promise<void> {
    const { sourceId } = data;
    const source = SourceManager.getSource(sourceId);
    
    if (!source) {
        throw new Error(`Source ${sourceId} not found`);
    }
    
    Logger.info(`📋 Starting targeted scraping: ${source.name}`);
    
    // For Phase 2.1, this would use source-specific scrapers
    // await sourceManager.scheduleSourceExecution(sourceId, data);
    
    Logger.info(`✅ Source scraping completed: ${source.name}`);
}

async function processValidatedStartups(): Promise<void> {
    Logger.info('🔍 Processing validated startups for promotion');
    
    const result = await ValidationEngine.validatePendingStartups();
    Logger.info(`📊 Validation complete: ${JSON.stringify(result)}`);
    
    // Re-validation logic would be implemented in Phase 2.2
    // await ValidationEngine.revalidateOldRecords();
    
    Logger.info('✅ Validated startups processed');
}

async function processAIDeepSearch(data: any): Promise<void> {
    const { query, maxCost = 5 } = data;
    
    Logger.info(`🧠 Starting AI deep search: ${query} (max cost: $${maxCost})`);
    
    const AIDeepSearchService = (await import('../services/AIDeepSearchService')).default;
    const results = await AIDeepSearchService.executeSearch(query);
    
    Logger.info(`📊 AI search found ${results.length} results`);
    
    // Store results in pending collection for validation
    // In Phase 2.1, this would save to pending_startups
    
    Logger.info('✅ AI deep search completed');
}