/**
 * Tests for Gmail message management operations
 * trashMessage, untrashMessage, deleteMessage, markAsRead, markAsUnread, archiveMessage
 */

import { describe, test, expect, jest } from '@jest/globals';
import {
  trashMessage,
  untrashMessage,
  deleteMessage,
  markAsRead,
  markAsUnread,
  archiveMessage,
} from '../manage.js';

function makeContext(): { mockGmailApi: any; mockContext: any } {
  const mockGmailApi = {
    users: {
      messages: {
        trash: jest.fn(),
        untrash: jest.fn(),
        delete: jest.fn(),
        modify: jest.fn(),
      },
    },
  };

  const mockContext = {
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

  return { mockGmailApi, mockContext };
}

describe('trashMessage', () => {
  test('calls users.messages.trash with correct userId and id', async () => {
    const { mockGmailApi, mockContext } = makeContext();

    mockGmailApi.users.messages.trash.mockResolvedValue({
      data: {
        id: 'msg123',
        labelIds: ['TRASH'],
      },
    });

    await trashMessage({ id: 'msg123' }, mockContext);

    expect(mockGmailApi.users.messages.trash).toHaveBeenCalledWith({
      userId: 'me',
      id: 'msg123',
    });
  });

  test('returns trashed message id and labelIds', async () => {
    const { mockGmailApi, mockContext } = makeContext();

    mockGmailApi.users.messages.trash.mockResolvedValue({
      data: {
        id: 'msg123',
        labelIds: ['TRASH'],
      },
    });

    const result = await trashMessage({ id: 'msg123' }, mockContext);

    expect(result.id).toBe('msg123');
    expect(result.labelIds).toEqual(['TRASH']);
    expect(result.message).toBe('Message moved to trash');
  });

  test('invalidates gmail:getMessage cache for that id', async () => {
    const { mockGmailApi, mockContext } = makeContext();

    mockGmailApi.users.messages.trash.mockResolvedValue({
      data: {
        id: 'msg123',
        labelIds: ['TRASH'],
      },
    });

    await trashMessage({ id: 'msg123' }, mockContext);

    expect(mockContext.cacheManager.invalidate).toHaveBeenCalledWith('gmail:getMessage:msg123');
  });

  test('invalidates gmail:list cache', async () => {
    const { mockGmailApi, mockContext } = makeContext();

    mockGmailApi.users.messages.trash.mockResolvedValue({
      data: {
        id: 'msg123',
        labelIds: ['TRASH'],
      },
    });

    await trashMessage({ id: 'msg123' }, mockContext);

    expect(mockContext.cacheManager.invalidate).toHaveBeenCalledWith('gmail:list');
  });
});

describe('untrashMessage', () => {
  test('calls users.messages.untrash with correct userId and id', async () => {
    const { mockGmailApi, mockContext } = makeContext();

    mockGmailApi.users.messages.untrash.mockResolvedValue({
      data: {
        id: 'msg123',
        labelIds: ['INBOX'],
      },
    });

    await untrashMessage({ id: 'msg123' }, mockContext);

    expect(mockGmailApi.users.messages.untrash).toHaveBeenCalledWith({
      userId: 'me',
      id: 'msg123',
    });
  });

  test('returns untrashed message id and labelIds', async () => {
    const { mockGmailApi, mockContext } = makeContext();

    mockGmailApi.users.messages.untrash.mockResolvedValue({
      data: {
        id: 'msg123',
        labelIds: ['INBOX'],
      },
    });

    const result = await untrashMessage({ id: 'msg123' }, mockContext);

    expect(result.id).toBe('msg123');
    expect(result.labelIds).toEqual(['INBOX']);
    expect(result.message).toBe('Message restored from trash');
  });

  test('invalidates gmail:getMessage cache for that id', async () => {
    const { mockGmailApi, mockContext } = makeContext();

    mockGmailApi.users.messages.untrash.mockResolvedValue({
      data: {
        id: 'msg123',
        labelIds: ['INBOX'],
      },
    });

    await untrashMessage({ id: 'msg123' }, mockContext);

    expect(mockContext.cacheManager.invalidate).toHaveBeenCalledWith('gmail:getMessage:msg123');
  });
});

describe('deleteMessage', () => {
  test('throws error when safetyAcknowledged is not provided', async () => {
    const { mockContext } = makeContext();

    await expect(
      deleteMessage({ id: 'msg123' } as any, mockContext)
    ).rejects.toThrow();
  });

  test('throws error when safetyAcknowledged is false', async () => {
    const { mockContext } = makeContext();

    await expect(
      deleteMessage({ id: 'msg123', safetyAcknowledged: false }, mockContext)
    ).rejects.toThrow();
  });

  test('calls users.messages.delete when safetyAcknowledged is true', async () => {
    const { mockGmailApi, mockContext } = makeContext();

    mockGmailApi.users.messages.delete.mockResolvedValue({ data: {} });

    await deleteMessage({ id: 'msg123', safetyAcknowledged: true }, mockContext);

    expect(mockGmailApi.users.messages.delete).toHaveBeenCalledWith({
      userId: 'me',
      id: 'msg123',
    });
  });

  test('returns confirmation message on success', async () => {
    const { mockGmailApi, mockContext } = makeContext();

    mockGmailApi.users.messages.delete.mockResolvedValue({ data: {} });

    const result = await deleteMessage({ id: 'msg123', safetyAcknowledged: true }, mockContext);

    expect(result.id).toBe('msg123');
    expect(result.message).toContain('permanently deleted');
  });
});

describe('markAsRead', () => {
  test('calls modifyLabels removing UNREAD label', async () => {
    const { mockGmailApi, mockContext } = makeContext();

    mockGmailApi.users.messages.modify.mockResolvedValue({
      data: {
        id: 'msg123',
        labelIds: ['INBOX'],
      },
    });

    await markAsRead({ id: 'msg123' }, mockContext);

    expect(mockGmailApi.users.messages.modify).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'me',
        id: 'msg123',
        requestBody: expect.objectContaining({
          removeLabelIds: ['UNREAD'],
        }),
      })
    );
  });

  test('returns result with updated labelIds', async () => {
    const { mockGmailApi, mockContext } = makeContext();

    mockGmailApi.users.messages.modify.mockResolvedValue({
      data: {
        id: 'msg123',
        labelIds: ['INBOX'],
      },
    });

    const result = await markAsRead({ id: 'msg123' }, mockContext);

    expect(result.id).toBe('msg123');
    expect(result.labelIds).toEqual(['INBOX']);
    expect(result.message).toBe('Message marked as read');
  });
});

