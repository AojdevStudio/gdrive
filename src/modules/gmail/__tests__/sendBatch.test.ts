/**
 * Tests for sendBatch — batch send with throttling and dry-run
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { sendBatch } from '../send.js';

describe('sendBatch', () => {
  let mockContext: any;
  let mockGmailApi: any;

  beforeEach(() => {
    mockGmailApi = {
      users: {
        messages: {
          send: jest.fn(),
        },
      },
    };

    mockContext = {
      gmail: mockGmailApi,
      logger: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
      },
      cacheManager: {
        get: jest.fn(() => Promise.resolve(null)),
        set: jest.fn(() => Promise.resolve(undefined)),
        invalidate: jest.fn(() => Promise.resolve(undefined)),
      },
      performanceMonitor: {
        track: jest.fn(),
      },
      startTime: Date.now(),
    };
  });

  test('sends to multiple recipients with per-recipient variables', async () => {
    mockGmailApi.users.messages.send
      .mockResolvedValueOnce({
        data: { id: 'msg-a', threadId: 'thread-a', labelIds: ['SENT'] },
      })
      .mockResolvedValueOnce({
        data: { id: 'msg-b', threadId: 'thread-b', labelIds: ['SENT'] },
      });

    const result = await sendBatch({
      subject: 'Hi {{name}}',
      template: 'Hello {{name}}, {{note}}',
      recipients: [
        { to: 'alice@example.com', variables: { name: 'Alice', note: 'note A' } },
        { to: 'bob@example.com', variables: { name: 'Bob', note: 'note B' } },
      ],
      delayMs: 0,
    }, mockContext);

    expect(result.sent).toBe(2);
    expect(result.failed).toBe(0);
    expect(result.results).toHaveLength(2);
    expect(result.results![0]!.to).toBe('alice@example.com');
    expect(result.results![0]!.status).toBe('sent');
    expect(result.results![1]!.to).toBe('bob@example.com');

    // Verify each send was called with correct rendered content
    const rawA = Buffer.from(
      mockGmailApi.users.messages.send.mock.calls[0][0].requestBody.raw,
      'base64'
    ).toString();
    expect(rawA).toContain('Hello Alice, note A');

    const rawB = Buffer.from(
      mockGmailApi.users.messages.send.mock.calls[1][0].requestBody.raw,
      'base64'
    ).toString();
    expect(rawB).toContain('Hello Bob, note B');
  });

  test('dryRun returns previews without sending', async () => {
    const result = await sendBatch({
      subject: 'Hi {{name}}',
      template: 'Hello {{name}}!',
      recipients: [
        { to: 'alice@example.com', variables: { name: 'Alice' } },
        { to: 'bob@example.com', variables: { name: 'Bob' } },
      ],
      dryRun: true,
      delayMs: 0,
    }, mockContext);

    expect(result.sent).toBe(0);
    expect(result.failed).toBe(0);
    expect(result.previews).toHaveLength(2);
    expect(result.previews![0]!.to).toBe('alice@example.com');
    expect(result.previews![0]!.subject).toBe('Hi Alice');
    expect(result.previews![0]!.body).toBe('Hello Alice!');
    expect(result.previews![0]!.wouldSend).toBe(false);
    expect(result.previews![1]!.to).toBe('bob@example.com');
    expect(result.previews![1]!.subject).toBe('Hi Bob');

    // Should NOT have called Gmail API
    expect(mockGmailApi.users.messages.send).not.toHaveBeenCalled();
  });

  test('continues on individual send failure and reports per-recipient status', async () => {
    mockGmailApi.users.messages.send
      .mockRejectedValueOnce(new Error('Gmail quota exceeded'))
      .mockResolvedValueOnce({
        data: { id: 'msg-b', threadId: 'thread-b', labelIds: ['SENT'] },
      });

    const result = await sendBatch({
      subject: 'Hi {{name}}',
      template: 'Hello {{name}}',
      recipients: [
        { to: 'fail@example.com', variables: { name: 'Fail' } },
        { to: 'pass@example.com', variables: { name: 'Pass' } },
      ],
      delayMs: 0,
    }, mockContext);

    expect(result.sent).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.results).toHaveLength(2);
    expect(result.results![0]!.status).toBe('failed');
    expect(result.results![0]!.error).toContain('Gmail quota exceeded');
    expect(result.results![1]!.status).toBe('sent');
    expect(result.results![1]!.messageId).toBe('msg-b');
  });
});
