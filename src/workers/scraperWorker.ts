
import { Worker, Job } from 'bullmq';
import { Pro } from '@bullmq/pro';
import { connection, SCRAPER_QUEUE_NAME } from '../config/queue';
import { ScraperService } from '../services/scraperService';
import Logger from '../utils/logger';

const scraperService = new ScraperService();

export const setupWorker = () => {
    // Use BullMQ Pro for advanced job grouping capabilities
    const worker = new Pro.Worker(
        SCRAPER_QUEUE_NAME,
        async (job: Job) => {
            Logger.info(`👷 Worker processing job ${job.id}: ${job.name}`, job.data);

            try {
                if (job.name === 'scrape-all') {
                    await scraperService.runAll();
                } else if (job.name === 'scout-url') {
                    const { url } = job.data;
                    if (url) {
                        await scraperService.scoutUrl(url);
                    }
                }
                Logger.info(`✅ Job ${job.id} completed`);
            } catch (error) {
                Logger.error(`❌ Job ${job.id} failed`, error);
                throw error;
            }
        },
        {
            connection: connection as any,
            concurrency: 2, // Increased concurrency with DragonflyDB's better performance
            // BullMQ Pro features
            group: {
                // Enable job grouping for related scraping jobs
                // Prevents race conditions when scraping same domain
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
