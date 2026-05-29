/**
 * Tests for Gmail label operations
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { createLabel, modifyLabels } from '../labels.js';

function makeContext(): { mockGmailApi: any; mockContext: any } {
  const mockGmailApi = {
    users: {
      labels: {
        create: jest.fn(),
        list: jest.fn(),
      },
      messages: {
        modify: jest.fn(),
      },
    },
  };

  const mockContext = {
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

  return { mockGmailApi, mockContext };
}

describe('createLabel', () => {
  test('creates a label with a trimmed name', async () => {
    const { mockGmailApi, mockContext } = makeContext();
    mockGmailApi.users.labels.create.mockResolvedValue({
      data: {
        id: 'Label_12345',
        name: 'Follow Up',
        type: 'user',
      },
    });

    await createLabel({ name: '  Follow Up  ' }, mockContext);

    expect(mockGmailApi.users.labels.create).toHaveBeenCalledWith({
      userId: 'me',
      requestBody: {
        name: 'Follow Up',
      },
    });
  });

  test('passes optional visibility and color fields', async () => {
    const { mockGmailApi, mockContext } = makeContext();
    mockGmailApi.users.labels.create.mockResolvedValue({
      data: {
        id: 'Label_12345',
        name: 'Follow Up',
        type: 'user',
        messageListVisibility: 'show',
        labelListVisibility: 'labelShow',
        color: {
          textColor: '#ffffff',
          backgroundColor: '#1a73e8',
        },
      },
    });

    const result = await createLabel(
      {
        name: 'Follow Up',
        messageListVisibility: 'show',
        labelListVisibility: 'labelShow',
        color: {
          textColor: '#ffffff',
          backgroundColor: '#1a73e8',
        },
      },
      mockContext
    );

    expect(mockGmailApi.users.labels.create).toHaveBeenCalledWith({
      userId: 'me',
      requestBody: {
        name: 'Follow Up',
        messageListVisibility: 'show',
        labelListVisibility: 'labelShow',
        color: {
          textColor: '#ffffff',
          backgroundColor: '#1a73e8',
        },
      },
    });
    expect(result).toMatchObject({
      id: 'Label_12345',
      name: 'Follow Up',
      type: 'user',
      message: 'Label created successfully',
    });
  });

  test('invalidates cached labels after creating a label', async () => {
    const { mockGmailApi, mockContext } = makeContext();
    mockGmailApi.users.labels.create.mockResolvedValue({
      data: {
        id: 'Label_12345',
        name: 'Follow Up',
        type: 'user',
      },
    });

    await createLabel({ name: 'Follow Up' }, mockContext);

    expect(mockContext.cacheManager.invalidate).toHaveBeenCalledWith('gmail:listLabels');
    expect(mockContext.performanceMonitor.track).toHaveBeenCalledWith(
      'gmail:createLabel',
      expect.any(Number)
    );
  });

  test('rejects empty label names before calling Gmail', async () => {
    const { mockGmailApi, mockContext } = makeContext();

    await expect(createLabel({ name: '   ' }, mockContext)).rejects.toThrow(
      'createLabel requires a non-empty name'
    );

    expect(mockGmailApi.users.labels.create).not.toHaveBeenCalled();
  });
});

describe('modifyLabels', () => {
  let mockContext: any;
  let mockGmailApi: any;

  beforeEach(() => {
    ({ mockGmailApi, mockContext } = makeContext());
  });

  test('modifies labels with messageId parameter', async () => {
    const mockResponse = {
      data: {
        id: '18c123abc',
        labelIds: ['INBOX', 'Label_12345'],
      },
    };

    mockGmailApi.users.messages.modify.mockResolvedValue(mockResponse);

    await modifyLabels(
      {
        messageId: '18c123abc',
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

  test('keeps id as a legacy alias for messageId', async () => {
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

  test('returns result with messageId and legacy id fields', async () => {
    const mockResponse = {
      data: {
        id: '18c123abc',
        labelIds: ['INBOX'],
      },
    };

    mockGmailApi.users.messages.modify.mockResolvedValue(mockResponse);

    const result = await modifyLabels(
      {
        messageId: '18c123abc',
        removeLabelIds: ['UNREAD'],
      },
      mockContext
    );

    expect(result.messageId).toBe('18c123abc');
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
        messageId: '18c123abc',
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
        messageId: '18c123abc',
        addLabelIds: ['Label_12345'],
        removeLabelIds: ['UNREAD'],
      },
      mockContext
    );

    expect(mockContext.logger.info).toHaveBeenCalledWith(
      'Modified labels',
      expect.objectContaining({
        id: '18c123abc',
        messageId: '18c123abc',
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
        messageId: '18c123abc',
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
        messageId: '18c123abc',
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
        messageId: '18c123abc',
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
        messageId: '18c123abc',
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

  test('throws when neither messageId nor id is provided', async () => {
    await expect(
      modifyLabels({ addLabelIds: ['Label_12345'] }, mockContext)
    ).rejects.toThrow('modifyLabels requires messageId');

    expect(mockGmailApi.users.messages.modify).not.toHaveBeenCalled();
  });
});
