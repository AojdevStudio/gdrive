import { describe, it, expect } from '@jest/globals';
import { RateLimiter } from '../../sdk/rate-limiter.js';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('RateLimiter', () => {
  it('does not exceed maxRequests when queued requests are released', async () => {
    const limiter = new RateLimiter(2, 5);
    let active = 0;
    let maxActive = 0;

    const limited = limiter.wrap('drive', async (id: number) => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await sleep(20);
      active -= 1;
      return id;
    });

    const results = await Promise.all(
      Array.from({ length: 8 }, (_, i) => limited(i))
    );

    expect(results).toHaveLength(8);
    expect(maxActive).toBeLessThanOrEqual(2);
  });
});
