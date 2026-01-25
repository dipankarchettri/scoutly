
import { Queue } from 'bullmq';
import Redis from 'ioredis';
import Logger from '../utils/logger';

// Use Redis/DragonflyDB based on availability
const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379', 10);
const CACHE_PROVIDER = process.env.CACHE_PROVIDER || 'redis';

// Redis/DragonflyDB compatible connection with optimizations
const connection = new Redis({
    host: REDIS_HOST,
    port: REDIS_PORT,
    maxRetriesPerRequest: null, // Critical for BullMQ
    // Universal optimizations (work with both Redis and DragonflyDB)
    enableAutoPipelining: true, // Better throughput
    lazyConnect: true, // Faster startup
    // Performance tuning
    connectTimeout: 30000,
    commandTimeout: 5000,
});

connection.on('error', (err) => {
    Logger.error('DragonflyDB connection error:', err);
});

connection.on('connect', () => {
    Logger.info('✅ Connected to DragonflyDB (Redis-compatible)');
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
