# Implementation Plan: Add createSheet Tool to Google Drive MCP Server

**Created:** 2025-10-08
**Status:** Draft
**Complexity:** Medium
**Estimated Effort:** 2-3 hours

## Problem Statement

The Google Drive MCP server currently supports creating various Google Workspace resources (Files, Folders, Forms, Documents) but lacks the ability to create new Google Sheets spreadsheets programmatically. Users need a straightforward way to create new spreadsheets with optional initial data and configuration.

## Objectives

1. Add a `createSheet` tool that creates new Google Sheets spreadsheets
2. Support optional initial configuration (sheet names, row/column counts)
3. Support optional initial data population
4. Maintain consistency with existing tool patterns in the codebase
5. Include proper error handling, logging, and cache invalidation
6. Add comprehensive tests following the project's testing patterns

## Technical Approach

### API Integration
- Use Google Sheets API v4 (`google.sheets("v4")`) already initialized in the project
- Primary method: `sheets.spreadsheets.create()` for creating the spreadsheet
- Optional: `sheets.spreadsheets.batchUpdate()` for initial data/formatting if needed
- Use Google Drive API v3 for post-creation operations (moving to folders, etc.)

### Tool Design Pattern
Follow the established pattern used by similar creation tools (`createFile`, `createFolder`, `createForm`, `createDocument`):
1. Input validation
2. API call execution
3. Performance tracking
4. Cache invalidation
5. Structured logging
6. Success response with file ID and link

## Implementation Steps

### Step 1: Define Tool Schema
**Location:** `index.ts` around line 1100-1200 (in the `ListToolsRequest` handler)

Add tool definition:
```typescript
{
  name: "createSheet",
  description: "Create a new Google Sheets spreadsheet with optional initial configuration and data",
  inputSchema: {
    type: "object",
    properties: {
      title: {
        type: "string",
        description: "The title of the new spreadsheet"
      },
      parentId: {
        type: "string",
        description: "Optional parent folder ID where the spreadsheet should be created"
      },
      sheetTitles: {
        type: "array",
        items: { type: "string" },
        description: "Optional array of sheet names to create (default: ['Sheet1'])"
      },
      initialData: {
        type: "object",
        description: "Optional initial data for the first sheet",
        properties: {
          range: {
            type: "string",
            description: "A1 notation range (e.g., 'Sheet1!A1:C3')"
          },
          values: {
            type: "array",
            items: {
              type: "array",
              items: {
                type: ["string", "number", "boolean", "null"]
              }
            },
            description: "2D array of values to populate"
          }
        }
      }
    },
    required: ["title"]
  }
}
```

### Step 2: Implement Tool Handler
**Location:** `index.ts` around line 1400-1900 (in the `CallToolRequest` switch statement)

Add case handler after `createFolder` (around line 1528):

```typescript
case "createSheet": {
  // 1. Validate required parameters
  if (!args || typeof args.title !== 'string') {
    throw new Error('title parameter is required');
  }

  const { title } = args;
  const parentId = args.parentId as string | undefined;
  const sheetTitles = args.sheetTitles as string[] | undefined;
  const initialData = args.initialData as { range: string; values: unknown[][] } | undefined;

  // 2. Create spreadsheet with Google Sheets API
  const createRequest: {
    properties: { title: string };
    sheets?: Array<{ properties: { title: string } }>;
  } = {
    properties: { title }
  };

  // Add custom sheet names if provided
  if (sheetTitles && sheetTitles.length > 0) {
    createRequest.sheets = sheetTitles.map(sheetTitle => ({
      properties: { title: sheetTitle }
    }));
  }

  const response = await sheets.spreadsheets.create({
    requestBody: createRequest,
    fields: "spreadsheetId,spreadsheetUrl,properties,sheets"
  });

  const spreadsheetId = response.data.spreadsheetId;

  // 3. Move to parent folder if specified (using Drive API)
  if (parentId && spreadsheetId) {
    await drive.files.update({
      fileId: spreadsheetId,
      addParents: parentId,
      fields: "id, parents"
    });
  }

  // 4. Populate initial data if provided
  if (initialData && spreadsheetId) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: initialData.range,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: initialData.values as unknown[][]
      }
    });
  }

  // 5. Invalidate relevant caches
  await cacheManager.invalidate(`search:*`);
  if (parentId) {
    await cacheManager.invalidate(`folder:${parentId}:*`);
  }

  // 6. Track performance
  performanceMonitor.track('createSheet', Date.now() - startTime);

  // 7. Log success
  logger.info('Spreadsheet created', {
    spreadsheetId,
    title,
    parentId,
    hasInitialData: !!initialData
  });

  // 8. Return success response
  return {
    content: [{
      type: "text",
      text: `Spreadsheet created successfully!
