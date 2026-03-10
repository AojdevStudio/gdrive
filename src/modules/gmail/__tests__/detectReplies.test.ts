import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { detectReplies } from '../detect-replies.js';

describe('detectReplies', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockContext: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockGmailApi: any;

  beforeEach(() => {
    mockGmailApi = {
      users: {
        threads: {
          get: jest.fn<() => Promise<unknown>>(),
        },
        getProfile: jest.fn<() => Promise<unknown>>().mockResolvedValue({
          data: { emailAddress: 'me@example.com' },
        }),
      },
    };
    mockContext = {
      gmail: mockGmailApi,
      logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
      cacheManager: {
        get: jest.fn<() => Promise<unknown>>().mockResolvedValue(null),
        set: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
        invalidate: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
      },
      performanceMonitor: { track: jest.fn() },
      startTime: Date.now(),
    };
  });

  test('detects replies from other participants', async () => {
    mockGmailApi.users.threads.get.mockResolvedValue({
      data: {
        id: 'thread1',
        messages: [
          {
            id: 'msg1',
            payload: { headers: [{ name: 'From', value: 'me@example.com' }] },
            internalDate: '1710000000000',
          },
          {
            id: 'msg2',
            payload: { headers: [{ name: 'From', value: 'amy@example.com' }] },
            internalDate: '1710100000000',
          },
        ],
      },
    });

    const result = await detectReplies({ threadIds: ['thread1'] }, mockContext);

    expect(result.threads).toHaveLength(1);
    expect(result.threads[0]!.threadId).toBe('thread1');
    expect(result.threads[0]!.hasReply).toBe(true);
    expect(result.threads[0]!.replies).toHaveLength(1);
    expect(result.threads[0]!.replies[0]!.from).toBe('amy@example.com');
  });

  test('returns hasReply false for no external replies', async () => {
    mockGmailApi.users.threads.get.mockResolvedValue({
      data: {
        id: 'thread2',
        messages: [
          {
            id: 'msg1',
            payload: { headers: [{ name: 'From', value: 'me@example.com' }] },
            internalDate: '1710000000000',
          },
        ],
      },
    });

    const result = await detectReplies({ threadIds: ['thread2'] }, mockContext);

    expect(result.threads[0]!.hasReply).toBe(false);
    expect(result.threads[0]!.replies).toHaveLength(0);
  });
});
