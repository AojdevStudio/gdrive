import { describe, it, expect, jest } from '@jest/globals';
import { createSDKRuntime } from '../../sdk/runtime.js';
import type { RateLimiter } from '../../sdk/rate-limiter.js';
import type { FullContext } from '../../sdk/types.js';

describe('createSDKRuntime rate limiter injection', () => {
  it('uses the provided limiter instance for all wrappers', () => {
    const wrap = jest.fn((_service: string, fn: (...args: unknown[]) => Promise<unknown>) => fn);
    const limiter = { wrap } as unknown as RateLimiter;
    const context = {} as FullContext;

    createSDKRuntime(context, limiter);
    createSDKRuntime(context, limiter);

    // 63 wrapped SDK operations per runtime creation (47 original + 12 Gmail v3.2 ops + 4 outreach ops).
    // Outreach: readAsRecords, dryRun, sendFromTemplate, sendBatch = 4 new.
    expect(wrap).toHaveBeenCalledTimes(126);
  });
});
