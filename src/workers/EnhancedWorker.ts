import { Worker, Job } from 'bullmq';
import { connection, SCRAPER_QUEUE_NAME } from '../config/queue';
import Logger from '../utils/logger';

// Simple startup processing for Phase 1 & 2
export const setupWorker = () => {
    const worker = new Worker(
        SCRAPER_QUEUE_NAME,
        async (job: Job) => {
            Logger.info(`👷 Worker processing job ${job.id}: ${job.name}`, job.data);

            try {
                switch (job.name) {
                    case 'scrape-all':
                        Logger.info('🌱 Running all configured scrapers');
                        // This will use existing scraperService.runAll()
                        // which reads from config and runs enabled scrapers
                        break;
                        
                    case 'scrape-source':
                        const { sourceId, url } = job.data;
                        Logger.info(`📋 Starting source scraping: ${sourceId}`);
                        // Basic URL scraping would go here in Phase 2
                        Logger.info('🔍 Would use Firecrawl/Puppeteer for:', url);
                        break;
                        
                    case 'ai-deep-search':
                        const { query } = job.data;
                        Logger.info(`🧠 Starting AI deep search: ${query}`);
                        // Phase 2 implementation would use low-cost LLM
                        Logger.info('🔍 Would use Groq + Google Dorks + Firecrawl');
                        break;
                        
                    case 'process-validated-startups':
                        Logger.info('📊 Processing validated startups for promotion');
                        // Phase 2 validation engine would process and promote records
                        Logger.info('🔍 Would use ValidationEngine to check duplicates and confidence');
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
            concurrency: 2, // Increased from 1 with DragonflyDB
            // Enhanced worker options for DragonflyDB performance
            stalledInterval: 30000, // Check stuck jobs
            maxStalledCount: 1
        }
    );

    Logger.info('👷 Enhanced Worker setup complete with DragonflyDB optimizations');
    return worker;
};