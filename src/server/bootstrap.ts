/**
 * Infrastructure bootstrap factories.
 * Shared logger / cache / monitor setup for server construction.
 */

import winston from 'winston';
import type { Logger } from 'winston';
import type { PerformanceMonitorLike } from '../modules/types.js';

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
    defaultMeta: { service: 'google-workspace-mcp' },
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
