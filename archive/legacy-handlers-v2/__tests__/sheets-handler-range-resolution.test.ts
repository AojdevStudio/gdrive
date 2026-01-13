import { jest } from '@jest/globals';
import type { sheets_v4 } from 'googleapis';
import { handleSheetsTool } from '../sheets/sheets-handler.js';
import type { Logger } from 'winston';

const createContext = () => {
  const spreadsheetsGet = jest.fn(async () => ({}));
  const spreadsheetsBatchUpdate = jest.fn(async () => ({}));
  const spreadsheetsValuesGet = jest.fn(async () => ({}));
  const spreadsheetsValuesUpdate = jest.fn(async () => ({}));
  const spreadsheetsValuesAppend = jest.fn(async () => ({}));

  const sheets = {
    spreadsheets: {
      get: spreadsheetsGet,
      batchUpdate: spreadsheetsBatchUpdate,
      values: {
        get: spreadsheetsValuesGet,
        update: spreadsheetsValuesUpdate,
        append: spreadsheetsValuesAppend,
      },
    },
  } as unknown as sheets_v4.Sheets;

  const cacheManager = {
    get: jest.fn(async () => null),
    set: jest.fn(async () => undefined),
    invalidate: jest.fn(async () => undefined),
  };

  const performanceMonitor = {
    track: jest.fn(),
  };

  const logger = {
    info: jest.fn(),
    error: jest.fn(),
  } as unknown as Logger;

  const context = {
    logger,
    sheets,
    cacheManager,
    performanceMonitor,
    startTime: 0,
  };

  return {
    context,
    cacheManager,
    performanceMonitor,
    logger,
    mocks: {
      spreadsheetsGet,
      spreadsheetsBatchUpdate,
      spreadsheetsValuesGet,
      spreadsheetsValuesUpdate,
      spreadsheetsValuesAppend,
    },
  };
};

describe('handleSheetsTool range resolution', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uses sheetName parameter when range omits sheet for read operations', async () => {
    const { context, mocks, cacheManager } = createContext();

    mocks.spreadsheetsGet.mockResolvedValue({
      data: {
        sheets: [
          {
            properties: {
              sheetId: 7,
              title: 'Budget',
            },
          },
        ],
      },
    });

    mocks.spreadsheetsValuesGet.mockResolvedValue({
      data: {
        range: 'Budget!A1',
        values: [],
      },
    });

    await handleSheetsTool(
      {
        operation: 'read',
        spreadsheetId: 'spreadsheet-1',
        range: 'A1',
        sheetName: 'Budget',
      },
      context,
    );

    expect(mocks.spreadsheetsValuesGet).toHaveBeenCalledWith({
      spreadsheetId: 'spreadsheet-1',
      range: 'Budget!A1',
    });
    expect(cacheManager.set).toHaveBeenCalled();
  });

  it('resolves sheetId to a sheet title when range omits sheet', async () => {
    const { context, mocks } = createContext();

    mocks.spreadsheetsGet.mockResolvedValue({
      data: {
        sheets: [
          {
            properties: {
              sheetId: 99,
              title: 'Summary',
            },
          },
        ],
      },
    });

    mocks.spreadsheetsValuesGet.mockResolvedValue({
      data: {
        range: 'Summary!B2',
        values: [['value']],
      },
    });

    await handleSheetsTool(
      {
        operation: 'read',
        spreadsheetId: 'spreadsheet-2',
        range: 'B2',
        sheetId: 99,
      },
      context,
    );

    expect(mocks.spreadsheetsValuesGet).toHaveBeenCalledWith({
      spreadsheetId: 'spreadsheet-2',
      range: 'Summary!B2',
    });
  });

  it('throws when sheetName conflicts with range sheet', async () => {
    const { context } = createContext();

    await expect(
      handleSheetsTool(
        {
          operation: 'read',
          spreadsheetId: 'spreadsheet-3',
          range: 'Actuals!C1',
          sheetName: 'Budget',
        },
        context,
      ),
    ).rejects.toThrow('sheetName does not match the sheet specified in range');
  });

  it('applies sheet resolution for update operations', async () => {
    const { context, mocks, cacheManager } = createContext();

    mocks.spreadsheetsGet.mockResolvedValue({
      data: {
        sheets: [
          {
            properties: {
              sheetId: 12,
              title: 'Invoices',
            },
          },
        ],
      },
    });

    mocks.spreadsheetsValuesUpdate.mockResolvedValue({});

    await handleSheetsTool(
      {
        operation: 'update',
        spreadsheetId: 'spreadsheet-4',
        range: 'D5:E5',
        values: [[1, 2]],
        sheetId: 12,
      },
      context,
    );

    expect(mocks.spreadsheetsValuesUpdate).toHaveBeenCalledWith({
      spreadsheetId: 'spreadsheet-4',
      range: 'Invoices!D5:E5',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[1, 2]],
      },
    });
    expect(cacheManager.invalidate).toHaveBeenCalledWith('sheet:spreadsheet-4:*');
  });
});
