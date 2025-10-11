import { jest } from '@jest/globals';
import {
  mergeCellsTool,
  setDataValidationTool,
  createChartTool,
} from '../../sheets/advanced-tools.js';

describe('Google Sheets advanced tools', () => {
  let mockSheets: any;
  let mockCache: any;
  let mockPerformance: any;
  let mockLogger: any;
  let nowSpy: jest.SpiedFunction<typeof Date.now>;

  const buildContext = () => ({
    sheets: mockSheets,
    cache: mockCache,
    performance: mockPerformance,
    logger: mockLogger,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    nowSpy = jest.spyOn(Date, 'now').mockReturnValue(2_000);

    mockSheets = {
      spreadsheets: {
        get: jest.fn(() =>
          Promise.resolve({
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
          })
        ),
        batchUpdate: jest.fn(() => Promise.resolve({})),
      },
    };

    mockCache = {
      invalidate: jest.fn(() => Promise.resolve(undefined)),
    };

    mockPerformance = {
      track: jest.fn(),
    };

    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };
  });

  afterEach(() => {
    nowSpy.mockRestore();
  });

  it('builds a mergeCells batch request with resolved sheet ID', async () => {
    const args = {
      spreadsheetId: 'spreadsheet-123',
      range: 'Sheet1!A1:B2',
      mergeType: 'MERGE_ROWS' as const,
    };

    const result = await mergeCellsTool(args, buildContext(), 1_000);

    expect(mockSheets.spreadsheets.get).toHaveBeenCalledWith({
      spreadsheetId: 'spreadsheet-123',
      fields: 'sheets.properties(sheetId,title)',
    });

    expect(mockSheets.spreadsheets.batchUpdate).toHaveBeenCalledWith({
      spreadsheetId: 'spreadsheet-123',
      requestBody: {
        requests: [
          {
            mergeCells: {
              mergeType: 'MERGE_ROWS',
              range: {
                sheetId: 42,
                startRowIndex: 0,
                endRowIndex: 2,
                startColumnIndex: 0,
                endColumnIndex: 2,
              },
            },
          },
        ],
      },
    });

    expect(mockCache.invalidate).toHaveBeenCalledWith('sheet:spreadsheet-123:*');
    expect(mockPerformance.track).toHaveBeenCalledWith('mergeCells', expect.any(Number));
    expect(result.content?.[0]?.text).toContain('MERGE_ROWS');
  });

  it('logs and rethrows merge errors with context', async () => {
    mockSheets.spreadsheets.batchUpdate.mockRejectedValueOnce(new Error('merge failed'));

    await expect(
      mergeCellsTool(
        { spreadsheetId: 'sheet', range: 'Sheet1!A1:A2' },
        buildContext(),
        1_000
      )
    ).rejects.toThrow('Failed to merge cells in range Sheet1!A1:A2: merge failed');

    const performanceCalls = mockPerformance.track.mock.calls as Array<
      [string, number, boolean?]
    >;
    const errorCall = performanceCalls.find(
      (call) => call[0] === 'mergeCells' && call[2] === true
    );
    expect(errorCall?.[2]).toBe(true);
    expect(mockLogger.error).toHaveBeenCalledWith('mergeCells tool failed', expect.objectContaining({
      spreadsheetId: 'sheet',
    }));
  });

  it('applies dropdown validation with values converted to userEnteredValue', async () => {
    const args = {
      spreadsheetId: 'spreadsheet-123',
      range: 'Sheet1!F2:F24',
      validation: {
        type: 'LIST_OF_VALUES' as const,
        values: ['Layer 1', 'Layer 2'],
        showDropdown: true,
        strict: false,
      },
    };

    await setDataValidationTool(args, buildContext(), 1_000);

    const request = mockSheets.spreadsheets.batchUpdate.mock.calls[0][0];
    expect(request).toEqual({
      spreadsheetId: 'spreadsheet-123',
      requestBody: {
        requests: [
          {
            setDataValidation: {
              range: {
                sheetId: 42,
                startRowIndex: 1,
                endRowIndex: 24,
                startColumnIndex: 5,
                endColumnIndex: 6,
              },
              rule: {
                condition: {
                  type: 'LIST_OF_VALUES',
                  values: [
                    { userEnteredValue: 'Layer 1' },
                    { userEnteredValue: 'Layer 2' },
                  ],
                },
                strict: false,
                showCustomUi: true,
              },
            },
          },
        ],
      },
    });
  });

  it('throws validation errors before calling the API when values are missing', async () => {
    await expect(
      setDataValidationTool(
        {
          spreadsheetId: 'spreadsheet-123',
          range: 'Sheet1!A1:A5',
          validation: { type: 'LIST_OF_VALUES' },
        },
        buildContext(),
        1_000
      )
    ).rejects.toThrow('validation.values must be a non-empty array for LIST_OF_VALUES');

    expect(mockSheets.spreadsheets.batchUpdate).not.toHaveBeenCalled();
  });

  it('creates a basic chart with domain and series ranges split by column', async () => {
    const args = {
      spreadsheetId: 'spreadsheet-123',
      sheetName: 'Sheet1',
      chartType: 'LINE',
      dataRange: 'Sheet1!A1:C10',
      position: { row: 15, column: 1 },
      title: 'Monthly Income',
    };

    await createChartTool(args, buildContext(), 1_000);

    const request = mockSheets.spreadsheets.batchUpdate.mock.calls[0][0];
    expect(request.requestBody.requests[0]).toEqual({
      addChart: {
        chart: {
          spec: {
            title: 'Monthly Income',
            basicChart: {
              chartType: 'LINE',
              domains: [
                {
                  domain: {
                    sourceRange: {
                      sources: [
                        {
                          sheetId: 42,
                          startRowIndex: 0,
                          endRowIndex: 10,
                          startColumnIndex: 0,
                          endColumnIndex: 1,
                        },
                      ],
                    },
                  },
                },
              ],
              series: [
                {
                  series: {
                    sourceRange: {
                      sources: [
                        {
                          sheetId: 42,
                          startRowIndex: 0,
                          endRowIndex: 10,
                          startColumnIndex: 1,
                          endColumnIndex: 2,
                        },
                      ],
                    },
                  },
                },
                {
                  series: {
                    sourceRange: {
                      sources: [
                        {
                          sheetId: 42,
                          startRowIndex: 0,
                          endRowIndex: 10,
                          startColumnIndex: 2,
                          endColumnIndex: 3,
                        },
                      ],
                    },
                  },
                },
              ],
            },
          },
          position: {
            overlayPosition: {
              anchorCell: {
                sheetId: 42,
                rowIndex: 15,
                columnIndex: 1,
              },
            },
          },
        },
      },
    });
  });

  it('rejects chart creation when the range lacks sufficient columns', async () => {
    await expect(
      createChartTool(
        {
          spreadsheetId: 'spreadsheet-123',
          chartType: 'COLUMN',
          dataRange: 'Sheet1!A1:A10',
          position: { row: 0, column: 0 },
        },
        buildContext(),
        1_000
      )
    ).rejects.toThrow('dataRange must include at least two columns for charting');

    expect(mockSheets.spreadsheets.batchUpdate).not.toHaveBeenCalled();
  });
});

