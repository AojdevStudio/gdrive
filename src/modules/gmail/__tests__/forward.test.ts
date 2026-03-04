/**
 * Tests for Gmail forward operations - forwardMessage
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { forwardMessage } from '../forward.js';

describe('forwardMessage', () => {
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

  test('fetches original message for content and headers', async () => {
    mockGmailApi.users.messages.get.mockResolvedValue({
      data: {
        id: 'msg123',
        threadId: 'thread123',
        payload: {
          headers: [
            { name: 'From', value: 'sender@example.com' },
            { name: 'Subject', value: 'Original Subject' },
            { name: 'Date', value: 'Mon, 1 Jan 2024 10:00:00 +0000' },
          ],
          mimeType: 'text/plain',
          body: { data: Buffer.from('Original body').toString('base64url') },
        },
      },
    });

    mockGmailApi.users.messages.send.mockResolvedValue({
      data: {
        id: 'fwd123',
        threadId: 'newthread123',
        labelIds: ['SENT'],
      },
    });

    await forwardMessage(
      {
        messageId: 'msg123',
        to: ['recipient@example.com'],
      },
      mockContext
    );

    expect(mockGmailApi.users.messages.get).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'me',
        id: 'msg123',
        format: 'full',
      })
    );
  });

  test('prefixes subject with Fwd: when not already present', async () => {
    mockGmailApi.users.messages.get.mockResolvedValue({
      data: {
        id: 'msg123',
        threadId: 'thread123',
        payload: {
          headers: [
            { name: 'From', value: 'sender@example.com' },
            { name: 'Subject', value: 'Meeting Notes' },
            { name: 'Date', value: 'Mon, 1 Jan 2024 10:00:00 +0000' },
          ],
          mimeType: 'text/plain',
          body: { data: Buffer.from('Notes content').toString('base64url') },
        },
      },
    });

    mockGmailApi.users.messages.send.mockResolvedValue({
      data: {
        id: 'fwd123',
        threadId: 'newthread123',
        labelIds: ['SENT'],
      },
    });

    await forwardMessage(
      {
        messageId: 'msg123',
        to: ['recipient@example.com'],
      },
      mockContext
    );

    const sendCall = mockGmailApi.users.messages.send.mock.calls[0][0];
    const rawDecoded = Buffer.from(sendCall.requestBody.raw, 'base64url').toString();
    expect(rawDecoded).toContain('Subject: Fwd: Meeting Notes');
  });

  test('does not double-prefix subject already starting with Fwd:', async () => {
    mockGmailApi.users.messages.get.mockResolvedValue({
      data: {
        id: 'msg123',
        threadId: 'thread123',
        payload: {
          headers: [
            { name: 'From', value: 'sender@example.com' },
            { name: 'Subject', value: 'Fwd: Already forwarded' },
            { name: 'Date', value: 'Mon, 1 Jan 2024 10:00:00 +0000' },
          ],
          mimeType: 'text/plain',
          body: { data: Buffer.from('Content').toString('base64url') },
        },
      },
    });

    mockGmailApi.users.messages.send.mockResolvedValue({
      data: {
        id: 'fwd123',
        threadId: 'newthread123',
        labelIds: ['SENT'],
      },
    });

    await forwardMessage(
      {
        messageId: 'msg123',
        to: ['recipient@example.com'],
      },
      mockContext
    );

    const sendCall = mockGmailApi.users.messages.send.mock.calls[0][0];
    const rawDecoded = Buffer.from(sendCall.requestBody.raw, 'base64url').toString();
    expect(rawDecoded).toContain('Subject: Fwd: Already forwarded');
    expect(rawDecoded).not.toContain('Subject: Fwd: Fwd:');
  });

  test('includes quoted original email in body', async () => {
    mockGmailApi.users.messages.get.mockResolvedValue({
      data: {
        id: 'msg123',
        threadId: 'thread123',
        payload: {
          headers: [
            { name: 'From', value: 'sender@example.com' },
            { name: 'Subject', value: 'Original' },
            { name: 'Date', value: 'Mon, 1 Jan 2024 10:00:00 +0000' },
          ],
          mimeType: 'text/plain',
          body: { data: Buffer.from('This is the original body').toString('base64url') },
        },
      },
    });

    mockGmailApi.users.messages.send.mockResolvedValue({
      data: {
        id: 'fwd123',
        threadId: 'newthread123',
        labelIds: ['SENT'],
      },
    });

    await forwardMessage(
      {
        messageId: 'msg123',
        to: ['recipient@example.com'],
      },
      mockContext
    );

    const sendCall = mockGmailApi.users.messages.send.mock.calls[0][0];
    const rawDecoded = Buffer.from(sendCall.requestBody.raw, 'base64url').toString();
    expect(rawDecoded).toContain('This is the original body');
  });

  test('prepends custom body before quoted original when body provided', async () => {
    mockGmailApi.users.messages.get.mockResolvedValue({
      data: {
        id: 'msg123',
        threadId: 'thread123',
        payload: {
          headers: [
            { name: 'From', value: 'sender@example.com' },
            { name: 'Subject', value: 'Original' },
            { name: 'Date', value: 'Mon, 1 Jan 2024 10:00:00 +0000' },
          ],
          mimeType: 'text/plain',
          body: { data: Buffer.from('Original body content').toString('base64url') },
        },
      },
    });

    mockGmailApi.users.messages.send.mockResolvedValue({
      data: {
        id: 'fwd123',
        threadId: 'newthread123',
        labelIds: ['SENT'],
      },
    });

    await forwardMessage(
      {
        messageId: 'msg123',
        to: ['recipient@example.com'],
        body: 'FYI, see below.',
      },
      mockContext
    );

    const sendCall = mockGmailApi.users.messages.send.mock.calls[0][0];
    const rawDecoded = Buffer.from(sendCall.requestBody.raw, 'base64url').toString();
    const bodyIndex = rawDecoded.indexOf('\r\n\r\n');
    const bodyContent = rawDecoded.substring(bodyIndex + 4);
    // Custom body should appear before the quoted original
    expect(bodyContent.indexOf('FYI, see below.')).toBeLessThan(bodyContent.indexOf('Original body content'));
  });

  test('sends to specified to recipients', async () => {
    mockGmailApi.users.messages.get.mockResolvedValue({
      data: {
        id: 'msg123',
        threadId: 'thread123',
        payload: {
          headers: [
            { name: 'From', value: 'sender@example.com' },
            { name: 'Subject', value: 'Hello' },
            { name: 'Date', value: 'Mon, 1 Jan 2024 10:00:00 +0000' },
          ],
          mimeType: 'text/plain',
          body: { data: Buffer.from('Body').toString('base64url') },
        },
      },
    });

    mockGmailApi.users.messages.send.mockResolvedValue({
      data: {
        id: 'fwd123',
        threadId: 'newthread123',
        labelIds: ['SENT'],
      },
    });

    await forwardMessage(
      {
        messageId: 'msg123',
        to: ['target@example.com', 'target2@example.com'],
      },
      mockContext
    );

    const sendCall = mockGmailApi.users.messages.send.mock.calls[0][0];
    const rawDecoded = Buffer.from(sendCall.requestBody.raw, 'base64url').toString();
    expect(rawDecoded).toContain('target@example.com');
    expect(rawDecoded).toContain('target2@example.com');
  });

  test('does not set threading headers (new thread)', async () => {
    mockGmailApi.users.messages.get.mockResolvedValue({
      data: {
        id: 'msg123',
        threadId: 'thread123',
        payload: {
          headers: [
            { name: 'From', value: 'sender@example.com' },
            { name: 'Subject', value: 'Hello' },
            { name: 'Date', value: 'Mon, 1 Jan 2024 10:00:00 +0000' },
            { name: 'Message-ID', value: '<abc@example.com>' },
          ],
          mimeType: 'text/plain',
          body: { data: Buffer.from('Body').toString('base64url') },
        },
      },
    });

    mockGmailApi.users.messages.send.mockResolvedValue({
      data: {
        id: 'fwd123',
        threadId: 'newthread123',
        labelIds: ['SENT'],
      },
    });

    await forwardMessage(
      {
        messageId: 'msg123',
        to: ['target@example.com'],
      },
      mockContext
    );

    const sendCall = mockGmailApi.users.messages.send.mock.calls[0][0];
    const rawDecoded = Buffer.from(sendCall.requestBody.raw, 'base64url').toString();
    expect(rawDecoded).not.toContain('In-Reply-To:');
    // threadId should not be set on request (forward creates new thread)
    expect(sendCall.requestBody.threadId).toBeUndefined();
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
            { name: 'Date', value: 'Mon, 1 Jan 2024 10:00:00 +0000' },
          ],
          mimeType: 'text/plain',
          body: { data: Buffer.from('Body').toString('base64url') },
        },
      },
    });

    mockGmailApi.users.messages.send.mockResolvedValue({
      data: {
        id: 'fwd123',
        threadId: 'newthread123',
        labelIds: ['SENT'],
      },
    });

    await forwardMessage(
      {
        messageId: 'msg123',
        to: ['target@example.com'],
      },
      mockContext
    );

    expect(mockContext.cacheManager.invalidate).toHaveBeenCalledWith('gmail:list');
  });

  test('returns messageId, threadId, and success message', async () => {
    mockGmailApi.users.messages.get.mockResolvedValue({
      data: {
        id: 'msg123',
        threadId: 'thread123',
        payload: {
          headers: [
            { name: 'From', value: 'sender@example.com' },
            { name: 'Subject', value: 'Hello' },
            { name: 'Date', value: 'Mon, 1 Jan 2024 10:00:00 +0000' },
          ],
          mimeType: 'text/plain',
          body: { data: Buffer.from('Body').toString('base64url') },
        },
      },
    });

    mockGmailApi.users.messages.send.mockResolvedValue({
      data: {
        id: 'fwd123',
        threadId: 'newthread456',
        labelIds: ['SENT'],
      },
    });

    const result = await forwardMessage(
      {
        messageId: 'msg123',
        to: ['target@example.com'],
      },
      mockContext
    );

    expect(result.messageId).toBe('fwd123');
    expect(result.threadId).toBe('newthread456');
    expect(result.message).toBe('Message forwarded successfully');
  });
});
