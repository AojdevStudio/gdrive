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

    // 59 wrapped SDK operations per runtime creation (47 original + 12 new Gmail operations).
    // Actual: replyToMessage, replyAllToMessage, forwardMessage, listAttachments,
    //         downloadAttachment, sendWithAttachments, trashMessage, untrashMessage,
    //         deleteMessage, markAsRead, markAsUnread, archiveMessage = 12 new.
    expect(wrap).toHaveBeenCalledTimes(118);
  });
});
