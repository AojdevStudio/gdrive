import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import type { sheets_v4 } from 'googleapis';
import {
  buildColumnDimensionRange,
  createColumnWidthRequests,
  createFreezeRequest,
  resolveSheetDetails,
} from '../../sheets/layoutHelpers.js';

type SheetsGetReturn = Promise<{ data: { sheets: sheets_v4.Schema$Sheet[] } }>;
type SheetsGetFn = (params: sheets_v4.Params$Resource$Spreadsheets$Get) => SheetsGetReturn;

describe('layout helpers', () => {
  let sheetsData: sheets_v4.Schema$Sheet[];
  let getMock: jest.MockedFunction<SheetsGetFn>;
  let sheetsClient: sheets_v4.Sheets;

  beforeEach(() => {
    sheetsData = [
      {
        properties: {
          sheetId: 101,
          title: 'Summary',
          index: 0,
        },
      },
      {
        properties: {
          sheetId: 202,
          title: 'Data',
          index: 1,
        },
      },
    ];

    getMock = jest.fn<SheetsGetFn>(async () => ({ data: { sheets: sheetsData } }));
    sheetsClient = { spreadsheets: { get: getMock } } as unknown as sheets_v4.Sheets;
  });

  describe('resolveSheetDetails', () => {
    it('returns the first sheet when sheetName is not provided', async () => {
      const result = await resolveSheetDetails({
        sheetsClient,
        spreadsheetId: 'spreadsheet-1',
      });

      expect(getMock).toHaveBeenCalledWith({
        spreadsheetId: 'spreadsheet-1',
        fields: 'sheets(properties(sheetId,title))',
      });
      expect(result).toEqual({ sheetId: 101, title: 'Summary' });
    });

    it('returns the matching sheet when sheetName is provided', async () => {
      const result = await resolveSheetDetails({
        sheetsClient,
        spreadsheetId: 'spreadsheet-1',
        sheetName: 'Data',
      });

      expect(result).toEqual({ sheetId: 202, title: 'Data' });
    });

    it('throws when the requested sheet cannot be found', async () => {
      await expect(
        resolveSheetDetails({
          sheetsClient,
          spreadsheetId: 'spreadsheet-1',
          sheetName: 'DoesNotExist',
        }),
      ).rejects.toThrow('Sheet "DoesNotExist" not found in spreadsheet spreadsheet-1');
    });
  });

  describe('createFreezeRequest', () => {
    it('builds an updateSheetProperties request for combined freezing', () => {
      const request = createFreezeRequest(101, 2, 1);

      expect(request).toEqual({
        updateSheetProperties: {
          properties: {
            sheetId: 101,
            gridProperties: {
              frozenRowCount: 2,
              frozenColumnCount: 1,
            },
          },
          fields: 'gridProperties.frozenRowCount,gridProperties.frozenColumnCount',
        },
      });
    });
  });

  describe('createColumnWidthRequests', () => {
    it('creates a single column width request with default width', () => {
      const requests = createColumnWidthRequests(101, [
        { columnIndex: 0 },
      ]);

      expect(requests).toHaveLength(1);
      expect(requests[0]).toEqual({
        updateDimensionProperties: {
          range: buildColumnDimensionRange(101, 0, 1),
          properties: { pixelSize: 100 },
          fields: 'pixelSize',
        },
      });
    });

    it('creates multiple column width requests with custom widths', () => {
      const requests = createColumnWidthRequests(202, [
        { columnIndex: 1, width: 180 },
        { columnIndex: 3, width: 220 },
      ]);

      expect(requests).toHaveLength(2);
      expect(requests[0]).toEqual({
        updateDimensionProperties: {
          range: buildColumnDimensionRange(202, 1, 1),
          properties: { pixelSize: 180 },
          fields: 'pixelSize',
        },
      });
      expect(requests[1]).toEqual({
        updateDimensionProperties: {
          range: buildColumnDimensionRange(202, 3, 1),
          properties: { pixelSize: 220 },
          fields: 'pixelSize',
        },
      });
    });
  });
});
