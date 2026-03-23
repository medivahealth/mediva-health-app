import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client!: Redis;
  private readonly logger = new Logger(RedisService.name);
  private connected = false;

  constructor(private config: ConfigService) {}

  onModuleInit() {
    const url = this.config.get<string>('REDIS_URL') || 'redis://localhost:6379';
    this.client = new Redis(url, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        if (times > 5) return null; // stop retrying after 5 attempts
        return Math.min(times * 500, 3000);
      },
      reconnectOnError() {
        return false; // don't auto-reconnect on DNS failures
      },
      lazyConnect: true, // don't connect immediately
    });

    this.client.on('connect', () => {
      this.connected = true;
      this.logger.log('Redis connected ✓');
    });
    this.client.on('error', (err) => {
      this.connected = false;
      this.logger.warn(`Redis error (app continues without cache): ${err.message}`);
    });

    // Attempt connection without blocking startup
    this.client.connect().catch((err) => {
      this.logger.warn(`Redis unavailable, running without cache: ${err.message}`);
    });
  }

  onModuleDestroy() {
    this.client?.disconnect();
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (!this.connected) return;
    try {
      if (ttlSeconds) {
        await this.client.set(key, value, 'EX', ttlSeconds);
      } else {
        await this.client.set(key, value);
      }
    } catch (e) {
      this.logger.warn(`Redis set failed for ${key}: ${(e as Error).message}`);
    }
  }

  async get(key: string): Promise<string | null> {
    if (!this.connected) return null;
    try {
      return await this.client.get(key);
    } catch (e) {
      this.logger.warn(`Redis get failed for ${key}: ${(e as Error).message}`);
      return null;
    }
  }

  async del(key: string): Promise<void> {
    if (!this.connected) return;
    try {
      await this.client.del(key);
    } catch (e) {
      this.logger.warn(`Redis del failed for ${key}: ${(e as Error).message}`);
    }
  }

  async exists(key: string): Promise<boolean> {
    if (!this.connected) return false;
    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch {
      return false;
    }
  }

  async setJson(key: string, data: any, ttlSeconds?: number): Promise<void> {
    await this.set(key, JSON.stringify(data), ttlSeconds);
  }

  async getJson<T = any>(key: string): Promise<T | null> {
    const val = await this.get(key);
    if (!val) return null;
    try {
      return JSON.parse(val) as T;
    } catch {
      return null;
    }
  }
}
