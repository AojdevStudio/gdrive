/**
 * Infrastructure bootstrap factories.
 * Extracted from index.ts so both the Node stdio transport and future
 * transports share identical logger / cache / monitor setup.
 */

import winston from 'winston';
import { createClient, RedisClientType } from 'redis';
import type { Logger } from 'winston';
import type { CacheManagerLike, PerformanceMonitorLike } from '../modules/types.js';

// ─── Logger ──────────────────────────────────────────────────────────────────

export function serializeLogMetadata(
  value: unknown,
  seen: WeakSet<object> = new WeakSet()
): unknown {
  if (value instanceof Error) {
    if (seen.has(value)) {
      return '[Circular]';
    }
    seen.add(value);

    const plain: Record<string, unknown> = {
      name: value.name,
      message: value.message,
      stack: value.stack,
    };

    try {
      for (const key of Object.getOwnPropertyNames(value)) {
        plain[key] = serializeLogMetadata(
          (value as unknown as Record<string, unknown>)[key],
          seen
        );
      }
    } catch {
      // ignore property traversal failures
    }

    const nodeErr = value as unknown as { code?: unknown; cause?: unknown };
    if (nodeErr.code !== undefined) {
      plain.code = serializeLogMetadata(nodeErr.code, seen);
    }
    if (nodeErr.cause !== undefined) {
      plain.cause = serializeLogMetadata(nodeErr.cause, seen);
    }
    return plain;
  }

  if (Array.isArray(value)) {
    if (seen.has(value)) {
      return '[Circular]';
    }
    seen.add(value);
    return value.map((item) => serializeLogMetadata(item, seen));
  }

  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if (seen.has(obj)) {
      return '[Circular]';
    }
    seen.add(obj);

    const serialized: Record<string, unknown> = {};
    for (const key of Object.keys(obj)) {
      serialized[key] = serializeLogMetadata(obj[key], seen);
    }
    return serialized;
  }

  return value;
}

const errorSerializer = winston.format((info) => {
  for (const key of Object.keys(info)) {
    (info as unknown as Record<string, unknown>)[key] = serializeLogMetadata(
      (info as unknown as Record<string, unknown>)[key]
    );
  }
  return info;
});

export function createLogger(): Logger {
  return winston.createLogger({
    level: process.env.LOG_LEVEL ?? 'info',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      errorSerializer(),
      winston.format.json()
    ),
    defaultMeta: { service: 'gdrive-mcp-server' },
    transports: [
      new winston.transports.File({
        filename: 'logs/error.log',
        level: 'error',
        maxsize: 5242880,
        maxFiles: 5,
      }),
      new winston.transports.File({
        filename: 'logs/combined.log',
        maxsize: 5242880,
        maxFiles: 5,
      }),
      new winston.transports.Console({
        stderrLevels: ['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly'],
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.timestamp(),
          winston.format.printf(({ timestamp, level, message, ...meta }) => {
            const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : '';
            return `${timestamp} [${level}]: ${message} ${metaStr}`;
          })
        ),
      }),
    ],
  });
}

// ─── Performance Monitor ─────────────────────────────────────────────────────

class PerformanceMonitor implements PerformanceMonitorLike {
  private metrics: Map<string, { count: number; totalTime: number; errors: number }> = new Map();
  private cacheHits = 0;
  private cacheMisses = 0;
  private readonly startTime = Date.now();

  track(operation: string, duration: number, error = false): void {
    const current = this.metrics.get(operation) ?? { count: 0, totalTime: 0, errors: 0 };
    current.count++;
    current.totalTime += duration;
    if (error) {
      current.errors++;
    }
    this.metrics.set(operation, current);
  }

  recordCacheHit(): void { this.cacheHits++; }
  recordCacheMiss(): void { this.cacheMisses++; }

  getStats() {
    const ops: Record<string, { count: number; avgTime: number; errorRate: number }> = {};
    for (const [op, data] of this.metrics) {
      ops[op] = {
        count: data.count,
        avgTime: data.totalTime / data.count,
        errorRate: data.errors / data.count,
      };
    }
    return {
      uptime: Date.now() - this.startTime,
      operations: ops,
      cache: {
        hits: this.cacheHits,
        misses: this.cacheMisses,
        hitRate:
          this.cacheHits + this.cacheMisses > 0
            ? this.cacheHits / (this.cacheHits + this.cacheMisses)
            : 0,
      },
    };
  }
}

export function createPerformanceMonitor(): PerformanceMonitor {
  return new PerformanceMonitor();
}

// ─── Cache Manager ────────────────────────────────────────────────────────────

class CacheManager implements CacheManagerLike {
  private client: RedisClientType | null = null;
  private connected = false;
  private readonly ttl = 300;

  constructor(private readonly logger: Logger) {}

  async connect(): Promise<void> {
    try {
      this.client = createClient({
        url: process.env.REDIS_URL ?? 'redis://localhost:6379',
        socket: {
          reconnectStrategy: (retries: number) => {
            if (retries > 10) {
              this.logger.error('Redis reconnection failed after 10 attempts');
              return false;
            }
            return Math.min(retries * 50, 500);
          },
        },
      }) as RedisClientType;

      this.client.on('error', (err: Error) => {
        this.logger.error('Redis client error', { error: err.message });
        this.connected = false;
      });
      this.client.on('connect', () => {
        this.logger.info('Redis connected');
        this.connected = true;
      });

      await this.client.connect();
    } catch (error) {
      this.logger.warn('Redis connection failed, continuing without cache', { error });
      this.connected = false;
    }
  }

  async get(key: string): Promise<unknown | null> {
    if (!this.connected || !this.client) {
      return null;
    }
    try {
      const data = await this.client.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      this.logger.error('Cache get error', { error, key });
      return null;
    }
  }

  async set(key: string, value: unknown): Promise<void> {
    if (!this.connected || !this.client) {
      return;
    }
    try {
      await this.client.setEx(key, this.ttl, JSON.stringify(value));
    } catch (error) {
      this.logger.error('Cache set error', { error, key });
    }
  }

  async invalidate(pattern: string): Promise<void> {
    if (!this.connected || !this.client) {
      return;
    }
    try {
      const batchSize = 100;
      const batch: string[] = [];
      let deletedCount = 0;

      for await (const keyOrKeys of this.client.scanIterator({
        MATCH: pattern,
        COUNT: batchSize,
      })) {
        if (typeof keyOrKeys === 'string') {
          batch.push(keyOrKeys);
        } else if (Array.isArray(keyOrKeys)) {
          batch.push(...keyOrKeys.filter((key): key is string => typeof key === 'string'));
        }

        if (batch.length >= batchSize) {
          await this.client.del(batch);
          deletedCount += batch.length;
          batch.length = 0;
        }
      }

      if (batch.length > 0) {
        await this.client.del(batch);
        deletedCount += batch.length;
      }

      if (deletedCount > 0) {
        this.logger.debug(`Invalidated ${deletedCount} cache entries`);
      }
    } catch (error) {
      this.logger.error('Cache invalidation error', { error, pattern });
    }
  }
}

export async function createCacheManager(logger: Logger): Promise<CacheManagerLike> {
  const mgr = new CacheManager(logger);
  await mgr.connect();
  return mgr;
}
