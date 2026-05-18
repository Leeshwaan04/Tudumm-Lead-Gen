import Redis from 'ioredis';
import pino from 'pino';

const logger = pino({ name: 'usage-metering' });

export class UsageMetering {
  private redis: Redis;

  constructor() {
    this.redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
  }

  async recordUsage(userId: string, bytesSent: number, bytesReceived: number) {
    const key = `usage:${userId}:${new Date().toISOString().slice(0, 10)}`;
    try {
      await this.redis.hincrby(key, 'bytesSent', bytesSent);
      await this.redis.hincrby(key, 'bytesReceived', bytesReceived);
      await this.redis.hincrby(key, 'requestCount', 1);
      await this.redis.expire(key, 60 * 60 * 24 * 30); // 30 days
    } catch (err) {
      logger.error({ err, userId }, 'Failed to record usage');
    }
  }

  async getUsage(userId: string) {
    const key = `usage:${userId}:${new Date().toISOString().slice(0, 10)}`;
    return await this.redis.hgetall(key);
  }
}
