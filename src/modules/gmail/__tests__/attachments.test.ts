/**
 * Tests for Gmail attachment operations - listAttachments, downloadAttachment, sendWithAttachments
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { listAttachments, downloadAttachment, sendWithAttachments } from '../attachments.js';

describe('listAttachments', () => {
  let mockContext: any;
  let mockGmailApi: any;

  beforeEach(() => {
    mockGmailApi = {
      users: {
        messages: {
          get: jest.fn(),
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

  test('returns attachment metadata for messages with attachments', async () => {
    mockGmailApi.users.messages.get.mockResolvedValue({
      data: {
        id: 'msg123',
        threadId: 'thread123',
        payload: {
          mimeType: 'multipart/mixed',
          headers: [
            { name: 'Subject', value: 'Email with attachment' },
          ],
          parts: [
            {
              mimeType: 'text/plain',
              body: { data: Buffer.from('Body text').toString('base64url') },
            },
            {
              mimeType: 'application/pdf',
              filename: 'document.pdf',
              body: {
                attachmentId: 'att123',
                size: 12345,
              },
            },
          ],
        },
      },
    });

    const result = await listAttachments({ messageId: 'msg123' }, mockContext);

    expect(result.attachments).toHaveLength(1);
    const att = result.attachments[0]!;
    expect(att.filename).toBe('document.pdf');
    expect(att.mimeType).toBe('application/pdf');
    expect(att.attachmentId).toBe('att123');
    expect(att.size).toBe(12345);
  });

  test('returns empty array for messages with no attachments', async () => {
    mockGmailApi.users.messages.get.mockResolvedValue({
      data: {
        id: 'msg123',
        threadId: 'thread123',
        payload: {
          mimeType: 'text/plain',
          headers: [
            { name: 'Subject', value: 'Simple email' },
          ],
          body: { data: Buffer.from('Just text').toString('base64url') },
        },
      },
    });

    const result = await listAttachments({ messageId: 'msg123' }, mockContext);

    expect(result.attachments).toHaveLength(0);
  });

  test('includes filename, mimeType, size, and attachmentId per attachment', async () => {
    mockGmailApi.users.messages.get.mockResolvedValue({
      data: {
        id: 'msg123',
        threadId: 'thread123',
        payload: {
          mimeType: 'multipart/mixed',
          headers: [],
          parts: [
            {
              mimeType: 'image/png',
              filename: 'photo.png',
              body: {
                attachmentId: 'attXYZ',
                size: 98765,
              },
            },
          ],
        },
      },
    });

    const result = await listAttachments({ messageId: 'msg123' }, mockContext);

    expect(result.attachments[0]!).toMatchObject({
      filename: 'photo.png',
      mimeType: 'image/png',
      attachmentId: 'attXYZ',
      size: 98765,
    });
  });

  test('handles multiple attachments', async () => {
    mockGmailApi.users.messages.get.mockResolvedValue({
      data: {
        id: 'msg123',
        threadId: 'thread123',
        payload: {
          mimeType: 'multipart/mixed',
          headers: [],
          parts: [
            {
              mimeType: 'text/plain',
              body: { data: Buffer.from('text').toString('base64url') },
            },
            {
              mimeType: 'application/pdf',
              filename: 'file1.pdf',
              body: { attachmentId: 'att1', size: 1000 },
            },
            {
              mimeType: 'image/jpeg',
              filename: 'photo.jpg',
              body: { attachmentId: 'att2', size: 2000 },
            },
          ],
        },
      },
    });

    const result = await listAttachments({ messageId: 'msg123' }, mockContext);

    expect(result.attachments).toHaveLength(2);
  });
});

describe('downloadAttachment', () => {
  let mockContext: any;
  let mockGmailApi: any;

  beforeEach(() => {
    mockGmailApi = {
      users: {
        messages: {
          attachments: {
            get: jest.fn(),
          },
          get: jest.fn(),
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

  test('calls users.messages.attachments.get with correct params', async () => {
    mockGmailApi.users.messages.get.mockResolvedValue({
      data: {
        id: 'msg123',
        payload: {
          mimeType: 'multipart/mixed',
          headers: [],
          parts: [
            {
              mimeType: 'application/pdf',
              filename: 'doc.pdf',
              body: { attachmentId: 'att123', size: 500 },
            },
          ],
        },
      },
    });

    mockGmailApi.users.messages.attachments.get.mockResolvedValue({
      data: {
        size: 500,
        data: Buffer.from('PDF content').toString('base64url'),
      },
    });

    await downloadAttachment(
      { messageId: 'msg123', attachmentId: 'att123' },
      mockContext
    );

    expect(mockGmailApi.users.messages.attachments.get).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'me',
        messageId: 'msg123',
        id: 'att123',
      })
    );
  });

  test('returns base64-encoded attachment data', async () => {
    mockGmailApi.users.messages.get.mockResolvedValue({
      data: {
        id: 'msg123',
        payload: {
          mimeType: 'multipart/mixed',
          headers: [],
          parts: [
            {
              mimeType: 'text/plain',
              filename: 'file.txt',
              body: { attachmentId: 'att123', size: 100 },
            },
          ],
        },
      },
    });

    const attachmentData = Buffer.from('File content here').toString('base64url');
    mockGmailApi.users.messages.attachments.get.mockResolvedValue({
      data: {
        size: 100,
        data: attachmentData,
      },
    });

    const result = await downloadAttachment(
      { messageId: 'msg123', attachmentId: 'att123' },
      mockContext
    );

    expect(result.data).toBe(attachmentData);
  });

  test('returns filename and mimeType in result', async () => {
    mockGmailApi.users.messages.get.mockResolvedValue({
      data: {
        id: 'msg123',
        payload: {
          mimeType: 'multipart/mixed',
          headers: [],
          parts: [
            {
              mimeType: 'image/png',
              filename: 'image.png',
              body: { attachmentId: 'att999', size: 300 },
            },
          ],
        },
      },
    });

    mockGmailApi.users.messages.attachments.get.mockResolvedValue({
      data: {
        size: 300,
        data: Buffer.from('PNG data').toString('base64url'),
      },
    });

    const result = await downloadAttachment(
      { messageId: 'msg123', attachmentId: 'att999' },
      mockContext
    );

    expect(result.filename).toBe('image.png');
    expect(result.mimeType).toBe('image/png');
    expect(result.size).toBe(300);
  });
});

describe('sendWithAttachments', () => {
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

  test('builds multipart/mixed MIME message', async () => {
    mockGmailApi.users.messages.send.mockResolvedValue({
      data: {
        id: 'sent123',
        threadId: 'thread123',
        labelIds: ['SENT'],
      },
    });

    await sendWithAttachments(
      {
        to: ['recipient@example.com'],
        subject: 'Email with file',
        body: 'Please see attached.',
        attachments: [
          {
            filename: 'test.txt',
            mimeType: 'text/plain',
            data: Buffer.from('file contents').toString('base64'),
          },
        ],
      },
      mockContext
    );

    const sendCall = mockGmailApi.users.messages.send.mock.calls[0][0];
    const rawDecoded = Buffer.from(sendCall.requestBody.raw, 'base64url').toString();
    expect(rawDecoded).toContain('Content-Type: multipart/mixed');
  });

  test('includes text body as first part of multipart message', async () => {
    mockGmailApi.users.messages.send.mockResolvedValue({
      data: {
        id: 'sent123',
        threadId: 'thread123',
        labelIds: ['SENT'],
      },
    });

    await sendWithAttachments(
      {
        to: ['recipient@example.com'],
        subject: 'Test',
        body: 'Hello there, see attached.',
        attachments: [
          {
            filename: 'file.txt',
            mimeType: 'text/plain',
            data: Buffer.from('data').toString('base64'),
          },
        ],
      },
      mockContext
    );

    const sendCall = mockGmailApi.users.messages.send.mock.calls[0][0];
    const rawDecoded = Buffer.from(sendCall.requestBody.raw, 'base64url').toString();
    expect(rawDecoded).toContain('Hello there, see attached.');
    expect(rawDecoded).toContain('Content-Type: text/plain');
  });

  test('encodes each attachment as base64 in MIME part', async () => {
    mockGmailApi.users.messages.send.mockResolvedValue({
      data: {
        id: 'sent123',
        threadId: 'thread123',
        labelIds: ['SENT'],
      },
    });

    const attachmentContent = Buffer.from('attachment data here').toString('base64');

    await sendWithAttachments(
      {
        to: ['recipient@example.com'],
        subject: 'Test',
        body: 'Body',
        attachments: [
          {
            filename: 'data.bin',
            mimeType: 'application/octet-stream',
            data: attachmentContent,
          },
        ],
      },
      mockContext
    );

    const sendCall = mockGmailApi.users.messages.send.mock.calls[0][0];
    const rawDecoded = Buffer.from(sendCall.requestBody.raw, 'base64url').toString();
    expect(rawDecoded).toContain('Content-Transfer-Encoding: base64');
  });

  test('includes Content-Disposition: attachment header per part', async () => {
    mockGmailApi.users.messages.send.mockResolvedValue({
      data: {
        id: 'sent123',
        threadId: 'thread123',
        labelIds: ['SENT'],
      },
    });

    await sendWithAttachments(
      {
        to: ['recipient@example.com'],
        subject: 'Test',
        body: 'Body',
        attachments: [
          {
            filename: 'report.pdf',
            mimeType: 'application/pdf',
            data: Buffer.from('pdf data').toString('base64'),
          },
        ],
      },
      mockContext
    );

    const sendCall = mockGmailApi.users.messages.send.mock.calls[0][0];
    const rawDecoded = Buffer.from(sendCall.requestBody.raw, 'base64url').toString();
    expect(rawDecoded).toContain('Content-Disposition: attachment; filename="report.pdf"');
  });

  test('uses unique boundary string in Content-Type header', async () => {
    mockGmailApi.users.messages.send.mockResolvedValue({
      data: {
        id: 'sent123',
        threadId: 'thread123',
        labelIds: ['SENT'],
      },
    });

    await sendWithAttachments(
      {
        to: ['recipient@example.com'],
        subject: 'Test',
        body: 'Body',
        attachments: [
          {
            filename: 'file.txt',
            mimeType: 'text/plain',
            data: Buffer.from('content').toString('base64'),
          },
        ],
      },
      mockContext
    );

    const sendCall = mockGmailApi.users.messages.send.mock.calls[0][0];
    const rawDecoded = Buffer.from(sendCall.requestBody.raw, 'base64url').toString();
    expect(rawDecoded).toMatch(/Content-Type: multipart\/mixed; boundary="[^"]+"/);
  });

  test('validates all recipient email addresses', async () => {
    await expect(
      sendWithAttachments(
        {
          to: ['invalid-email'],
          subject: 'Test',
          body: 'Body',
          attachments: [],
        },
        mockContext
      )
    ).rejects.toThrow();
  });

  test('invalidates gmail:list and gmail:search caches', async () => {
    mockGmailApi.users.messages.send.mockResolvedValue({
      data: {
        id: 'sent123',
        threadId: 'thread123',
        labelIds: ['SENT'],
      },
    });

    await sendWithAttachments(
      {
        to: ['recipient@example.com'],
        subject: 'Test',
        body: 'Body',
        attachments: [
          {
            filename: 'file.txt',
            mimeType: 'text/plain',
            data: Buffer.from('content').toString('base64'),
          },
        ],
      },
      mockContext
    );

    expect(mockContext.cacheManager.invalidate).toHaveBeenCalledWith('gmail:list');
    expect(mockContext.cacheManager.invalidate).toHaveBeenCalledWith('gmail:search');
  });

  test('returns messageId, threadId, labelIds, and message', async () => {
    mockGmailApi.users.messages.send.mockResolvedValue({
      data: {
        id: 'sent999',
        threadId: 'thread999',
        labelIds: ['SENT', 'INBOX'],
      },
    });

    const result = await sendWithAttachments(
      {
        to: ['recipient@example.com'],
        subject: 'Test',
        body: 'Body',
        attachments: [],
      },
      mockContext
    );

    expect(result.messageId).toBe('sent999');
    expect(result.threadId).toBe('thread999');
    expect(result.labelIds).toEqual(['SENT', 'INBOX']);
    expect(result.message).toBe('Message sent successfully');
  });
});
