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

    // 47 wrapped SDK operations per runtime creation.
    expect(wrap).toHaveBeenCalledTimes(94);
  });
});
