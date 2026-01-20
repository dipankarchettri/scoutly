
import { Queue } from 'bullmq';
import Redis from 'ioredis';
import Logger from '../utils/logger';

const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379', 10);

const connection = new Redis({
    host: REDIS_HOST,
    port: REDIS_PORT,
    maxRetriesPerRequest: null, // Critical for BullMQ
});

connection.on('error', (err) => {
    Logger.error('Redis connection error:', err);
});

connection.on('connect', () => {
    Logger.info('✅ Connected to Redis');
});

export const SCRAPER_QUEUE_NAME = 'scraper-queue';

export const scrapeQueue = new Queue(SCRAPER_QUEUE_NAME, {
    connection: connection as any,
    defaultJobOptions: {
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 5000,
        },
        removeOnComplete: true,
    },
});

export { connection };
