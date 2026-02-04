/**
 * Tests for Gmail label operations
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { modifyLabels } from '../labels.js';

describe('modifyLabels', () => {
  let mockContext: any;
  let mockGmailApi: any;

  beforeEach(() => {
    // Mock Gmail API
    mockGmailApi = {
      users: {
        messages: {
          modify: jest.fn(),
        },
      },
    };

    // Mock context
    mockContext = {
      logger: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
      },
      gmail: mockGmailApi,
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

  test('modifies labels with id parameter', async () => {
    const mockResponse = {
      data: {
        id: '18c123abc',
        labelIds: ['INBOX', 'Label_12345'],
      },
    };

    mockGmailApi.users.messages.modify.mockResolvedValue(mockResponse);

    await modifyLabels(
      {
        id: '18c123abc',
        addLabelIds: ['Label_12345'],
      },
      mockContext
    );

    expect(mockGmailApi.users.messages.modify).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'me',
        id: '18c123abc',
        requestBody: {
          addLabelIds: ['Label_12345'],
        },
      })
    );
  });

  test('returns result with id field', async () => {
    const mockResponse = {
      data: {
        id: '18c123abc',
        labelIds: ['INBOX'],
      },
    };

    mockGmailApi.users.messages.modify.mockResolvedValue(mockResponse);

    const result = await modifyLabels(
      {
        id: '18c123abc',
        removeLabelIds: ['UNREAD'],
      },
      mockContext
    );

    expect(result.id).toBe('18c123abc');
    expect(result.labelIds).toEqual(['INBOX']);
    expect(result.message).toBe('Labels modified successfully');
  });

  test('invalidates cache with correct message id', async () => {
    const mockResponse = {
      data: {
        id: '18c123abc',
        labelIds: ['INBOX'],
      },
    };

    mockGmailApi.users.messages.modify.mockResolvedValue(mockResponse);

    await modifyLabels(
      {
        id: '18c123abc',
        addLabelIds: ['Label_99999'],
      },
      mockContext
    );

    expect(mockContext.cacheManager.invalidate).toHaveBeenCalledWith('gmail:getMessage:18c123abc');
    expect(mockContext.cacheManager.invalidate).toHaveBeenCalledWith('gmail:list');
  });

  test('logs with id parameter', async () => {
    const mockResponse = {
      data: {
        id: '18c123abc',
        labelIds: ['INBOX', 'Label_12345'],
      },
    };

    mockGmailApi.users.messages.modify.mockResolvedValue(mockResponse);

    await modifyLabels(
      {
        id: '18c123abc',
        addLabelIds: ['Label_12345'],
        removeLabelIds: ['UNREAD'],
      },
      mockContext
    );

    expect(mockContext.logger.info).toHaveBeenCalledWith(
      'Modified labels',
      expect.objectContaining({
        id: '18c123abc',
        added: 1,
        removed: 1,
      })
    );
  });

  test('tracks performance', async () => {
    const mockResponse = {
      data: {
        id: '18c123abc',
        labelIds: ['INBOX'],
      },
    };

    mockGmailApi.users.messages.modify.mockResolvedValue(mockResponse);

    await modifyLabels(
      {
        id: '18c123abc',
        removeLabelIds: ['UNREAD'],
      },
      mockContext
    );

    expect(mockContext.performanceMonitor.track).toHaveBeenCalledWith(
      'gmail:modifyLabels',
      expect.any(Number)
    );
  });

  test('handles add labels only', async () => {
    const mockResponse = {
      data: {
        id: '18c123abc',
        labelIds: ['INBOX', 'Label_12345', 'Label_67890'],
      },
    };

    mockGmailApi.users.messages.modify.mockResolvedValue(mockResponse);

    await modifyLabels(
      {
        id: '18c123abc',
        addLabelIds: ['Label_12345', 'Label_67890'],
      },
      mockContext
    );

    expect(mockGmailApi.users.messages.modify).toHaveBeenCalledWith(
      expect.objectContaining({
        requestBody: {
          addLabelIds: ['Label_12345', 'Label_67890'],
        },
      })
    );
  });

  test('handles remove labels only', async () => {
    const mockResponse = {
      data: {
        id: '18c123abc',
        labelIds: [],
      },
    };

    mockGmailApi.users.messages.modify.mockResolvedValue(mockResponse);

    await modifyLabels(
      {
        id: '18c123abc',
        removeLabelIds: ['UNREAD', 'INBOX'],
      },
      mockContext
    );

    expect(mockGmailApi.users.messages.modify).toHaveBeenCalledWith(
      expect.objectContaining({
        requestBody: {
          removeLabelIds: ['UNREAD', 'INBOX'],
        },
      })
    );
  });

  test('handles both add and remove', async () => {
    const mockResponse = {
      data: {
        id: '18c123abc',
        labelIds: ['Label_12345'],
      },
    };

    mockGmailApi.users.messages.modify.mockResolvedValue(mockResponse);

    await modifyLabels(
      {
        id: '18c123abc',
        addLabelIds: ['Label_12345'],
        removeLabelIds: ['UNREAD', 'INBOX'],
      },
      mockContext
    );

    expect(mockGmailApi.users.messages.modify).toHaveBeenCalledWith(
      expect.objectContaining({
        requestBody: {
          addLabelIds: ['Label_12345'],
          removeLabelIds: ['UNREAD', 'INBOX'],
        },
      })
    );
  });
});
