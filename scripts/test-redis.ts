import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  connectTimeout: 5000,
});

console.log('Connecting to Redis at', process.env.REDIS_HOST, process.env.REDIS_PORT);

redis.ping().then((result) => {
  console.log('Redis Ping Result:', result);
  redis.disconnect();
}).catch((err) => {
  console.error('Redis Error:', err);
  redis.disconnect();
});
