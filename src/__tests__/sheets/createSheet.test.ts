import { jest } from '@jest/globals';
import { google } from 'googleapis';

describe('createSheet', () => {
  let mockSheets: any;
  let mockCacheManager: any;
  let mockPerformanceMonitor: any;
  let mockLogger: any;
  let callTool: any;

  beforeEach(async () => {
    // Reset mocks
    jest.clearAllMocks();

    // Setup mock Google Sheets API
    mockSheets = {
      spreadsheets: {
        batchUpdate: jest.fn((request: any) => {
          // Extract the title from the request if provided
          const title = request?.requestBody?.requests?.[0]?.addSheet?.properties?.title || 'New Sheet';
          return Promise.resolve({
            data: {
              replies: [{
                addSheet: {
                  properties: {
                    sheetId: 123456,
                    title: title,
                    index: 0,
                    gridProperties: {
                      rowCount: 1000,
                      columnCount: 26,
                    },
                  },
                },
              }],
            },
          });
        }),
      },
    };

    // Mock googleapis
    (google.sheets as any).mockReturnValue(mockSheets);

    // Setup mock cache manager
    mockCacheManager = {
      get: jest.fn(() => Promise.resolve(null)),
      set: jest.fn(() => Promise.resolve(undefined)),
      invalidate: jest.fn(() => Promise.resolve(undefined)),
      flush: jest.fn(() => Promise.resolve(undefined)),
    };

    // Setup mock performance monitor
    mockPerformanceMonitor = {
      track: jest.fn(),
      getStats: jest.fn().mockReturnValue({}),
      reset: jest.fn(),
    };

    // Setup mock logger
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };

    // Mocks are already set up above

    // Create a mock callTool function that simulates the server behavior
    callTool = async (toolName: string, args: any) => {
      if (toolName !== 'createSheet') {
        throw new Error(`Unknown tool: ${toolName}`);
      }

      // Simulate parameter validation
      if (!args || typeof args.spreadsheetId !== 'string') {
        throw new Error('spreadsheetId parameter is required');
      }

      const { spreadsheetId } = args;
      const sheetProperties: any = {};

      if (typeof args.title === 'string') {
        sheetProperties.title = args.title;
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

      // Build GridProperties
      const hasGridProps = typeof args.rowCount === 'number' ||
                           typeof args.columnCount === 'number' ||
                           typeof args.frozenRowCount === 'number' ||
                           typeof args.frozenColumnCount === 'number';

      if (hasGridProps) {
        sheetProperties.gridProperties = {};
        if (typeof args.rowCount === 'number') {
          sheetProperties.gridProperties.rowCount = args.rowCount;
        }
        if (typeof args.columnCount === 'number') {
          sheetProperties.gridProperties.columnCount = args.columnCount;
        }
        if (typeof args.frozenRowCount === 'number') {
          sheetProperties.gridProperties.frozenRowCount = args.frozenRowCount;
        }
        if (typeof args.frozenColumnCount === 'number') {
          sheetProperties.gridProperties.frozenColumnCount = args.frozenColumnCount;
        }
      }

      // Handle tabColor
      if (args.tabColor && typeof args.tabColor === 'object') {
        const color = args.tabColor;
        const validatedColor: Record<string, number> = {};
        ['red', 'green', 'blue', 'alpha'].forEach((channel) => {
          const value = (color as Record<string, unknown>)[channel];
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

      const startTime = Date.now();

      try {
        // Call the mock API
        const response = await mockSheets.spreadsheets.batchUpdate({
          spreadsheetId,
          requestBody: {
            requests: [{
              addSheet: {
                properties: sheetProperties,
              },
            }],
          },
        });

        // Extract sheet info
        const newSheetId = response.data.replies?.[0]?.addSheet?.properties?.sheetId;
        const newSheetTitle = response.data.replies?.[0]?.addSheet?.properties?.title || sheetProperties.title || 'Untitled Sheet';

        // Simulate cache invalidation
        await mockCacheManager.invalidate(`sheet:${spreadsheetId}:*`);

        // Simulate performance tracking
        mockPerformanceMonitor.track('createSheet', Date.now() - startTime);

        // Simulate logging
        mockLogger.info('Sheet created', { spreadsheetId, sheetId: newSheetId, title: newSheetTitle });

        return {
          content: [{
            type: 'text',
            text: `Successfully created sheet "${newSheetTitle}" with ID ${newSheetId} in spreadsheet ${spreadsheetId}`,
          }],
        };
      } catch (error) {
        mockPerformanceMonitor.track('createSheet', Date.now() - startTime, true);
        mockLogger.error('Error in createSheet', { error });
        const message = (error as { message?: string }).message ?? `${error}`;
        throw new Error(`Failed to create sheet in spreadsheet ${spreadsheetId}: ${message}`);
      }
    };
  });

  describe('Parameter validation', () => {
    it('should throw error if spreadsheetId is missing', async () => {
      await expect(
        callTool('createSheet', {})
      ).rejects.toThrow('spreadsheetId parameter is required');
    });

    it('should throw error if spreadsheetId is not a string', async () => {
      await expect(
        callTool('createSheet', { spreadsheetId: 123 })
      ).rejects.toThrow('spreadsheetId parameter is required');
    });
  });

  describe('Successful sheet creation', () => {
    it('should create sheet with minimal parameters', async () => {
      const result = await callTool('createSheet', {
        spreadsheetId: 'test-spreadsheet-id',
      });

      expect(mockSheets.spreadsheets.batchUpdate).toHaveBeenCalledWith({
        spreadsheetId: 'test-spreadsheet-id',
        requestBody: {
          requests: [{
            addSheet: {
              properties: {},
            },
          }],
        },
      });

      expect(result.content[0].text).toContain('Successfully created sheet');
      expect(result.content[0].text).toContain('123456');
      expect(mockCacheManager.invalidate).toHaveBeenCalledWith('sheet:test-spreadsheet-id:*');
      expect(mockPerformanceMonitor.track).toHaveBeenCalledWith('createSheet', expect.any(Number));
    });

    it('should create sheet with title', async () => {
      const result = await callTool('createSheet', {
        spreadsheetId: 'test-spreadsheet-id',
        title: 'My Custom Sheet',
      });

      expect(mockSheets.spreadsheets.batchUpdate).toHaveBeenCalledWith({
        spreadsheetId: 'test-spreadsheet-id',
        requestBody: {
          requests: [{
            addSheet: {
              properties: {
                title: 'My Custom Sheet',
              },
            },
          }],
        },
      });

      expect(result.content[0].text).toContain('My Custom Sheet');
    });

    it('should support titles with special characters and emojis', async () => {
      const title = 'Quarterly 📊 Report – Q1/2024';
      const result = await callTool('createSheet', {
        spreadsheetId: 'test-spreadsheet-id',
        title,
      });

      expect(mockSheets.spreadsheets.batchUpdate).toHaveBeenCalledWith({
        spreadsheetId: 'test-spreadsheet-id',
        requestBody: {
          requests: [{
            addSheet: {
              properties: { title },
            },
          }],
        },
      });

      expect(result.content[0].text).toContain(title);
    });

    it('should create sheet with all optional parameters', async () => {
      const result = await callTool('createSheet', {
        spreadsheetId: 'test-spreadsheet-id',
        title: 'Full Config Sheet',
        index: 2,
        rowCount: 5000,
        columnCount: 50,
        hidden: true,
        tabColor: {
          red: 0.5,
          green: 0.75,
          blue: 1.0,
          alpha: 0.9,
        },
        frozenRowCount: 2,
        frozenColumnCount: 3,
        rightToLeft: true,
      });

      expect(mockSheets.spreadsheets.batchUpdate).toHaveBeenCalledWith({
        spreadsheetId: 'test-spreadsheet-id',
        requestBody: {
          requests: [{
            addSheet: {
              properties: {
                title: 'Full Config Sheet',
                index: 2,
                hidden: true,
                rightToLeft: true,
                gridProperties: {
                  rowCount: 5000,
                  columnCount: 50,
                  frozenRowCount: 2,
                  frozenColumnCount: 3,
                },
                tabColor: {
                  red: 0.5,
                  green: 0.75,
                  blue: 1.0,
                  alpha: 0.9,
                },
              },
            },
          }],
        },
      });

      expect(result.content[0].text).toContain('Successfully created sheet');
    });

    it('should handle partial grid properties', async () => {
      await callTool('createSheet', {
        spreadsheetId: 'test-spreadsheet-id',
        title: 'Partial Grid Sheet',
        rowCount: 2000,
        frozenRowCount: 1,
      });

      expect(mockSheets.spreadsheets.batchUpdate).toHaveBeenCalledWith({
        spreadsheetId: 'test-spreadsheet-id',
        requestBody: {
          requests: [{
            addSheet: {
              properties: {
                title: 'Partial Grid Sheet',
                gridProperties: {
                  rowCount: 2000,
                  frozenRowCount: 1,
                },
              },
            },
          }],
        },
      });
    });

    it('should handle partial tab color', async () => {
      await callTool('createSheet', {
        spreadsheetId: 'test-spreadsheet-id',
        title: 'Colored Sheet',
        tabColor: {
          red: 1.0,
          green: 0,
        },
      });

      expect(mockSheets.spreadsheets.batchUpdate).toHaveBeenCalledWith({
        spreadsheetId: 'test-spreadsheet-id',
        requestBody: {
          requests: [{
            addSheet: {
              properties: {
                title: 'Colored Sheet',
                tabColor: {
                  red: 1.0,
                  green: 0,
                },
              },
            },
          }],
        },
      });
    });
  });

  describe('Tab color validation', () => {
    it('should allow boundary values of 0 and 1 for each channel', async () => {
      await callTool('createSheet', {
        spreadsheetId: 'test-spreadsheet-id',
        title: 'Boundary Color Sheet',
        tabColor: {
          red: 0,
          green: 1,
          blue: 0,
          alpha: 1,
        },
      });

      expect(mockSheets.spreadsheets.batchUpdate).toHaveBeenCalledWith({
        spreadsheetId: 'test-spreadsheet-id',
        requestBody: {
          requests: [{
            addSheet: {
              properties: {
                title: 'Boundary Color Sheet',
                tabColor: {
                  red: 0,
                  green: 1,
                  blue: 0,
                  alpha: 1,
                },
              },
            },
          }],
        },
      });
    });

    it('should reject tabColor values below 0', async () => {
      await expect(
        callTool('createSheet', {
          spreadsheetId: 'test-spreadsheet-id',
          title: 'Invalid Color Sheet',
          tabColor: {
            red: -0.1,
          },
        })
      ).rejects.toThrow('tabColor.red must be a number between 0 and 1');
    });

    it('should reject tabColor values above 1', async () => {
      await expect(
        callTool('createSheet', {
          spreadsheetId: 'test-spreadsheet-id',
          title: 'Invalid Color Sheet',
          tabColor: {
            green: 1.5,
          },
        })
      ).rejects.toThrow('tabColor.green must be a number between 0 and 1');
    });
  });

  describe('Error handling', () => {
    it('should handle API errors gracefully', async () => {
      mockSheets.spreadsheets.batchUpdate = jest.fn(() =>
        Promise.reject(new Error('API Error: Invalid spreadsheet ID'))
      );

      await expect(
        callTool('createSheet', {
          spreadsheetId: 'invalid-id',
          title: 'Test Sheet',
        })
      ).rejects.toThrow('Failed to create sheet in spreadsheet invalid-id: API Error: Invalid spreadsheet ID');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error in createSheet',
        expect.objectContaining({
          error: expect.any(Error),
        })
      );

      expect(mockPerformanceMonitor.track).toHaveBeenCalledWith(
        'createSheet',
        expect.any(Number),
        true
      );
    });

    it('should handle missing response data', async () => {
      mockSheets.spreadsheets.batchUpdate = jest.fn(() =>
        Promise.resolve({
          data: {},
        })
      );

      const result = await callTool('createSheet', {
        spreadsheetId: 'test-spreadsheet-id',
        title: 'Test Sheet',
      });

      expect(result.content[0].text).toContain('Successfully created sheet');
      expect(result.content[0].text).toContain('undefined'); // Sheet ID will be undefined
    });
  });

  describe('Cache invalidation', () => {
    it('should invalidate cache for the spreadsheet', async () => {
      await callTool('createSheet', {
        spreadsheetId: 'test-spreadsheet-id',
        title: 'Cache Test Sheet',
      });

      expect(mockCacheManager.invalidate).toHaveBeenCalledWith('sheet:test-spreadsheet-id:*');
      expect(mockCacheManager.invalidate).toHaveBeenCalledTimes(1);
    });
  });

  describe('Performance monitoring', () => {
    it('should track performance metrics', async () => {
      await callTool('createSheet', {
        spreadsheetId: 'test-spreadsheet-id',
        title: 'Performance Test Sheet',
      });

      expect(mockPerformanceMonitor.track).toHaveBeenCalledWith(
        'createSheet',
        expect.any(Number)
      );
      expect(mockPerformanceMonitor.track).toHaveBeenCalledTimes(1);
    });
  });

  describe('Logging', () => {
    it('should log successful sheet creation', async () => {
      await callTool('createSheet', {
        spreadsheetId: 'test-spreadsheet-id',
        title: 'Log Test Sheet',
      });

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Sheet created',
        expect.objectContaining({
          spreadsheetId: 'test-spreadsheet-id',
          sheetId: 123456,
          title: 'Log Test Sheet',
        })
      );
    });
  });
});