ID: ${spreadsheetId}
Title: ${title}
URL: ${response.data.spreadsheetUrl}
Sheets: ${response.data.sheets?.map(s => s.properties?.title).join(', ') || 'Sheet1'}`
    }]
  };
}
```

### Step 3: Add TypeScript Interface (if needed)
**Location:** Top of `index.ts` around line 75-130 (with other interfaces)

If additional type safety is needed:
```typescript
interface CreateSheetRequest {
  title: string;
  parentId?: string;
  sheetTitles?: string[];
  initialData?: {
    range: string;
    values: unknown[][];
  };
}
```

### Step 4: Update Documentation
**Location:** `CLAUDE.md` around line 20-30 (in the "Tools" section)

Add to the tools list:
```markdown
- **Sheets Operations**: updateCells, appendRows, **createSheet**
```

And in the detailed tools section:
```markdown
- **createSheet**: Create new Google Sheets spreadsheets with optional configuration
```

### Step 5: Add Tests
**Location:** Create new file `src/__tests__/sheets/createSheet.test.ts`

Test structure following the pattern from `src/__tests__/forms/addQuestion.test.ts`:

```typescript
import { jest } from '@jest/globals';
import { google } from 'googleapis';

// Mock googleapis
jest.mock('googleapis');

describe('createSheet Tool', () => {
  let mockSheetsCreate: jest.Mock;
  let mockDriveUpdate: jest.Mock;
  let mockValuesUpdate: jest.Mock;

  beforeEach(() => {
    mockSheetsCreate = jest.fn();
    mockDriveUpdate = jest.fn();
    mockValuesUpdate = jest.fn();

    // Setup mocks
    (google.sheets as jest.Mock).mockReturnValue({
      spreadsheets: {
        create: mockSheetsCreate,
        values: {
          update: mockValuesUpdate
        }
      }
    });

    (google.drive as jest.Mock).mockReturnValue({
      files: {
        update: mockDriveUpdate
      }
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Creation', () => {
    test('should create spreadsheet with only title', async () => {
      mockSheetsCreate.mockResolvedValue({
        data: {
          spreadsheetId: 'test-sheet-id',
          spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/test-sheet-id',
          properties: { title: 'Test Spreadsheet' },
          sheets: [{ properties: { title: 'Sheet1' } }]
        }
      });

      const args = { title: 'Test Spreadsheet' };

      // Call the tool handler (you'll need to export it or test via the server)
      // const result = await handleCreateSheet(args);

      expect(mockSheetsCreate).toHaveBeenCalledWith({
        requestBody: {
          properties: { title: 'Test Spreadsheet' }
        },
        fields: expect.any(String)
      });
    });

    test('should create spreadsheet with custom sheet names', async () => {
      mockSheetsCreate.mockResolvedValue({
        data: {
          spreadsheetId: 'test-sheet-id',
          spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/test-sheet-id',
          sheets: [
            { properties: { title: 'Data' } },
            { properties: { title: 'Analysis' } }
          ]
        }
      });

      const args = {
        title: 'Multi-sheet Spreadsheet',
        sheetTitles: ['Data', 'Analysis']
      };

      // Call handler
      // await handleCreateSheet(args);

      expect(mockSheetsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          requestBody: expect.objectContaining({
            sheets: [
              { properties: { title: 'Data' } },
              { properties: { title: 'Analysis' } }
            ]
          })
        })
      );
    });
  });

  describe('Parent Folder Assignment', () => {
    test('should move spreadsheet to parent folder when parentId provided', async () => {
      mockSheetsCreate.mockResolvedValue({
        data: {
          spreadsheetId: 'test-sheet-id',
          spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/test-sheet-id'
        }
      });

      mockDriveUpdate.mockResolvedValue({ data: {} });

      const args = {
        title: 'Folder Spreadsheet',
        parentId: 'parent-folder-id'
      };

      // await handleCreateSheet(args);

      expect(mockDriveUpdate).toHaveBeenCalledWith({
        fileId: 'test-sheet-id',
        addParents: 'parent-folder-id',
        fields: 'id, parents'
      });
    });
  });

  describe('Initial Data Population', () => {
    test('should populate initial data when provided', async () => {
      mockSheetsCreate.mockResolvedValue({
        data: {
          spreadsheetId: 'test-sheet-id',
          spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/test-sheet-id'
        }
      });

      mockValuesUpdate.mockResolvedValue({ data: {} });

      const args = {
        title: 'Data Spreadsheet',
        initialData: {
          range: 'Sheet1!A1:B2',
          values: [
            ['Name', 'Age'],
            ['John', 30]
          ]
        }
      };

      // await handleCreateSheet(args);

      expect(mockValuesUpdate).toHaveBeenCalledWith({
        spreadsheetId: 'test-sheet-id',
        range: 'Sheet1!A1:B2',
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [
            ['Name', 'Age'],
            ['John', 30]
          ]
        }
      });
    });
  });

  describe('Error Handling', () => {
    test('should throw error when title is missing', async () => {
      const args = {};

      await expect(async () => {
        // await handleCreateSheet(args);
      }).rejects.toThrow('title parameter is required');
    });

    test('should throw error when title is not a string', async () => {
      const args = { title: 123 };

      await expect(async () => {
        // await handleCreateSheet(args);
      }).rejects.toThrow('title parameter is required');
    });

    test('should handle API errors gracefully', async () => {
      mockSheetsCreate.mockRejectedValue(new Error('API Error: Quota exceeded'));

      const args = { title: 'Test Sheet' };

      await expect(async () => {
        // await handleCreateSheet(args);
      }).rejects.toThrow('API Error: Quota exceeded');
    });
  });

  describe('Cache Invalidation', () => {
    test('should invalidate search cache after creation', async () => {
      // Test that cache invalidation is called
      // This will depend on how you structure cache access in tests
    });

    test('should invalidate parent folder cache when parentId provided', async () => {
      // Test folder-specific cache invalidation
    });
  });
});
```

