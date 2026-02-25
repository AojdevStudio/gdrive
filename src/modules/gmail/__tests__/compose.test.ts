/**
 * Security tests for Gmail compose operations
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { createDraft } from '../compose.js';

describe('createDraft Security', () => {
  let mockContext: any;
  let mockGmailApi: any;

  beforeEach(() => {
    mockGmailApi = {
      users: {
        drafts: {
          create: jest.fn(),
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

  test('validates email addresses in to field', async () => {
    await expect(createDraft({
      to: ['invalid-email'],
      subject: 'Test',
      body: 'Test body',
    }, mockContext)).rejects.toThrow('Invalid email address in to');
  });

  test('validates email addresses in cc field', async () => {
    await expect(createDraft({
      to: ['valid@example.com'],
      cc: ['not-an-email'],
      subject: 'Test',
      body: 'Test body',
    }, mockContext)).rejects.toThrow('Invalid email address in cc');
  });

  test('validates email addresses in bcc field', async () => {
    await expect(createDraft({
      to: ['valid@example.com'],
      bcc: ['bad@'],
      subject: 'Test',
      body: 'Test body',
    }, mockContext)).rejects.toThrow('Invalid email address in bcc');
  });

  test('validates from email address', async () => {
    await expect(createDraft({
      to: ['valid@example.com'],
      from: 'not-valid',
      subject: 'Test',
      body: 'Test body',
    }, mockContext)).rejects.toThrow('Invalid from email address');
  });

  test('sanitizes CRLF in subject to prevent header injection', async () => {
    const maliciousSubject = 'Test\r\nBcc: attacker@evil.com';

    mockGmailApi.users.drafts.create.mockResolvedValue({
      data: {
        id: 'draft123',
        message: { id: 'msg123', threadId: 'thread123' },
      },
    });

    await createDraft({
      to: ['user@example.com'],
      subject: maliciousSubject,
      body: 'Body',
    }, mockContext);

    const call = mockGmailApi.users.drafts.create.mock.calls[0][0];
    const raw = call.requestBody.message.raw;
    const decoded = Buffer.from(raw, 'base64').toString();

    // Subject should have CRLF removed - no header injection possible
    expect(decoded).not.toContain('Subject: Test\r\nBcc:');
    expect(decoded).toContain('TestBcc: attacker@evil.com'); // CRLF stripped
  });

  test('creates draft with valid inputs', async () => {
    mockGmailApi.users.drafts.create.mockResolvedValue({
      data: {
        id: 'draft123',
        message: { id: 'msg123', threadId: 'thread123' },
      },
    });

    const result = await createDraft({
      to: ['recipient@example.com'],
      subject: 'Valid Subject',
      body: 'Valid body',
    }, mockContext);

    expect(result.draftId).toBe('draft123');
    expect(result.messageId).toBe('msg123');
    expect(mockGmailApi.users.drafts.create).toHaveBeenCalled();
  });

  test('handles multiple valid recipients', async () => {
    mockGmailApi.users.drafts.create.mockResolvedValue({
      data: {
        id: 'draft456',
        message: { id: 'msg456', threadId: 'thread456' },
      },
    });

    await createDraft({
      to: ['user1@example.com', 'user2@example.com'],
      cc: ['cc@example.com'],
      bcc: ['bcc@example.com'],
      subject: 'Test',
      body: 'Test body',
    }, mockContext);

    expect(mockGmailApi.users.drafts.create).toHaveBeenCalled();
  });
});
