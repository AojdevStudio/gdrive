import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { updateRecords } from '../update.js';

describe('updateRecords', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockContext: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockSheetsApi: any;

  beforeEach(() => {
    mockSheetsApi = {
      spreadsheets: {
        values: {
          get: jest.fn<() => Promise<unknown>>(),
          update: jest.fn<() => Promise<unknown>>().mockResolvedValue({}),
        },
      },
    };
    mockContext = {
      sheets: mockSheetsApi,
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

  test('updates cells by matching key column', async () => {
    mockSheetsApi.spreadsheets.values.get.mockResolvedValue({
      data: {
        range: 'Contacts!A1:D3',
        values: [
          ['email', 'name', 'status', 'sentDate'],
          ['amy@example.com', 'Amy', 'pending', ''],
          ['bob@example.com', 'Bob', 'pending', ''],
        ],
      },
    });

    const result = await updateRecords({
      spreadsheetId: 'abc123',
      range: 'Contacts!A:D',
      keyColumn: 'email',
      updates: [
        { key: 'amy@example.com', values: { status: 'sent', sentDate: '2026-03-10' } },
      ],
    }, mockContext);

    expect(result.updated).toBe(1);
    // Should have called update for the matching row
    expect(mockSheetsApi.spreadsheets.values.update).toHaveBeenCalled();
  });

  test('reports not found keys', async () => {
    mockSheetsApi.spreadsheets.values.get.mockResolvedValue({
      data: {
        range: 'Sheet1!A1:B2',
        values: [
          ['email', 'status'],
          ['amy@example.com', 'pending'],
        ],
      },
    });

    const result = await updateRecords({
      spreadsheetId: 'abc123',
      range: 'Sheet1!A:B',
      keyColumn: 'email',
      updates: [
        { key: 'nonexistent@example.com', values: { status: 'sent' } },
      ],
    }, mockContext);

    expect(result.updated).toBe(0);
    expect(result.notFound).toEqual(['nonexistent@example.com']);
  });
});
