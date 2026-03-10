/**
 * Tests for sendFromTemplate — template rendering + send
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { sendFromTemplate } from '../send.js';

describe('sendFromTemplate', () => {
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

  test('renders template and sends email', async () => {
    mockGmailApi.users.messages.send.mockResolvedValue({
      data: {
        id: 'msg-001',
        threadId: 'thread-001',
        labelIds: ['SENT'],
      },
    });

    const result = await sendFromTemplate({
      to: ['amy@example.com'],
      subject: 'Hey {{firstName}}',
      template: 'Hello {{firstName}}, {{note}}',
      variables: { firstName: 'Amy', note: 'quick follow-up' },
    }, mockContext);

    expect(result.messageId).toBe('msg-001');
    expect(result.threadId).toBe('thread-001');
    expect(result.rendered).toBe(true);

    // Verify sendMessage was called with rendered content
    const call = mockGmailApi.users.messages.send.mock.calls[0][0];
    const raw = Buffer.from(call.requestBody.raw, 'base64').toString();
    expect(raw).toContain('Subject: Hey Amy');
    expect(raw).toContain('Hello Amy, quick follow-up');
  });

  test('throws on missing template variable', async () => {
    await expect(sendFromTemplate({
      to: ['test@example.com'],
      subject: 'Hi {{firstName}}',
      template: 'Hello {{firstName}}, {{missingVar}}',
      variables: { firstName: 'Test' },
    }, mockContext)).rejects.toThrow('Missing template variable: missingVar');

    // Should not have attempted to send
    expect(mockGmailApi.users.messages.send).not.toHaveBeenCalled();
  });

  test('HTML-escapes variables when isHtml is true', async () => {
    mockGmailApi.users.messages.send.mockResolvedValue({
      data: {
        id: 'msg-002',
        threadId: 'thread-002',
        labelIds: ['SENT'],
      },
    });

    await sendFromTemplate({
      to: ['bob@example.com'],
      subject: 'Update for {{name}}',
      template: '<p>Hello {{name}}, {{content}}</p>',
      variables: { name: 'Bob', content: '<script>alert("xss")</script>' },
      isHtml: true,
    }, mockContext);

    const call = mockGmailApi.users.messages.send.mock.calls[0][0];
    const raw = Buffer.from(call.requestBody.raw, 'base64').toString();
    expect(raw).toContain('&lt;script&gt;');
    expect(raw).not.toContain('<script>alert');
  });
});
