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

  // Range format variations
  describe('parseRangeInput', () => {
    it('parses sheet-qualified range correctly', () => {
      const result = parseRangeInput('Sheet1!A1');
      expect(result).toEqual({ sheetName: 'Sheet1', a1Range: 'A1' });
    });

    it('parses range without sheet name', () => {
      const result = parseRangeInput('A1:B5');
      expect(result).toEqual({ a1Range: 'A1:B5' });
    });

    it('handles range with only cell reference', () => {
      const result = parseRangeInput('Z99');
      expect(result).toEqual({ a1Range: 'Z99' });
    });

    it('throws error for empty range', () => {
      expect(() => parseRangeInput('')).toThrow('range cannot be empty');
    });

    it('throws error for range with only whitespace', () => {
      expect(() => parseRangeInput('   ')).toThrow('range cannot be empty');
    });

    it('throws error for range with sheet name but no coordinates', () => {
      expect(() => parseRangeInput('Sheet1!')).toThrow(
        'range must include cell coordinates after the sheet name'
      );
    });
  });

  // A1 notation parsing tests
  describe('parseA1Notation', () => {
    it('parses single cell reference', () => {
      const result = parseA1Notation('A1', 0);
      expect(result).toEqual({
        sheetId: 0,
        startRowIndex: 0,
        endRowIndex: 1,
        startColumnIndex: 0,
        endColumnIndex: 1,
      });
    });

    it('parses multi-cell range', () => {
      const result = parseA1Notation('A1:B5', 0);
      expect(result).toEqual({
        sheetId: 0,
        startRowIndex: 0,
        endRowIndex: 5,
        startColumnIndex: 0,
        endColumnIndex: 2,
      });
    });

    it('handles absolute references ($A$1)', () => {
      const result = parseA1Notation('$A$1', 0);
      expect(result).toEqual({
        sheetId: 0,
        startRowIndex: 0,
        endRowIndex: 1,
        startColumnIndex: 0,
        endColumnIndex: 1,
      });
    });

    it('handles column Z correctly', () => {
      const result = parseA1Notation('Z10', 0);
      expect(result).toEqual({
        sheetId: 0,
        startRowIndex: 9,
        endRowIndex: 10,
        startColumnIndex: 25,
        endColumnIndex: 26,
      });
    });

    it('handles two-letter columns (AA)', () => {
      const result = parseA1Notation('AA1', 0);
      expect(result).toEqual({
        sheetId: 0,
        startRowIndex: 0,
        endRowIndex: 1,
        startColumnIndex: 26,
        endColumnIndex: 27,
      });
    });

    it('throws error when range includes sheet name', () => {
      expect(() => parseA1Notation('Sheet1!A1', 0)).toThrow(
        'parseA1Notation expects a range without sheet name'
      );
    });

    it('throws error for invalid cell reference', () => {
      expect(() => parseA1Notation('Invalid', 0)).toThrow('Invalid A1 notation segment');
    });

    it('throws error when end is before start', () => {
      expect(() => parseA1Notation('B5:A1', 0)).toThrow(
        "Invalid A1 range 'B5:A1': end must be after start"
      );
    });

    it('throws error for empty range', () => {
      expect(() => parseA1Notation('', 0)).toThrow('range cannot be empty');
    });

    it('throws error for non-integer sheetId', () => {
      expect(() => parseA1Notation('A1', 1.5)).toThrow('sheetId must be an integer');
    });
  });

  // buildFormulaRows tests
  describe('buildFormulaRows', () => {
    it('builds single cell formula', () => {
      const gridRange = parseA1Notation('A1', 0);
      const rows = buildFormulaRows(gridRange, '=SUM(A2:A10)');

      expect(rows).toHaveLength(1);
      expect(rows[0]?.values).toHaveLength(1);
      expect(rows[0]?.values?.[0]?.userEnteredValue?.formulaValue).toBe('=SUM(A2:A10)');
    });

    it('builds multi-cell range formula', () => {
      const gridRange = parseA1Notation('A1:B3', 0);
      const rows = buildFormulaRows(gridRange, '=A1*2');

      expect(rows).toHaveLength(3); // 3 rows
      expect(rows[0]?.values).toHaveLength(2); // 2 columns
      expect(rows[2]?.values?.[1]?.userEnteredValue?.formulaValue).toBe('=A1*2');
    });

    it('throws error for empty formula', () => {
      const gridRange = parseA1Notation('A1', 0);
      expect(() => buildFormulaRows(gridRange, '')).toThrow('formula cannot be empty');
    });

    it('throws error for whitespace-only formula', () => {
      const gridRange = parseA1Notation('A1', 0);
      expect(() => buildFormulaRows(gridRange, '   ')).toThrow('formula cannot be empty');
    });

    it('trims whitespace from formula', () => {
      const gridRange = parseA1Notation('A1', 0);
      const rows = buildFormulaRows(gridRange, '  =SUM(A1:A5)  ');

      expect(rows[0]?.values?.[0]?.userEnteredValue?.formulaValue).toBe('=SUM(A1:A5)');
    });

    it('throws error for ranges exceeding maximum cell count', () => {
      // A1:ZZ1000 = 26*26*1000 = 676,000 cells (exceeds 10,000 limit)
      const gridRange = parseA1Notation('A1:ZZ1000', 0);
      expect(() => buildFormulaRows(gridRange, '=A1*2')).toThrow(
        /Range too large.*exceeds maximum/
      );
    });

    it('allows ranges at the maximum cell count limit', () => {
      // A1:J1000 = 10*1000 = 10,000 cells (exactly at limit)
      const gridRange = parseA1Notation('A1:J1000', 0);
      const rows = buildFormulaRows(gridRange, '=A1*2');

      expect(rows).toHaveLength(1000);
      expect(rows[0]?.values).toHaveLength(10);
    });
  });

  // getSheetId tests
  describe('getSheetId', () => {
    it('returns first sheet when no sheet name provided', async () => {
      mockSheets.spreadsheets.get.mockResolvedValue({
        data: {
          sheets: [
            { properties: { sheetId: 0, title: 'FirstSheet' } },
            { properties: { sheetId: 1, title: 'SecondSheet' } },
          ],
        },
      });

      const result = await getSheetId(
        mockSheets as unknown as sheets_v4.Sheets,
        'spreadsheet-123'
      );

      expect(result).toEqual({ sheetId: 0, title: 'FirstSheet' });
    });

    it('finds sheet by name', async () => {
      mockSheets.spreadsheets.get.mockResolvedValue({
        data: {
          sheets: [
            { properties: { sheetId: 0, title: 'FirstSheet' } },
            { properties: { sheetId: 1, title: 'TargetSheet' } },
          ],
        },
      });

      const result = await getSheetId(
        mockSheets as unknown as sheets_v4.Sheets,
        'spreadsheet-123',
        'TargetSheet'
      );

      expect(result).toEqual({ sheetId: 1, title: 'TargetSheet' });
    });

    it('throws error when no sheets exist', async () => {
      mockSheets.spreadsheets.get.mockResolvedValue({
        data: { sheets: [] },
      });

      await expect(
        getSheetId(mockSheets as unknown as sheets_v4.Sheets, 'spreadsheet-123')
      ).rejects.toThrow('No sheets found in spreadsheet spreadsheet-123');
    });
  });
});