describe('markAsUnread', () => {
  test('calls modifyLabels adding UNREAD label', async () => {
    const { mockGmailApi, mockContext } = makeContext();

    mockGmailApi.users.messages.modify.mockResolvedValue({
      data: {
        id: 'msg123',
        labelIds: ['INBOX', 'UNREAD'],
      },
    });

    await markAsUnread({ id: 'msg123' }, mockContext);

    expect(mockGmailApi.users.messages.modify).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'me',
        id: 'msg123',
        requestBody: expect.objectContaining({
          addLabelIds: ['UNREAD'],
        }),
      })
    );
  });

  test('returns result with updated labelIds', async () => {
    const { mockGmailApi, mockContext } = makeContext();

    mockGmailApi.users.messages.modify.mockResolvedValue({
      data: {
        id: 'msg123',
        labelIds: ['INBOX', 'UNREAD'],
      },
    });

    const result = await markAsUnread({ id: 'msg123' }, mockContext);

    expect(result.id).toBe('msg123');
    expect(result.labelIds).toEqual(['INBOX', 'UNREAD']);
    expect(result.message).toBe('Message marked as unread');
  });
});

describe('archiveMessage', () => {
  test('calls modifyLabels removing INBOX label', async () => {
    const { mockGmailApi, mockContext } = makeContext();

    mockGmailApi.users.messages.modify.mockResolvedValue({
      data: {
        id: 'msg123',
        labelIds: [],
      },
    });

    await archiveMessage({ id: 'msg123' }, mockContext);

    expect(mockGmailApi.users.messages.modify).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'me',
        id: 'msg123',
        requestBody: expect.objectContaining({
          removeLabelIds: ['INBOX'],
        }),
      })
    );
  });

  test('returns result with updated labelIds', async () => {
    const { mockGmailApi, mockContext } = makeContext();

    mockGmailApi.users.messages.modify.mockResolvedValue({
      data: {
        id: 'msg123',
        labelIds: [],
      },
    });

    const result = await archiveMessage({ id: 'msg123' }, mockContext);

    expect(result.id).toBe('msg123');
    expect(result.labelIds).toEqual([]);
    expect(result.message).toBe('Message archived');
  });
});
