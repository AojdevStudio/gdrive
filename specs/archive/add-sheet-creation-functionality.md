# Add Sheet Creation Functionality Implementation Plan

## Codebase Context

### Relevant Files
- **index.ts**: Main MCP server implementation containing all tool definitions and handlers
- **jest.setup.js**: Test setup with Google APIs mocking
- **src/__tests__/**: Comprehensive test suites following established patterns

### Existing Patterns
- **Google Sheets API Integration**: Uses `sheets.spreadsheets.*` methods with consistent error handling
- **MCP Tool Registration**: Tools array with name, description, inputSchema properties
- **Performance Monitoring**: `performanceMonitor.track()` for all operations
- **Caching Strategy**: Redis-based caching with automatic invalidation on write operations
- **BatchUpdate Pattern**: Forms and Docs APIs use `batchUpdate` for modifications

### Integration Points
- **Tool Handler**: Switch statement at index.ts:1530+ handles all tool implementations
- **Tool Registration**: Tools array at index.ts:794+ defines MCP tool schemas
- **API Instance**: `sheets` constant at index.ts:23 provides Google Sheets v4 API access
- **Cache Manager**: `cacheManager` instance handles Redis caching operations

## Problem Statement & Objectives

**Current State**: The MCP server supports reading sheets (`listSheets`, `readSheet`) and modifying sheet data (`updateCells`, `appendRows`) but lacks the ability to create new sheets within existing spreadsheets.

**Objective**: Add a new `createSheet` tool that allows users to create new sheets in existing Google Spreadsheets with customizable properties including:
- Sheet name/title
- Position in sheet tabs
- Grid dimensions (rows/columns)
- Visual properties (tab color, hidden state)
- Text direction and frozen rows/columns

**Success Criteria**:
1. New sheet created successfully in existing spreadsheet
2. Proper parameter validation and error handling
3. Cache invalidation for affected spreadsheet
4. Comprehensive test coverage following project patterns
5. Performance monitoring integration
6. Full MCP tool schema compliance

## Technical Approach

### Google Sheets API Implementation
**Method**: `sheets.spreadsheets.batchUpdate`
**Request Structure**:
```typescript
{
  spreadsheetId: string,
  requestBody: {
    requests: [{
      addSheet: {
        properties: SheetProperties
      }
    }]
  }
}
```

**Response Handling**: Extract new sheet ID from batchUpdate response for user feedback

### Parameter Design
**Required Parameters**:
- `spreadsheetId`: Target spreadsheet identifier

**Optional Parameters**:
- `title`: Sheet name (defaults to "Sheet{N}")
- `index`: Position in tabs (defaults to end)
- `rowCount`: Number of rows (defaults to 1000)
- `columnCount`: Number of columns (defaults to 26)
- `hidden`: Whether sheet is hidden (defaults to false)
- `tabColor`: RGB color object for tab
- `frozenRowCount`: Number of frozen rows (defaults to 0)
- `frozenColumnCount`: Number of frozen columns (defaults to 0)

## Symbol-Based Implementation Guide

### Phase 1: Tool Registration
- **Use `mcp__serena__find_symbol`** for: `tools` array at index.ts:794
- **Use `mcp__serena__insert_after_symbol`** for: Add `createSheet` tool definition after `appendRows` tool
- **Schema Structure**: Follow existing Google Sheets tool patterns with proper TypeScript types

### Phase 2: Tool Implementation
- **Use `mcp__serena__find_symbol`** for: Main switch statement at index.ts:1530
- **Use `mcp__serena__insert_after_symbol`** for: Add `createSheet` case after `appendRows` case
- **Implementation Pattern**:
  1. Parameter validation (required: spreadsheetId)
  2. Performance timing start
  3. Build AddSheetRequest with SheetProperties
  4. Execute `sheets.spreadsheets.batchUpdate`
  5. Cache invalidation with `cacheManager.invalidate`
  6. Performance tracking
  7. Success logging and response

### Phase 3: Interface Definitions
- **Use `mcp__serena__find_symbol`** for: Existing interfaces like `QuestionItem`, `TextStyle`
- **Use `mcp__serena__insert_after_symbol`** for: Add `SheetProperties` and supporting interfaces
- **Types to Add**:
  ```typescript
  interface SheetProperties {
    sheetId?: number;
    title?: string;
    index?: number;
    gridProperties?: GridProperties;
    hidden?: boolean;
    tabColor?: Color;
    rightToLeft?: boolean;
  }

  interface GridProperties {
    rowCount?: number;
    columnCount?: number;
    frozenRowCount?: number;
    frozenColumnCount?: number;
  }

  interface Color {
    red?: number;
    green?: number;
    blue?: number;
    alpha?: number;
  }
  ```

### Phase 4: Test Implementation
- **Use `mcp__serena__find_symbol`** for: Existing test patterns in `src/__tests__/`
- **Create Files**:
  - `src/__tests__/integration/createSheet-integration.test.ts`
  - `src/__tests__/sheets/createSheet.test.ts`
- **Test Coverage**:
  1. Successful sheet creation with minimal parameters
  2. Sheet creation with all optional parameters
  3. Parameter validation (missing spreadsheetId)
  4. API error handling
  5. Cache invalidation verification
  6. Performance monitoring validation

### Phase 5: Mock Setup Enhancement
- **Use `mcp__serena__find_symbol`** for: `sheets` mock in jest.setup.js
- **Use `mcp__serena__replace_symbol_body`** for: Add `batchUpdate` method to sheets mock
- **Mock Structure**:
  ```javascript
  sheets: jest.fn(() => ({
    spreadsheets: {
      get: jest.fn(),
      values: { /* existing mocks */ },
      batchUpdate: jest.fn() // Add this method
    }
  }))
  ```

## Integration & Testing

### Test Strategy
Following existing comprehensive testing patterns:

1. **Unit Tests** (`src/__tests__/sheets/createSheet.test.ts`):
   - Parameter validation logic
   - Request structure verification
   - Response handling
   - Error scenarios

2. **Integration Tests** (`src/__tests__/integration/createSheet-integration.test.ts`):
   - End-to-end API call flow
   - Mock API response validation
   - Cache invalidation behavior
   - Performance monitoring integration

3. **Jest Mock Enhancement** (`jest.setup.js`):
   - Add `batchUpdate` method to sheets mock
   - Consistent with existing Forms/Docs batchUpdate mocks

### Cache Integration
- **Invalidation Pattern**: `cacheManager.invalidate(\`sheet:${spreadsheetId}:*\`)`
- **Rationale**: New sheet affects spreadsheet structure, invalidating all sheet-related caches
- **Consistency**: Matches existing `updateCells` and `appendRows` invalidation patterns

### Performance Monitoring
- **Timing**: `performanceMonitor.track('createSheet', Date.now() - startTime)`
- **Logging**: Success/failure logging with structured data
- **Metrics**: Track sheet creation frequency and performance

## Success Criteria

### Functional Requirements
1. ✅ **Sheet Creation**: Successfully create new sheet in existing spreadsheet
2. ✅ **Parameter Flexibility**: Support all optional SheetProperties
3. ✅ **Error Handling**: Proper validation and API error handling
4. ✅ **Cache Management**: Automatic cache invalidation
5. ✅ **Performance**: Sub-second response times with monitoring

### Quality Requirements
1. ✅ **Test Coverage**: >95% coverage with comprehensive test scenarios
2. ✅ **Type Safety**: Full TypeScript interface definitions
3. ✅ **Documentation**: Clear parameter descriptions and examples
4. ✅ **Consistency**: Follows all existing project patterns and conventions
5. ✅ **Maintainability**: Clear code structure and error messages

### Integration Requirements
1. ✅ **MCP Compliance**: Proper tool schema and response format
2. ✅ **API Compatibility**: Correct Google Sheets API v4 usage
3. ✅ **Caching Strategy**: Redis integration with invalidation
4. ✅ **Monitoring**: Performance tracking and structured logging
5. ✅ **Security**: Input validation and secure API usage

## Implementation Notes

### Development Workflow
1. **Build**: Run `npm run build` after implementation
2. **Type Check**: Run `npm run type-check` to verify TypeScript
3. **Lint**: Run `npm run lint` for code style compliance
4. **Test**: Run `npm test` for comprehensive validation
5. **Integration**: Test with actual Google Sheets API using auth flow

### Deployment Considerations
- **Backward Compatibility**: New tool addition doesn't affect existing functionality
- **API Quotas**: Sheet creation is low-frequency operation, minimal quota impact
- **Error Recovery**: Clear error messages for quota limits and permission issues
- **Documentation**: Update CLAUDE.md with new tool capabilities

### Future Enhancements
- **Sheet Templates**: Predefined sheet configurations
- **Bulk Operations**: Create multiple sheets in single request
- **Advanced Formatting**: Cell formatting and conditional formatting
- **Data Validation**: Add data validation rules to new sheets
- **Chart Integration**: Support for embedded charts in new sheets