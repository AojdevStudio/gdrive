/**
 * Tests for Gmail reply operations - replyToMessage and replyAllToMessage
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { replyToMessage, replyAllToMessage } from '../reply.js';

describe('replyToMessage', () => {
  let mockContext: any;
  let mockGmailApi: any;

  beforeEach(() => {
    mockGmailApi = {
      users: {
        messages: {
          get: jest.fn(),
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

  test('fetches original message to get MIME Message-ID header', async () => {
    mockGmailApi.users.messages.get.mockResolvedValue({
      data: {
        id: 'msg123',
        threadId: 'thread123',
        payload: {
          headers: [
            { name: 'From', value: 'sender@example.com' },
            { name: 'Subject', value: 'Original Subject' },
            { name: 'Message-ID', value: '<original-message-id@mail.example.com>' },
            { name: 'References', value: '' },
          ],
        },
      },
    });

    mockGmailApi.users.messages.send.mockResolvedValue({
      data: {
        id: 'reply123',
        threadId: 'thread123',
        labelIds: ['SENT'],
      },
    });

    await replyToMessage(
      {
        messageId: 'msg123',
        body: 'Thanks for your message.',
      },
      mockContext
    );

    expect(mockGmailApi.users.messages.get).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'me',
        id: 'msg123',
        format: 'metadata',
      })
    );
  });

  test('sets In-Reply-To header to original MIME Message-ID', async () => {
    mockGmailApi.users.messages.get.mockResolvedValue({
      data: {
        id: 'msg123',
        threadId: 'thread123',
        payload: {
          headers: [
            { name: 'From', value: 'sender@example.com' },
            { name: 'Subject', value: 'Hello' },
            { name: 'Message-ID', value: '<abc@example.com>' },
            { name: 'References', value: '' },
          ],
        },
      },
    });

    mockGmailApi.users.messages.send.mockResolvedValue({
      data: {
        id: 'reply123',
        threadId: 'thread123',
        labelIds: ['SENT'],
      },
    });

    await replyToMessage(
      {
        messageId: 'msg123',
        body: 'Reply body.',
      },
      mockContext
    );

    const sendCall = mockGmailApi.users.messages.send.mock.calls[0][0];
    const rawDecoded = Buffer.from(sendCall.requestBody.raw, 'base64url').toString();
    expect(rawDecoded).toContain('In-Reply-To: <abc@example.com>');
  });

  test('sets References header combining original References and Message-ID', async () => {
    mockGmailApi.users.messages.get.mockResolvedValue({
      data: {
        id: 'msg123',
        threadId: 'thread123',
        payload: {
          headers: [
            { name: 'From', value: 'sender@example.com' },
            { name: 'Subject', value: 'Hello' },
            { name: 'Message-ID', value: '<abc@example.com>' },
            { name: 'References', value: '<prev@example.com>' },
          ],
        },
      },
    });

    mockGmailApi.users.messages.send.mockResolvedValue({
      data: {
        id: 'reply123',
        threadId: 'thread123',
        labelIds: ['SENT'],
      },
    });

    await replyToMessage(
      {
        messageId: 'msg123',
        body: 'Reply body.',
      },
      mockContext
    );

    const sendCall = mockGmailApi.users.messages.send.mock.calls[0][0];
    const rawDecoded = Buffer.from(sendCall.requestBody.raw, 'base64url').toString();
    expect(rawDecoded).toContain('References: <prev@example.com> <abc@example.com>');
  });

  test('sets threadId on the outgoing message request', async () => {
    mockGmailApi.users.messages.get.mockResolvedValue({
      data: {
        id: 'msg123',
        threadId: 'thread456',
        payload: {
          headers: [
            { name: 'From', value: 'sender@example.com' },
            { name: 'Subject', value: 'Hello' },
            { name: 'Message-ID', value: '<abc@example.com>' },
            { name: 'References', value: '' },
          ],
        },
      },
    });

    mockGmailApi.users.messages.send.mockResolvedValue({
      data: {
        id: 'reply123',
        threadId: 'thread456',
        labelIds: ['SENT'],
      },
    });

    await replyToMessage(
      {
        messageId: 'msg123',
        body: 'Reply.',
      },
      mockContext
    );

    const sendCall = mockGmailApi.users.messages.send.mock.calls[0][0];
    expect(sendCall.requestBody.threadId).toBe('thread456');
  });

  test('prefixes subject with Re: when subject lacks Re: prefix', async () => {
    mockGmailApi.users.messages.get.mockResolvedValue({
      data: {
        id: 'msg123',
        threadId: 'thread123',
        payload: {
          headers: [
            { name: 'From', value: 'sender@example.com' },
            { name: 'Subject', value: 'Original Subject' },
            { name: 'Message-ID', value: '<abc@example.com>' },
            { name: 'References', value: '' },
          ],
        },
      },
    });

    mockGmailApi.users.messages.send.mockResolvedValue({
      data: {
        id: 'reply123',
        threadId: 'thread123',
        labelIds: ['SENT'],
      },
    });

    await replyToMessage(
      {
        messageId: 'msg123',
        body: 'Reply.',
      },
      mockContext
    );

    const sendCall = mockGmailApi.users.messages.send.mock.calls[0][0];
    const rawDecoded = Buffer.from(sendCall.requestBody.raw, 'base64url').toString();
    expect(rawDecoded).toContain('Subject: Re: Original Subject');
  });

  test('does not double-prefix subject already starting with Re:', async () => {
    mockGmailApi.users.messages.get.mockResolvedValue({
      data: {
        id: 'msg123',
        threadId: 'thread123',
        payload: {
          headers: [
            { name: 'From', value: 'sender@example.com' },
            { name: 'Subject', value: 'Re: Already replied' },
            { name: 'Message-ID', value: '<abc@example.com>' },
            { name: 'References', value: '' },
          ],
        },
      },
    });

    mockGmailApi.users.messages.send.mockResolvedValue({
      data: {
        id: 'reply123',
        threadId: 'thread123',
        labelIds: ['SENT'],
      },
    });

    await replyToMessage(
      {
        messageId: 'msg123',
        body: 'Reply.',
      },
      mockContext
    );

    const sendCall = mockGmailApi.users.messages.send.mock.calls[0][0];
    const rawDecoded = Buffer.from(sendCall.requestBody.raw, 'base64url').toString();
    expect(rawDecoded).toContain('Subject: Re: Already replied');
    expect(rawDecoded).not.toContain('Subject: Re: Re:');
  });

  test('handles missing Message-ID header gracefully', async () => {
    mockGmailApi.users.messages.get.mockResolvedValue({
      data: {
        id: 'msg123',
        threadId: 'thread123',
        payload: {
          headers: [
            { name: 'From', value: 'sender@example.com' },
            { name: 'Subject', value: 'No ID message' },
            // No Message-ID header
          ],
        },
      },
    });

    mockGmailApi.users.messages.send.mockResolvedValue({
      data: {
        id: 'reply123',
        threadId: 'thread123',
        labelIds: ['SENT'],
      },
    });

    // Should not throw
    const result = await replyToMessage(
      {
        messageId: 'msg123',
        body: 'Reply without threading.',
      },
      mockContext
    );

    expect(result.messageId).toBe('reply123');
  });

  test('sends to original From address by default', async () => {
    mockGmailApi.users.messages.get.mockResolvedValue({
      data: {
        id: 'msg123',
        threadId: 'thread123',
        payload: {
          headers: [
            { name: 'From', value: 'original@example.com' },
            { name: 'Subject', value: 'Hello' },
            { name: 'Message-ID', value: '<abc@example.com>' },
            { name: 'References', value: '' },
          ],
        },
      },
    });

    mockGmailApi.users.messages.send.mockResolvedValue({
      data: {
        id: 'reply123',
        threadId: 'thread123',
        labelIds: ['SENT'],
      },
    });

    await replyToMessage(
      {
        messageId: 'msg123',
        body: 'Reply.',
      },
      mockContext
    );

    const sendCall = mockGmailApi.users.messages.send.mock.calls[0][0];
    const rawDecoded = Buffer.from(sendCall.requestBody.raw, 'base64url').toString();
    expect(rawDecoded).toContain('To: original@example.com');
  });

  test('invalidates gmail:list cache after sending', async () => {
    mockGmailApi.users.messages.get.mockResolvedValue({
      data: {
        id: 'msg123',
        threadId: 'thread123',
        payload: {
          headers: [
            { name: 'From', value: 'sender@example.com' },
            { name: 'Subject', value: 'Hello' },
            { name: 'Message-ID', value: '<abc@example.com>' },
            { name: 'References', value: '' },
          ],
        },
      },
    });

    mockGmailApi.users.messages.send.mockResolvedValue({
      data: {
        id: 'reply123',
        threadId: 'thread123',
        labelIds: ['SENT'],
      },
    });

    await replyToMessage(
      {
        messageId: 'msg123',
        body: 'Reply.',
      },
      mockContext
    );

    expect(mockContext.cacheManager.invalidate).toHaveBeenCalledWith('gmail:list');
  });

  test('returns messageId, threadId, and labelIds', async () => {
    mockGmailApi.users.messages.get.mockResolvedValue({
      data: {
        id: 'msg123',
        threadId: 'thread123',
        payload: {
          headers: [
            { name: 'From', value: 'sender@example.com' },
            { name: 'Subject', value: 'Hello' },
            { name: 'Message-ID', value: '<abc@example.com>' },
            { name: 'References', value: '' },
          ],
        },
      },
    });

    mockGmailApi.users.messages.send.mockResolvedValue({
      data: {
        id: 'reply123',
        threadId: 'thread123',
        labelIds: ['SENT'],
      },
    });

    const result = await replyToMessage(
      {
        messageId: 'msg123',
        body: 'Reply.',
      },
      mockContext
    );

    expect(result.messageId).toBe('reply123');
    expect(result.threadId).toBe('thread123');
    expect(result.labelIds).toEqual(['SENT']);
    expect(result.message).toBe('Reply sent successfully');
  });
});

describe('replyAllToMessage', () => {
  let mockContext: any;
  let mockGmailApi: any;

  beforeEach(() => {
    mockGmailApi = {
      users: {
        getProfile: jest.fn(),
        messages: {
          get: jest.fn(),
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

  test('calls users.getProfile to fetch own email address', async () => {
    mockGmailApi.users.getProfile.mockResolvedValue({
      data: { emailAddress: 'me@example.com' },
    });

    mockGmailApi.users.messages.get.mockResolvedValue({
      data: {
        id: 'msg123',
        threadId: 'thread123',
        payload: {
          headers: [
            { name: 'From', value: 'sender@example.com' },
            { name: 'To', value: 'me@example.com' },
            { name: 'Subject', value: 'Hello' },
            { name: 'Message-ID', value: '<abc@example.com>' },
            { name: 'References', value: '' },
          ],
        },
      },
    });

    mockGmailApi.users.messages.send.mockResolvedValue({
      data: {
        id: 'reply123',
        threadId: 'thread123',
        labelIds: ['SENT'],
      },
    });

    await replyAllToMessage(
      {
        messageId: 'msg123',
        body: 'Reply all.',
      },
      mockContext
    );

    expect(mockGmailApi.users.getProfile).toHaveBeenCalledWith({ userId: 'me' });
  });

  test('includes original To recipients in reply recipients', async () => {
    mockGmailApi.users.getProfile.mockResolvedValue({
      data: { emailAddress: 'me@example.com' },
    });

    mockGmailApi.users.messages.get.mockResolvedValue({
      data: {
        id: 'msg123',
        threadId: 'thread123',
        payload: {
          headers: [
            { name: 'From', value: 'sender@example.com' },
            { name: 'To', value: 'me@example.com, other@example.com' },
            { name: 'Subject', value: 'Hello' },
            { name: 'Message-ID', value: '<abc@example.com>' },
            { name: 'References', value: '' },
          ],
        },
      },
    });

    mockGmailApi.users.messages.send.mockResolvedValue({
      data: {
        id: 'reply123',
        threadId: 'thread123',
        labelIds: ['SENT'],
      },
    });

    await replyAllToMessage(
      {
        messageId: 'msg123',
        body: 'Reply all.',
      },
      mockContext
    );

    const sendCall = mockGmailApi.users.messages.send.mock.calls[0][0];
    const rawDecoded = Buffer.from(sendCall.requestBody.raw, 'base64url').toString();
    expect(rawDecoded).toContain('other@example.com');
  });

  test('includes original Cc recipients in reply cc', async () => {
    mockGmailApi.users.getProfile.mockResolvedValue({
      data: { emailAddress: 'me@example.com' },
    });

    mockGmailApi.users.messages.get.mockResolvedValue({
      data: {
        id: 'msg123',
        threadId: 'thread123',
        payload: {
          headers: [
            { name: 'From', value: 'sender@example.com' },
            { name: 'To', value: 'me@example.com' },
            { name: 'Cc', value: 'cc1@example.com, cc2@example.com' },
            { name: 'Subject', value: 'Hello' },
            { name: 'Message-ID', value: '<abc@example.com>' },
            { name: 'References', value: '' },
          ],
        },
      },
    });

    mockGmailApi.users.messages.send.mockResolvedValue({
      data: {
        id: 'reply123',
        threadId: 'thread123',
        labelIds: ['SENT'],
      },
    });

    await replyAllToMessage(
      {
        messageId: 'msg123',
        body: 'Reply all.',
      },
      mockContext
    );

    const sendCall = mockGmailApi.users.messages.send.mock.calls[0][0];
    const rawDecoded = Buffer.from(sendCall.requestBody.raw, 'base64url').toString();
    expect(rawDecoded).toContain('cc1@example.com');
    expect(rawDecoded).toContain('cc2@example.com');
  });

  test('excludes own email from all recipient lists', async () => {
    mockGmailApi.users.getProfile.mockResolvedValue({
      data: { emailAddress: 'me@example.com' },
    });

    mockGmailApi.users.messages.get.mockResolvedValue({
      data: {
        id: 'msg123',
        threadId: 'thread123',
        payload: {
          headers: [
            { name: 'From', value: 'sender@example.com' },
            { name: 'To', value: 'me@example.com, other@example.com' },
            { name: 'Cc', value: 'me@example.com, cc@example.com' },
            { name: 'Subject', value: 'Hello' },
            { name: 'Message-ID', value: '<abc@example.com>' },
            { name: 'References', value: '' },
          ],
        },
      },
    });

    mockGmailApi.users.messages.send.mockResolvedValue({
      data: {
        id: 'reply123',
        threadId: 'thread123',
        labelIds: ['SENT'],
      },
    });

    await replyAllToMessage(
      {
        messageId: 'msg123',
        body: 'Reply all.',
      },
      mockContext
    );

    const sendCall = mockGmailApi.users.messages.send.mock.calls[0][0];
    const rawDecoded = Buffer.from(sendCall.requestBody.raw, 'base64url').toString();
    // me@example.com should appear at most in From line, not in To or Cc recipients
    const lines = rawDecoded.split('\r\n');
    const toLine = lines.find((l: string) => l.startsWith('To:')) || '';
    const ccLine = lines.find((l: string) => l.startsWith('Cc:')) || '';
    expect(toLine).not.toContain('me@example.com');
    expect(ccLine).not.toContain('me@example.com');
  });

  test('deduplicates final recipient list', async () => {
    mockGmailApi.users.getProfile.mockResolvedValue({
      data: { emailAddress: 'me@example.com' },
    });

    mockGmailApi.users.messages.get.mockResolvedValue({
      data: {
        id: 'msg123',
        threadId: 'thread123',
        payload: {
          headers: [
            { name: 'From', value: 'sender@example.com' },
            { name: 'To', value: 'sender@example.com, other@example.com' },
            { name: 'Subject', value: 'Hello' },
            { name: 'Message-ID', value: '<abc@example.com>' },
            { name: 'References', value: '' },
          ],
        },
      },
    });

    mockGmailApi.users.messages.send.mockResolvedValue({
      data: {
        id: 'reply123',
        threadId: 'thread123',
        labelIds: ['SENT'],
      },
    });

    await replyAllToMessage(
      {
        messageId: 'msg123',
        body: 'Reply all.',
      },
      mockContext
    );

    const sendCall = mockGmailApi.users.messages.send.mock.calls[0][0];
    const rawDecoded = Buffer.from(sendCall.requestBody.raw, 'base64url').toString();
    // sender@example.com should appear only once in To field
    const toLineMatch = rawDecoded.match(/^To: (.+)$/m);
    if (toLineMatch) {
      const toLine = toLineMatch[1] ?? '';
      const occurrences = (toLine.match(/sender@example\.com/g) || []).length;
      expect(occurrences).toBe(1);
    }
  });

  test('always replies to original From address', async () => {
    mockGmailApi.users.getProfile.mockResolvedValue({
      data: { emailAddress: 'me@example.com' },
    });

    mockGmailApi.users.messages.get.mockResolvedValue({
      data: {
        id: 'msg123',
        threadId: 'thread123',
        payload: {
          headers: [
            { name: 'From', value: 'original-sender@example.com' },
            { name: 'To', value: 'me@example.com' },
            { name: 'Subject', value: 'Hello' },
            { name: 'Message-ID', value: '<abc@example.com>' },
            { name: 'References', value: '' },
          ],
        },
      },
    });

    mockGmailApi.users.messages.send.mockResolvedValue({
      data: {
        id: 'reply123',
        threadId: 'thread123',
        labelIds: ['SENT'],
      },
    });

    await replyAllToMessage(
      {
        messageId: 'msg123',
        body: 'Reply all.',
      },
      mockContext
    );

    const sendCall = mockGmailApi.users.messages.send.mock.calls[0][0];
    const rawDecoded = Buffer.from(sendCall.requestBody.raw, 'base64url').toString();
    expect(rawDecoded).toContain('original-sender@example.com');
  });
});