### Step 6: Integration Testing
**Location:** Create or update `src/__tests__/integration/sheets-integration.test.ts`

Add integration test that:
1. Creates a spreadsheet
2. Verifies it exists via the Drive API
3. Verifies it's accessible via the Sheets API
4. Tests with parent folder assignment
5. Tests with initial data population
6. Cleans up test resources

## Potential Challenges & Solutions

### Challenge 1: API Quota Limits
**Problem:** Google Sheets API has rate limits that could be exceeded during testing or heavy usage.

**Solution:**
- Implement exponential backoff retry logic
- Add quota monitoring to performance tracker
- Document quota limits in user-facing documentation
- Use mock APIs in unit tests to avoid quota consumption

### Challenge 2: Parent Folder Assignment Timing
**Problem:** Moving the spreadsheet to a parent folder immediately after creation might fail due to propagation delays.

**Solution:**
- Add retry logic with short delays for the `drive.files.update` call
- Catch and handle specific "file not found" errors with retries
- Log warnings if folder assignment fails but don't fail the entire operation

### Challenge 3: Initial Data Validation
**Problem:** Invalid initial data format could cause silent failures or data corruption.

**Solution:**
- Validate the 2D array structure before API call
- Ensure range notation is valid (A1 notation regex check)
- Provide clear error messages for common mistakes
- Add examples in documentation

### Challenge 4: Cache Invalidation Scope
**Problem:** New spreadsheets should appear in search results, but cache invalidation might be too broad or too narrow.

**Solution:**
- Invalidate all search caches (pattern: `search:*`)
- Invalidate parent folder caches if parentId provided
- Consider adding spreadsheet-specific cache entries for future reads
- Monitor cache hit/miss rates after implementation

## Testing Strategy

### Unit Tests (80% Coverage Target)
- **Input Validation**: Test all parameter combinations and validation rules
- **API Calls**: Mock Google APIs and verify correct parameters
- **Error Handling**: Test all error paths and edge cases
- **Cache Operations**: Verify cache invalidation logic
- **Logging**: Ensure proper logging at info/error levels

### Integration Tests (If Feasible)
- **End-to-End Creation**: Create actual spreadsheets in test environment
- **Folder Assignment**: Verify spreadsheets appear in correct folders
- **Data Population**: Verify initial data is correctly written
- **Cleanup**: Delete test resources after tests complete

### Manual Testing Checklist
- [ ] Create spreadsheet with only title
- [ ] Create spreadsheet with custom sheet names
- [ ] Create spreadsheet in specific folder
- [ ] Create spreadsheet with initial data
- [ ] Create spreadsheet with all options combined
- [ ] Verify spreadsheet appears in Drive search
- [ ] Verify spreadsheet is accessible via URL
- [ ] Test error handling with invalid inputs
- [ ] Monitor performance metrics
- [ ] Check logs for proper entries

## Success Criteria

