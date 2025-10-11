import { jest } from '@jest/globals';
import type { sheets_v4 } from 'googleapis';
import {
  buildFormulaRows,
  getSheetId,
  parseA1Notation,
  parseRangeInput,
} from '../sheets/helpers.js';

type SheetsClientMock = {
  spreadsheets: {
    get: jest.MockedFunction<SheetsGetFn>;
    batchUpdate: jest.MockedFunction<SheetsBatchUpdateFn>;
  };
};

type SheetsGetFn = (params?: unknown) => Promise<unknown>;
type SheetsBatchUpdateFn = (params?: unknown) => Promise<unknown>;

describe('updateCellsWithFormula helpers', () => {
  let mockSheets: SheetsClientMock;

  beforeEach(() => {
    jest.clearAllMocks();

    mockSheets = {
      spreadsheets: {
        get: jest.fn<SheetsGetFn>(),
        batchUpdate: jest.fn<SheetsBatchUpdateFn>(),
      },
    };
  });

  it('builds the correct batchUpdate request for a single cell formula', async () => {
    mockSheets.spreadsheets.get.mockResolvedValue({
      data: {
        sheets: [
          {
            properties: {
              sheetId: 42,
              title: 'Sheet1',
            },
          },
        ],
      },
    });

    const { sheetName, a1Range } = parseRangeInput('Sheet1!N25');
    const { sheetId, title } = await getSheetId(
      mockSheets as unknown as sheets_v4.Sheets,
      'spreadsheet-123',
      sheetName
    );
    const gridRange = parseA1Notation(a1Range, sheetId);
    const rows = buildFormulaRows(gridRange, '=SUM(N2:N24)');

    mockSheets.spreadsheets.batchUpdate.mockResolvedValue({ data: {} });
    await mockSheets.spreadsheets.batchUpdate({
      spreadsheetId: 'spreadsheet-123',
      requestBody: {
        requests: [
          {
            updateCells: {
              range: gridRange,
              fields: 'userEnteredValue',
              rows,
            },
          },
        ],
      },
    });

    expect(mockSheets.spreadsheets.get).toHaveBeenCalledWith({ spreadsheetId: 'spreadsheet-123' });
    expect(mockSheets.spreadsheets.batchUpdate).toHaveBeenCalledWith({
      spreadsheetId: 'spreadsheet-123',
      requestBody: {
        requests: [
          {
            updateCells: {
              range: {
                sheetId: 42,
                startRowIndex: 24,
                endRowIndex: 25,
                startColumnIndex: 13,
                endColumnIndex: 14,
              },
              fields: 'userEnteredValue',
              rows: [
                {
                  values: [
                    {
                      userEnteredValue: {
                        formulaValue: '=SUM(N2:N24)',
                      },
                    },
                  ],
                },
              ],
            },
          },
        ],
      },
    });
    expect(title).toBe('Sheet1');
  });

  it('throws a validation error when the requested sheet does not exist', async () => {
    mockSheets.spreadsheets.get.mockResolvedValue({
      data: {
        sheets: [
          {
            properties: {
              sheetId: 1,
              title: 'ExistingSheet',
            },
          },
        ],
      },
    });

    await expect(
      getSheetId(mockSheets as unknown as sheets_v4.Sheets, 'spreadsheet-123', 'MissingSheet')
    ).rejects.toThrow("Sheet 'MissingSheet' not found in spreadsheet spreadsheet-123");
  });

  it('rejects formulas without a leading equals sign', () => {
    const gridRange = parseA1Notation('A1', 0);
    expect(() => buildFormulaRows(gridRange, 'SUM(A1:A3)')).toThrow('formula must start with "="');
  });
});
