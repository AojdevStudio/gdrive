import { jest } from '@jest/globals';
import { google } from 'googleapis';

describe('Sheet management tools', () => {
  let mockSheets: any;
  let mockCacheManager: any;
  let mockPerformanceMonitor: any;
  let mockLogger: any;
  let callTool: (toolName: string, args: any) => Promise<any>;

  const toErrorMessage = (error: unknown): string => {
    if (error instanceof Error) {
      return error.message;
    }
    if (typeof error === 'string') {
      return error;
    }
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockSheets = {
      spreadsheets: {
        batchUpdate: jest.fn((request: any) => {
          const addSheet = request?.requestBody?.requests?.[0]?.addSheet;
          if (addSheet) {
            const title = addSheet.properties?.title ?? 'New Sheet';
            return Promise.resolve({
              data: {
                replies: [
                  {
                    addSheet: {
                      properties: {
                        sheetId: 123456,
                        title,
                        gridProperties: {
                          rowCount: addSheet.properties?.gridProperties?.rowCount ?? 1000,
                          columnCount: addSheet.properties?.gridProperties?.columnCount ?? 26,
                        },
                      },
                    },
                  },
                ],
              },
            });
          }

          return Promise.resolve({ data: {} });
        }),
        get: jest.fn(() =>
          Promise.resolve({
            data: {
              sheets: [
                { properties: { sheetId: 123456, title: 'Existing Sheet' } },
                { properties: { sheetId: 654321, title: 'Archive' } },
              ],
            },
          }),
        ),
      },
    };

    (google.sheets as any).mockReturnValue(mockSheets);

    mockCacheManager = {
      get: jest.fn(() => Promise.resolve(null)),
      set: jest.fn(() => Promise.resolve(undefined)),
      invalidate: jest.fn(() => Promise.resolve(undefined)),
      flush: jest.fn(() => Promise.resolve(undefined)),
    };

    mockPerformanceMonitor = {
      track: jest.fn(),
      getStats: jest.fn().mockReturnValue({}),
      reset: jest.fn(),
    };

    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };

    const resolveSheetMetadata = async (
      spreadsheetId: string,
      identifiers: { sheetId?: unknown; sheetName?: unknown; title?: unknown },
      operation: string,
    ): Promise<{ sheetId: number; title?: string }> => {
      let numericId: number | undefined;
      if (typeof identifiers.sheetId === 'number') {
        numericId = identifiers.sheetId;
      } else if (typeof identifiers.sheetId === 'string' && identifiers.sheetId.trim() !== '') {
        const parsed = Number(identifiers.sheetId);
        if (Number.isNaN(parsed)) {
          throw new Error(`${operation} requires sheetId to be a number`);
        }
        numericId = parsed;
      }

      const providedName =
        typeof identifiers.sheetName === 'string' && identifiers.sheetName.trim() !== ''
          ? identifiers.sheetName
          : typeof identifiers.title === 'string' && identifiers.title.trim() !== ''
            ? identifiers.title
            : undefined;

      if (numericId !== undefined) {
        const result: { sheetId: number; title?: string } = { sheetId: numericId };
        if (providedName !== undefined) {
          result.title = providedName;
        }
        return result;
      }

      if (!providedName) {
        throw new Error(`${operation} requires either sheetId or sheetName`);
      }

      let response;
      try {
        response = await mockSheets.spreadsheets.get({
          spreadsheetId,
          fields: 'sheets(properties(sheetId,title))',
        });
      } catch (error) {
        mockLogger.error('Failed to resolve sheet ID', { spreadsheetId, sheetName: providedName, operation, error });
        throw new Error(
          `Failed to resolve sheet ID for "${providedName}" in spreadsheet ${spreadsheetId}: ${toErrorMessage(error)}`,
        );
      }

      const match = response.data.sheets?.find((sheet: any) => sheet.properties?.title === providedName);
      if (!match?.properties?.sheetId) {
        throw new Error(`Sheet "${providedName}" not found in spreadsheet ${spreadsheetId}`);
      }

      const result: { sheetId: number; title?: string } = { sheetId: match.properties.sheetId };
      const resolvedTitle = match.properties.title ?? providedName;
      if (resolvedTitle !== undefined) {
        result.title = resolvedTitle;
      }

      return result;
    };

    callTool = async (toolName: string, args: any) => {
      if (!args || typeof args.spreadsheetId !== 'string') {
        throw new Error('spreadsheetId parameter is required');
      }

      const startTime = Date.now();
      const { spreadsheetId } = args;

      switch (toolName) {
        case 'createSheet': {
          const sheetProperties: Record<string, any> = {};

          const sheetName = typeof args.sheetName === 'string' && args.sheetName.trim() !== '' ? args.sheetName : undefined;
          const legacyTitle = typeof args.title === 'string' && args.title.trim() !== '' ? args.title : undefined;
          const effectiveTitle = sheetName ?? legacyTitle;
          if (effectiveTitle) {
            sheetProperties.title = effectiveTitle;
          }

          if (typeof args.index === 'number') {
            sheetProperties.index = args.index;
          }
          if (typeof args.hidden === 'boolean') {
            sheetProperties.hidden = args.hidden;
          }
          if (typeof args.rightToLeft === 'boolean') {
            sheetProperties.rightToLeft = args.rightToLeft;
          }

          const rowCount = typeof args.rowCount === 'number' ? args.rowCount : 1000;
          const columnCount = typeof args.columnCount === 'number' ? args.columnCount : 26;
          const gridProperties: Record<string, any> = {
            rowCount,
            columnCount,
          };
          if (typeof args.frozenRowCount === 'number') {
            gridProperties.frozenRowCount = args.frozenRowCount;
          }
          if (typeof args.frozenColumnCount === 'number') {
            gridProperties.frozenColumnCount = args.frozenColumnCount;
          }
          sheetProperties.gridProperties = gridProperties;

          if (args.tabColor && typeof args.tabColor === 'object') {
            const color = args.tabColor as Record<string, unknown>;
            const validatedColor: Record<string, number> = {};
            (['red', 'green', 'blue', 'alpha'] as const).forEach((channel) => {
              const value = color[channel];
              if (value !== undefined) {
                if (typeof value !== 'number' || Number.isNaN(value) || value < 0 || value > 1) {
                  throw new Error(`tabColor.${channel} must be a number between 0 and 1`);
                }
                validatedColor[channel] = value;
              }
            });
            if (Object.keys(validatedColor).length > 0) {
              sheetProperties.tabColor = validatedColor;
            }
          }

          let response;
          try {
            response = await mockSheets.spreadsheets.batchUpdate({
              spreadsheetId,
              requestBody: {
                requests: [
                  {
                    addSheet: {
                      properties: sheetProperties,
                    },
                  },
                ],
              },
            });
          } catch (error) {
            mockPerformanceMonitor.track('createSheet', Date.now() - startTime, true);
            mockLogger.error('Failed to create sheet with batchUpdate', { spreadsheetId, error });
            throw new Error(`Failed to create sheet in spreadsheet ${spreadsheetId}: ${toErrorMessage(error)}`);
          }

          const newSheetId = response.data.replies?.[0]?.addSheet?.properties?.sheetId;
          const newSheetTitle =
            response.data.replies?.[0]?.addSheet?.properties?.title ?? sheetProperties.title ?? 'Untitled Sheet';

          const resolved = await resolveSheetMetadata(
            spreadsheetId,
            { sheetId: typeof newSheetId === 'number' ? newSheetId : undefined, sheetName: newSheetTitle, title: newSheetTitle },
            'createSheet',
          );

          await mockCacheManager.invalidate(`sheet:${spreadsheetId}:*`);
          mockPerformanceMonitor.track('createSheet', Date.now() - startTime);
          mockLogger.info('Sheet created', { spreadsheetId, sheetId: resolved.sheetId, title: resolved.title });

          return {
            content: [
              {
                type: 'text',
                text: `Successfully created sheet "${resolved.title}" with ID ${resolved.sheetId} in spreadsheet ${spreadsheetId}`,
              },
            ],
          };
        }

        case 'renameSheet': {
          if (typeof args.newName !== 'string' || args.newName.trim() === '') {
            throw new Error('newName parameter is required');
          }

          const resolved = await resolveSheetMetadata(
            spreadsheetId,
            {
              sheetId: args.sheetId,
              sheetName: args.sheetName,
              title: args.title,
            },
            'renameSheet',
          );

          try {
            await mockSheets.spreadsheets.batchUpdate({
              spreadsheetId,
              requestBody: {
                requests: [
                  {
                    updateSheetProperties: {
                      properties: {
                        sheetId: resolved.sheetId,
                        title: args.newName,
                      },
                      fields: 'title',
                    },
                  },
                ],
              },
            });
          } catch (error) {
            mockPerformanceMonitor.track('renameSheet', Date.now() - startTime, true);
            mockLogger.error('Failed to rename sheet', { spreadsheetId, sheetId: resolved.sheetId, error });
            throw new Error(`Failed to rename sheet ${resolved.sheetId} in spreadsheet ${spreadsheetId}: ${toErrorMessage(error)}`);
          }

          await mockCacheManager.invalidate(`sheet:${spreadsheetId}:*`);
          mockPerformanceMonitor.track('renameSheet', Date.now() - startTime);
          mockLogger.info('Sheet renamed', {
            spreadsheetId,
            sheetId: resolved.sheetId,
            previousTitle: resolved.title,
            newTitle: args.newName,
          });

          return {
            content: [
              {
                type: 'text',
                text: `Successfully renamed sheet ${resolved.sheetId} to "${args.newName}" in spreadsheet ${spreadsheetId}`,
              },
            ],
          };
        }

        case 'deleteSheet': {
          const resolved = await resolveSheetMetadata(
            spreadsheetId,
            {
              sheetId: args.sheetId,
              sheetName: args.sheetName,
              title: args.title,
            },
            'deleteSheet',
          );

          try {
            await mockSheets.spreadsheets.batchUpdate({
              spreadsheetId,
              requestBody: {
                requests: [
                  {
                    deleteSheet: {
                      sheetId: resolved.sheetId,
                    },
                  },
                ],
              },
            });
          } catch (error) {
            mockPerformanceMonitor.track('deleteSheet', Date.now() - startTime, true);
            mockLogger.error('Failed to delete sheet', { spreadsheetId, sheetId: resolved.sheetId, error });
            throw new Error(`Failed to delete sheet ${resolved.sheetId} in spreadsheet ${spreadsheetId}: ${toErrorMessage(error)}`);
          }

          await mockCacheManager.invalidate(`sheet:${spreadsheetId}:*`);
          mockPerformanceMonitor.track('deleteSheet', Date.now() - startTime);
          mockLogger.info('Sheet deleted', {
            spreadsheetId,
            sheetId: resolved.sheetId,
            title: resolved.title,
          });

          return {
            content: [
              {
                type: 'text',
                text: `Successfully deleted sheet ${resolved.sheetId} from spreadsheet ${spreadsheetId}`,
              },
            ],
          };
        }

        default:
          throw new Error(`Unknown tool: ${toolName}`);
      }
    };
  });

  it('creates a sheet using sheetName alias and default dimensions', async () => {
    const result = await callTool('createSheet', {
      spreadsheetId: 'sheet-123',
      sheetName: 'Finance',
    });

    expect(mockSheets.spreadsheets.batchUpdate).toHaveBeenCalledWith({
      spreadsheetId: 'sheet-123',
      requestBody: {
        requests: [
          {
            addSheet: {
              properties: {
                title: 'Finance',
                gridProperties: {
                  rowCount: 1000,
                  columnCount: 26,
                },
              },
            },
          },
        ],
      },
    });
    expect(mockSheets.spreadsheets.get).not.toHaveBeenCalled();
    expect(mockCacheManager.invalidate).toHaveBeenCalledWith('sheet:sheet-123:*');
    expect(mockPerformanceMonitor.track).toHaveBeenCalledWith('createSheet', expect.any(Number));
    expect(mockLogger.info).toHaveBeenCalledWith('Sheet created', {
      spreadsheetId: 'sheet-123',
      sheetId: 123456,
      title: 'Finance',
    });
    expect(result.content[0].text).toContain('Finance');
  });

  it('creates a sheet with custom grid settings', async () => {
    await callTool('createSheet', {
      spreadsheetId: 'sheet-123',
      title: 'Analytics',
      rowCount: 200,
      columnCount: 12,
      frozenRowCount: 1,
      frozenColumnCount: 2,
    });

    expect(mockSheets.spreadsheets.batchUpdate).toHaveBeenCalledWith({
      spreadsheetId: 'sheet-123',
      requestBody: {
        requests: [
          {
            addSheet: {
              properties: {
                title: 'Analytics',
                gridProperties: {
                  rowCount: 200,
                  columnCount: 12,
                  frozenRowCount: 1,
                  frozenColumnCount: 2,
                },
              },
            },
          },
        ],
      },
    });
  });

  it('renames a sheet by sheetId without lookup', async () => {
    await callTool('renameSheet', {
      spreadsheetId: 'sheet-123',
      sheetId: 123456,
      newName: 'Summary',
    });

    expect(mockSheets.spreadsheets.get).not.toHaveBeenCalled();
    expect(mockSheets.spreadsheets.batchUpdate).toHaveBeenCalledWith({
      spreadsheetId: 'sheet-123',
      requestBody: {
        requests: [
          {
            updateSheetProperties: {
              properties: {
                sheetId: 123456,
                title: 'Summary',
              },
              fields: 'title',
            },
          },
        ],
      },
    });
    expect(mockLogger.info).toHaveBeenCalledWith('Sheet renamed', {
      spreadsheetId: 'sheet-123',
      sheetId: 123456,
      previousTitle: undefined,
      newTitle: 'Summary',
    });
  });

  it('renames a sheet using sheetName lookup when ID missing', async () => {
    await callTool('renameSheet', {
      spreadsheetId: 'sheet-123',
      sheetName: 'Existing Sheet',
      newName: 'Executive Overview',
    });

    expect(mockSheets.spreadsheets.get).toHaveBeenCalledWith({
      spreadsheetId: 'sheet-123',
      fields: 'sheets(properties(sheetId,title))',
    });
    expect(mockSheets.spreadsheets.batchUpdate).toHaveBeenCalledWith({
      spreadsheetId: 'sheet-123',
      requestBody: {
        requests: [
          {
            updateSheetProperties: {
              properties: {
                sheetId: 123456,
                title: 'Executive Overview',
              },
              fields: 'title',
            },
          },
        ],
      },
    });
  });

  it('throws an error when renameSheet lacks identifiers', async () => {
    await expect(
      callTool('renameSheet', {
        spreadsheetId: 'sheet-123',
        newName: 'No Identifier',
      }),
    ).rejects.toThrow('renameSheet requires either sheetId or sheetName');
  });

  it('deletes a sheet and invalidates cache', async () => {
    await callTool('deleteSheet', {
      spreadsheetId: 'sheet-123',
      sheetName: 'Archive',
    });

    expect(mockSheets.spreadsheets.get).toHaveBeenCalled();
    expect(mockSheets.spreadsheets.batchUpdate).toHaveBeenCalledWith({
      spreadsheetId: 'sheet-123',
      requestBody: {
        requests: [
          {
            deleteSheet: {
              sheetId: 654321,
            },
          },
        ],
      },
    });
    expect(mockCacheManager.invalidate).toHaveBeenCalledWith('sheet:sheet-123:*');
    expect(mockLogger.info).toHaveBeenCalledWith('Sheet deleted', {
      spreadsheetId: 'sheet-123',
      sheetId: 654321,
      title: 'Archive',
    });
  });

  it('propagates deleteSheet errors when sheet is missing', async () => {
    mockSheets.spreadsheets.get.mockResolvedValueOnce({ data: { sheets: [] } });

    await expect(
      callTool('deleteSheet', {
        spreadsheetId: 'sheet-123',
        sheetName: 'Unknown',
      }),
    ).rejects.toThrow('Sheet "Unknown" not found in spreadsheet sheet-123');
  });
});
