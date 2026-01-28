import { Worker, Job } from 'bullmq';
import { connection, SCRAPER_QUEUE_NAME } from '../config/queue';
import Logger from '../utils/logger';

// Simplified worker for immediate functionality
export const setupWorker = () => {
    const worker = new Worker(
        SCRAPER_QUEUE_NAME,
        async (job: Job) => {
            Logger.info(`👷 Worker processing job ${job.id}: ${job.name}`, job.data);

            try {
                switch (job.name) {
                    case 'scrape-all':
                        Logger.info('🌱 Running existing scrapers');
                        // Use existing scraper service for now
                        // Use existing scraper service for now
                        const { ScraperService } = await import('../services/scraperService');
                        const service = new ScraperService();
                        await service.runAll();
                        break;

                    case 'process-validated-startups':
                        Logger.info('🔍 Processing validated startups');
                        // Validation will be integrated in Phase 2.2
                        Logger.info('📊 Would use ValidationEngine');
                        break;

                    case 'ai-deep-search':
                        const { query } = job.data;
                        Logger.info(`🧠 AI search for: ${query}`);
                        // AI search will be implemented in Phase 2.4
                        Logger.info('🔍 Would use AIDeepSearchService');
                        break;

                    case 'enrich-startup':
                        const { startupId } = job.data;
                        Logger.info(`✨ Processing enrichment for: ${startupId}`);
                        const { EnrichmentService } = await import('../services/enrichmentService');
                        await EnrichmentService.enrichStartup(startupId);
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
            concurrency: 2, // Optimized for DragonflyDB
            stalledInterval: 30000,
            maxStalledCount: 1
        }
    );

    Logger.info('👷 Worker ready for Phase 1+2 integration');
    return worker;
};