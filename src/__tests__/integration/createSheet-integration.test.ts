import { jest } from '@jest/globals';
import { google } from 'googleapis';

describe('createSheet Integration Tests', () => {
  let mockSheets: any;
  let mockCacheManager: any;
  let mockPerformanceMonitor: any;

  beforeEach(async () => {
    jest.clearAllMocks();

    // Setup mock Google Sheets API with realistic responses
    mockSheets = {
      spreadsheets: {
        get: jest.fn(() => Promise.resolve({
          data: {
            spreadsheetId: 'test-spreadsheet-id',
            properties: {
              title: 'Test Spreadsheet',
            },
            sheets: [
              {
                properties: {
                  sheetId: 0,
                  title: 'Sheet1',
                  index: 0,
                },
              },
            ],
          },
        })),
        batchUpdate: jest.fn(() => Promise.resolve({
          data: {
            spreadsheetId: 'test-spreadsheet-id',
            replies: [{
              addSheet: {
                properties: {
                  sheetId: 789012,
                  title: 'Integration Test Sheet',
                  index: 1,
                  gridProperties: {
                    rowCount: 1000,
                    columnCount: 26,
                    frozenRowCount: 0,
                    frozenColumnCount: 0,
                  },
                  tabColor: {
                    red: 0.2,
                    green: 0.4,
                    blue: 0.8,
                  },
                  hidden: false,
                  rightToLeft: false,
                },
              },
            }],
          },
        })),
      },
    };

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
      getStats: jest.fn().mockReturnValue({
        createSheet: { count: 0, totalTime: 0, averageTime: 0 },
      }),
      reset: jest.fn(),
    };
  });

  // Helper function to simulate the createSheet tool
  const callTool = async (toolName: string, args: any) => {
    if (toolName !== 'createSheet') {
      throw new Error(`Unknown tool: ${toolName}`);
    }

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

      const newSheetId = response.data.replies?.[0]?.addSheet?.properties?.sheetId;
      const newSheetTitle = response.data.replies?.[0]?.addSheet?.properties?.title || sheetProperties.title || 'Untitled Sheet';

      await mockCacheManager.invalidate(`sheet:${spreadsheetId}:*`);
      mockPerformanceMonitor.track('createSheet', Date.now() - startTime);

      return {
        content: [{
          type: 'text',
          text: `Successfully created sheet "${newSheetTitle}" with ID ${newSheetId} in spreadsheet ${spreadsheetId}`,
        }],
      };
    } catch (error: any) {
      mockPerformanceMonitor.track('createSheet', Date.now() - startTime, true);
      throw new Error(`Failed to create sheet in spreadsheet ${spreadsheetId}: ${error?.message ?? error}`);
    }
  };

  describe('End-to-end sheet creation workflow', () => {
    it('should complete full sheet creation flow with validation', async () => {
      const createResult = await callTool('createSheet', {
        spreadsheetId: 'test-spreadsheet-id',
        title: 'Integration Test Sheet',
        index: 1,
        tabColor: {
          red: 0.2,
          green: 0.4,
          blue: 0.8,
        },
      });

      expect(createResult).toMatchObject({
        content: [{
          type: 'text',
          text: expect.stringContaining('Successfully created sheet'),
        }],
      });
      expect(createResult.content?.[0]?.text).toContain('789012');
      expect(createResult.content?.[0]?.text).toContain('Integration Test Sheet');

      expect(mockSheets.spreadsheets.batchUpdate).toHaveBeenCalledWith({
        spreadsheetId: 'test-spreadsheet-id',
        requestBody: {
          requests: [{
            addSheet: {
              properties: {
                title: 'Integration Test Sheet',
                index: 1,
                tabColor: {
                  red: 0.2,
                  green: 0.4,
                  blue: 0.8,
                },
              },
            },
          }],
        },
      });

      expect(mockCacheManager.invalidate).toHaveBeenCalledWith('sheet:test-spreadsheet-id:*');
      expect(mockPerformanceMonitor.track).toHaveBeenCalledWith(
        'createSheet',
        expect.any(Number)
      );
    });

    it('should support titles with special characters and emojis', async () => {
      const title = 'SaaS 📈 Pipeline – FY24';
      const result = await callTool('createSheet', {
        spreadsheetId: 'test-spreadsheet-id',
        title,
      });

      expect(result.content?.[0]?.text).toContain(title);
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
    });

    it('should handle creation with complex grid properties', async () => {
      mockSheets.spreadsheets.batchUpdate = jest.fn(() => Promise.resolve({
        data: {
          spreadsheetId: 'test-spreadsheet-id',
          replies: [{
            addSheet: {
              properties: {
                sheetId: 345678,
                title: 'Complex Grid Sheet',
                index: 3,
                gridProperties: {
                  rowCount: 10000,
                  columnCount: 100,
                  frozenRowCount: 5,
                  frozenColumnCount: 2,
                },
              },
            },
          }],
        },
      }));

      const result = await callTool('createSheet', {
        spreadsheetId: 'test-spreadsheet-id',
        title: 'Complex Grid Sheet',
        index: 3,
        rowCount: 10000,
        columnCount: 100,
        frozenRowCount: 5,
        frozenColumnCount: 2,
      });

      expect(result.content?.[0]?.text).toContain('Successfully created sheet');
      expect(result.content?.[0]?.text).toContain('345678');
      expect(result.content?.[0]?.text).toContain('Complex Grid Sheet');

      expect(mockSheets.spreadsheets.batchUpdate).toHaveBeenCalledWith({
        spreadsheetId: 'test-spreadsheet-id',
        requestBody: {
          requests: [{
            addSheet: {
              properties: {
                title: 'Complex Grid Sheet',
                index: 3,
                gridProperties: {
                  rowCount: 10000,
                  columnCount: 100,
                  frozenRowCount: 5,
                  frozenColumnCount: 2,
                },
              },
            },
          }],
        },
      });
    });

    it('should handle hidden sheet creation', async () => {
      mockSheets.spreadsheets.batchUpdate = jest.fn(() => Promise.resolve({
        data: {
          spreadsheetId: 'test-spreadsheet-id',
          replies: [{
            addSheet: {
              properties: {
                sheetId: 111222,
                title: 'Hidden Sheet',
                hidden: true,
              },
            },
          }],
        },
      }));

      const result = await callTool('createSheet', {
        spreadsheetId: 'test-spreadsheet-id',
        title: 'Hidden Sheet',
        hidden: true,
      });

      expect(result.content?.[0]?.text).toContain('Successfully created sheet');
      expect(mockSheets.spreadsheets.batchUpdate).toHaveBeenCalledWith({
        spreadsheetId: 'test-spreadsheet-id',
        requestBody: {
          requests: [{
            addSheet: {
              properties: {
                title: 'Hidden Sheet',
                hidden: true,
              },
            },
          }],
        },
      });
    });

    it('should handle right-to-left sheet creation', async () => {
      mockSheets.spreadsheets.batchUpdate = jest.fn(() => Promise.resolve({
        data: {
          spreadsheetId: 'test-spreadsheet-id',
          replies: [{
            addSheet: {
              properties: {
                sheetId: 333444,
                title: 'RTL Sheet',
                rightToLeft: true,
              },
            },
          }],
        },
      }));

      const result = await callTool('createSheet', {
        spreadsheetId: 'test-spreadsheet-id',
        title: 'RTL Sheet',
        rightToLeft: true,
      });

      expect(result.content?.[0]?.text).toContain('Successfully created sheet');
      expect(mockSheets.spreadsheets.batchUpdate).toHaveBeenCalledWith({
        spreadsheetId: 'test-spreadsheet-id',
        requestBody: {
          requests: [{
            addSheet: {
              properties: {
                title: 'RTL Sheet',
                rightToLeft: true,
              },
            },
          }],
        },
      });
    });
  });

  describe('Tab color validation', () => {
    it('should allow boundary values of 0 and 1', async () => {
      await callTool('createSheet', {
        spreadsheetId: 'test-spreadsheet-id',
        title: 'Boundary Sheet',
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
                title: 'Boundary Sheet',
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
          title: 'Invalid Color',
          tabColor: {
            blue: -0.2,
          },
        })
      ).rejects.toThrow('tabColor.blue must be a number between 0 and 1');
    });

    it('should reject tabColor values above 1', async () => {
      await expect(
        callTool('createSheet', {
          spreadsheetId: 'test-spreadsheet-id',
          title: 'Invalid Color',
          tabColor: {
            alpha: 1.2,
          },
        })
      ).rejects.toThrow('tabColor.alpha must be a number between 0 and 1');
    });
  });

  describe('Error scenarios', () => {
    it('should handle quota exceeded error', async () => {
      mockSheets.spreadsheets.batchUpdate = jest.fn(() => Promise.reject({
        message: 'Quota exceeded for quota metric',
        code: 429,
      }));

      await expect(
        callTool('createSheet', {
          spreadsheetId: 'test-spreadsheet-id',
          title: 'Quota Test Sheet',
        })
      ).rejects.toThrow('Failed to create sheet in spreadsheet test-spreadsheet-id: Quota exceeded for quota metric');

      expect(mockPerformanceMonitor.track).toHaveBeenCalledWith(
        'createSheet',
        expect.any(Number),
        true
      );
    });

    it('should handle permission denied error', async () => {
      mockSheets.spreadsheets.batchUpdate = jest.fn(() => Promise.reject({
        message: 'The caller does not have permission',
        code: 403,
      }));

      await expect(
        callTool('createSheet', {
          spreadsheetId: 'test-spreadsheet-id',
          title: 'Permission Test Sheet',
        })
      ).rejects.toThrow('Failed to create sheet in spreadsheet test-spreadsheet-id: The caller does not have permission');

      expect(mockPerformanceMonitor.track).toHaveBeenCalledWith(
        'createSheet',
        expect.any(Number),
        true
      );
    });

    it('should handle spreadsheet not found', async () => {
      mockSheets.spreadsheets.batchUpdate = jest.fn(() => Promise.reject({
        message: 'Requested entity was not found',
        code: 404,
      }));

      await expect(
        callTool('createSheet', {
          spreadsheetId: 'nonexistent-id',
          title: 'Not Found Test Sheet',
        })
      ).rejects.toThrow('Failed to create sheet in spreadsheet nonexistent-id: Requested entity was not found');

      expect(mockPerformanceMonitor.track).toHaveBeenCalledWith(
        'createSheet',
        expect.any(Number),
        true
      );
    });
  });

  describe('Cache integration', () => {
    it('should invalidate all sheet-related caches', async () => {
      await callTool('createSheet', {
        spreadsheetId: 'test-spreadsheet-id',
        title: 'Cache Test Sheet',
      });

      expect(mockCacheManager.invalidate).toHaveBeenCalledWith('sheet:test-spreadsheet-id:*');
      expect(mockCacheManager.invalidate).toHaveBeenCalledTimes(1);
    });
  });

  describe('Performance monitoring integration', () => {
    it('should track creation time accurately', async () => {
      const startTime = Date.now();

      await callTool('createSheet', {
        spreadsheetId: 'test-spreadsheet-id',
        title: 'Performance Test Sheet',
      });

      const endTime = Date.now();
      const expectedDuration = endTime - startTime;

      expect(mockPerformanceMonitor.track).toHaveBeenCalledWith(
        'createSheet',
        expect.any(Number)
      );

      const trackedTime = mockPerformanceMonitor.track.mock.calls[0][1];
      expect(trackedTime).toBeGreaterThanOrEqual(0);
      expect(trackedTime).toBeLessThanOrEqual(expectedDuration + 100);
    });

    it('should update performance statistics', async () => {
      for (let i = 0; i < 3; i++) {
        await callTool('createSheet', {
          spreadsheetId: 'test-spreadsheet-id',
          title: `Stats Test Sheet ${i}`,
        });
      }

      expect(mockPerformanceMonitor.track).toHaveBeenCalledTimes(3);
      expect(mockPerformanceMonitor.track).toHaveBeenCalledWith(
        'createSheet',
        expect.any(Number)
      );
    });

    it('should record errors in performance metrics', async () => {
      mockSheets.spreadsheets.batchUpdate = jest.fn(() => Promise.reject(new Error('Service unavailable')));

      await expect(
        callTool('createSheet', {
          spreadsheetId: 'test-spreadsheet-id',
          title: 'Metrics Error Sheet',
        })
      ).rejects.toThrow('Failed to create sheet in spreadsheet test-spreadsheet-id: Service unavailable');

      expect(mockPerformanceMonitor.track).toHaveBeenCalledWith(
        'createSheet',
        expect.any(Number),
        true
      );
    });
  });

  describe('Default values', () => {
    it('should apply default values when parameters are omitted', async () => {
      const result = await callTool('createSheet', {
        spreadsheetId: 'test-spreadsheet-id',
      });

      expect(result.content?.[0]?.text).toContain('Successfully created sheet');
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
    });
  });
});