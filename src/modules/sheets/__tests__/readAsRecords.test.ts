import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { readAsRecords } from '../read.js';

describe('readAsRecords', () => {
  let mockContext: any;
  let mockSheetsApi: any;

  beforeEach(() => {
    mockSheetsApi = {
      spreadsheets: {
        values: {
          get: jest.fn(),
        },
      },
    };
    mockContext = {
      sheets: mockSheetsApi,
      logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
      cacheManager: {
        get: jest.fn(() => Promise.resolve(null)),
        set: jest.fn(() => Promise.resolve(undefined)),
        invalidate: jest.fn(() => Promise.resolve(undefined)),
      },
      performanceMonitor: { track: jest.fn() },
      startTime: Date.now(),
    };
  });

  test('zips headers with rows into keyed objects', async () => {
    mockSheetsApi.spreadsheets.values.get.mockResolvedValue({
      data: {
        range: 'Contacts!A1:C3',
        values: [
          ['name', 'email', 'status'],
          ['Amy', 'amy@example.com', 'pending'],
          ['Bob', 'bob@example.com', 'sent'],
        ],
      },
    });

    const result = await readAsRecords({
      spreadsheetId: 'abc123',
      range: 'Contacts!A:C',
    }, mockContext);

    expect(result.records).toEqual([
      { name: 'Amy', email: 'amy@example.com', status: 'pending' },
      { name: 'Bob', email: 'bob@example.com', status: 'sent' },
    ]);
    expect(result.count).toBe(2);
    expect(result.columns).toEqual(['name', 'email', 'status']);
  });

  test('returns empty records for header-only sheet', async () => {
    mockSheetsApi.spreadsheets.values.get.mockResolvedValue({
      data: {
        range: 'Sheet1!A1:B1',
        values: [['name', 'email']],
      },
    });

    const result = await readAsRecords({
      spreadsheetId: 'abc123',
      range: 'Sheet1!A:B',
    }, mockContext);

    expect(result.records).toEqual([]);
    expect(result.count).toBe(0);
    expect(result.columns).toEqual(['name', 'email']);
  });

  test('maps sparse rows to null for missing values', async () => {
    mockSheetsApi.spreadsheets.values.get.mockResolvedValue({
      data: {
        range: 'Sheet1!A1:C2',
        values: [
          ['name', 'email', 'status'],
          ['Amy'],  // only 1 cell instead of 3
        ],
      },
    });

    const result = await readAsRecords({
      spreadsheetId: 'abc123',
      range: 'Sheet1!A:C',
    }, mockContext);

    expect(result.records).toEqual([
      { name: 'Amy', email: null, status: null },
    ]);
  });

  test('throws on empty sheet (no headers)', async () => {
    mockSheetsApi.spreadsheets.values.get.mockResolvedValue({
      data: { range: 'Sheet1!A1:A1', values: [] },
    });

    await expect(readAsRecords({
      spreadsheetId: 'abc123',
      range: 'Sheet1!A:C',
    }, mockContext)).rejects.toThrow('No header row found');
  });
});
