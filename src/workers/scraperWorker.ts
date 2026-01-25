
import { Worker, Job } from 'bullmq';
import { Worker, Job } from 'bullmq';
import { connection, SCRAPER_QUEUE_NAME } from '../config/queue';
import Logger from '../utils/logger';

export const setupWorker = () => {
    // Enhanced BullMQ worker with intelligent job distribution
    const worker = new Worker(
        SCRAPER_QUEUE_NAME,
        async (job: Job) => {
            Logger.info(`👷 Worker processing job ${job.id}: ${job.name}`, job.data);

            try {
                if (job.name === 'process-validated-startups') {
                    // Process validated startups and promote high-confidence records
                    const validationEngine = (await import('../services/ValidationEngine')).default;
                    const result = await validationEngine.validatePendingStartups();
                    Logger.info(`📊 Validation result: ${JSON.stringify(result)}`);
                    
                    // Schedule re-validation for low-confidence records
                    await validationEngine.revalidateOldRecords();
                    
                    Logger.info(`✅ Processed ${result.validated} validated startups`);
                    
                } else if (job.name === 'scrape-all') {
                    // Intelligent multi-source scraping
                    const sources = sourceManager.getActiveSources();
                    
                    for (const source of sources) {
                        if (source.isActive) {
                            Logger.info(`📋 Starting ${source.name} scraping`);
                            await scraperService.runSource(source.id);
                        }
                    }
                    
                } else if (job.name === 'scrape-source') {
                    // Targeted source scraping
                    const { sourceId } = job.data;
                    const source = sourceManager.getSource(sourceId);
                    
                    if (source) {
                        Logger.info(`📋 Starting ${source.name} scraping`);
                        await scraperService.runSource(sourceId);
                    } else {
                        Logger.error(`Source ${sourceId} not found or inactive`);
                    }
                    
                } else if (job.name === 'ai-deep-search') {
                    // AI-powered deep search for hard-to-find companies
                    const { query, maxCost = 5 } = job.data;
                    Logger.info(`🧠 Starting AI deep search for: ${query} (max cost: $${maxCost})`);
                    
                    // This will integrate with low-cost LLM in Phase 2.4
                    Logger.info('🔍 AI deep search not yet implemented - would use Groq + Firecrawl');
                    
                } else {
                    Logger.warn(`Unknown job type: ${job.name}`);
                }
                
                Logger.info(`✅ Job ${job.id} completed`);
            } catch (error) {
                Logger.error(`❌ Job ${job.id} failed`, error);
                throw error;
            }
        },
        {
            connection: connection as any,
            concurrency: 3, // Increased for DragonflyDB + job distribution
            // Enhanced worker options
            stalledInterval: 30000,
            maxStalledCount: 1,
            // Smart job routing based on type
            processJob: async (job: Job) => {
                const { name, data } = job;
                
                // Route to appropriate handler
                switch (name) {
                    case 'scrape-all':
                    case 'scrape-source':
                        return await scraperService.runSource(data.sourceId);
                    
                    case 'process-validated-startups':
                        const validationEngine = (await import('../services/ValidationEngine')).default;
                        return await validationEngine.validatePendingStartups();
                    
                    case 'ai-deep-search':
                        // Will be implemented in Phase 2.4
                        throw new Error('AI deep search not yet implemented');
                    
                    default:
                        Logger.warn(`Unknown job type: ${name}`);
                        return null;
                }
            }
        }
    );

    worker.on('completed', (job) => {
        Logger.debug(`Job ${job.id} has completed!`);
    });

    worker.on('failed', (job, err) => {
        Logger.error(`Job ${job?.id} has failed with ${err.message}`);
    });

    Logger.info(`👷 Worker started for queue: ${SCRAPER_QUEUE_NAME}`);
    return worker;
};
