/**
 * Per-service token bucket rate limiter.
 * Prevents Google API quota exhaustion from rapid chained execute() calls.
 * Default: 10 requests per second per service.
 */

export class RateLimiter {
  private readonly queues: Map<string, Array<() => void>> = new Map();
  private readonly counters: Map<string, number> = new Map();
  private readonly maxRequests: number;
  private readonly windowMs: number;

  constructor(maxRequests = 10, windowMs = 1000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  /**
   * Wrap an async function with rate limiting per service.
   */
  wrap<T, A extends unknown[]>(
    service: string,
    fn: (...args: A) => Promise<T>
  ): (...args: A) => Promise<T> {
    return async (...args: A): Promise<T> => {
      await this.acquire(service);
      try {
        return await fn(...args);
      } finally {
        setTimeout(() => this.release(service), this.windowMs);
      }
    };
  }

  private async acquire(service: string): Promise<void> {
    const count = this.counters.get(service) ?? 0;
    if (count < this.maxRequests) {
      this.counters.set(service, count + 1);
      return;
    }
    await new Promise<void>((resolve) => {
      const queue = this.queues.get(service) ?? [];
      queue.push(resolve);
      this.queues.set(service, queue);
    });
  }

  private release(service: string): void {
    const count = this.counters.get(service) ?? 0;
    this.counters.set(service, Math.max(0, count - 1));
    const queue = this.queues.get(service) ?? [];
    const next = queue.shift();
    if (next) {
      this.queues.set(service, queue);
      next();
    }
  }
}