1. **Functionality**
   - ✅ Can create basic spreadsheets with just a title
   - ✅ Can create spreadsheets with custom sheet names
   - ✅ Can assign spreadsheets to parent folders
   - ✅ Can populate initial data

2. **Code Quality**
   - ✅ Follows existing code patterns and conventions
   - ✅ Includes comprehensive error handling
   - ✅ Has proper TypeScript typing
   - ✅ Includes structured logging

3. **Testing**
   - ✅ Unit tests achieve 80%+ coverage
   - ✅ All edge cases are tested
   - ✅ Error paths are validated

4. **Documentation**
   - ✅ Tool is documented in CLAUDE.md
   - ✅ Code includes clear comments
   - ✅ API parameters are well-described

5. **Performance**
   - ✅ Cache invalidation works correctly
   - ✅ Performance metrics are tracked
   - ✅ Operation completes in <3 seconds for basic creation

6. **User Experience**
   - ✅ Clear success messages with spreadsheet ID and URL
   - ✅ Helpful error messages for common mistakes
   - ✅ Consistent with other creation tools

## Edge Cases to Consider

1. **Empty Sheet Titles Array**: Should default to single sheet named "Sheet1"
2. **Duplicate Sheet Names**: Google Sheets API will reject, need clear error message
3. **Very Long Titles**: Google has 256-character limit for spreadsheet titles
4. **Invalid Parent Folder ID**: Handle gracefully with clear error
5. **Invalid Range Notation**: Validate A1 notation before API call
6. **Mismatched Data Dimensions**: Ensure values array matches range dimensions
7. **Special Characters in Sheet Names**: Some characters are invalid in sheet names
8. **API Quota Exceeded**: Provide helpful retry guidance
9. **Network Timeouts**: Implement appropriate timeout handling
10. **Authentication Expiry**: Handle token refresh gracefully

## Rollback Plan

If issues are discovered after implementation:

1. **Minor Issues**: Fix in place with additional tests
2. **Major Issues**:
   - Remove tool from ListTools response (comment out definition)
   - Remove case handler from CallToolRequest switch
   - Document issue in CHANGELOG.md
   - Create GitHub issue for proper fix

## Performance Considerations

### Expected Performance Metrics
- **Basic Creation**: 1-2 seconds
- **With Parent Folder**: 2-3 seconds (extra API call)
- **With Initial Data**: 2-4 seconds (depends on data size)
- **Full Options**: 3-5 seconds

### Optimization Opportunities
- Batch folder assignment and data population in parallel
- Cache spreadsheet metadata after creation
- Pre-validate all inputs before any API calls
- Use field masks to minimize response payload size

## Security Considerations

1. **Input Sanitization**: Validate all user inputs to prevent injection attacks
2. **Folder Permissions**: Respect existing Google Drive folder permissions
3. **Data Privacy**: Don't log sensitive data content
4. **Quota Protection**: Implement rate limiting to prevent abuse
5. **Error Messages**: Don't expose internal system details in errors

## Future Enhancements

After initial implementation, consider:

1. **Template Support**: Allow creating from existing spreadsheet templates
2. **Advanced Formatting**: Support cell formatting, conditional formatting
3. **Data Validation**: Add data validation rules during creation
4. **Named Ranges**: Support creating named ranges
5. **Freeze Rows/Columns**: Add options for freezing headers
6. **Chart Creation**: Support adding charts during initialization
7. **Sharing Settings**: Configure sharing permissions at creation time

## Implementation Timeline

**Total Estimated Time: 2-3 hours for experienced developer, 4-6 hours for learning developer**

1. **Step 1-2 (Core Implementation)**: 1-1.5 hours
2. **Step 3-4 (Interfaces & Docs)**: 15-30 minutes
3. **Step 5 (Unit Tests)**: 1-2 hours
4. **Step 6 (Integration Testing)**: 30-60 minutes
5. **Manual Testing & Refinement**: 30-60 minutes

## Dependencies

- Google Sheets API v4 (already initialized)
- Google Drive API v3 (already initialized)
- Existing cache manager
- Existing performance monitor
- Existing logger instance
- Jest testing framework (already configured)

## References

- [Google Sheets API v4 Documentation](https://developers.google.com/sheets/api/reference/rest/v4/spreadsheets/create)
- [Google Drive API v3 Documentation](https://developers.google.com/drive/api/v3/reference/files/update)
- Existing tool implementations: `createFile`, `createFolder`, `createForm`, `createDocument` in `index.ts`
- Test pattern reference: `src/__tests__/forms/addQuestion.test.ts`
