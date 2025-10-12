# Google Sheets Advanced Features Implementation Plan

**Date:** 2025-10-10
**Status:** Planning
**Priority:** High
**Target Users:** 10-20 users

---

## Executive Summary

This document outlines a comprehensive plan to extend the Google Drive MCP server with **10 critical missing features** for Google Sheets. Currently, the MCP server only supports basic operations (reading and writing values). This enhancement will add formulas, formatting, sheet management, and advanced layout controls—transforming it into a production-ready tool for financial tracking, data analysis, and automated reporting.

**Key Benefits:**
- ✅ **Formula support** - Enable dynamic calculations (SUM, formulas auto-update)
- 🎨 **Cell formatting** - Bold headers, currency formats, colors, conditional formatting
- 📋 **Sheet management** - Create, rename, delete tabs within spreadsheets
- 🔒 **Layout controls** - Freeze rows/columns, adjust column widths
- 📊 **Advanced features** - Charts, data validation, merged cells

---

## Problem Statement

### Current Limitations

The existing MCP server implementation (`index.ts:794-1650`) provides only **basic Sheets operations**:

1. ✅ `listSheets` - List all sheets in a spreadsheet
2. ✅ `readSheet` - Read data from a range
3. ✅ `updateCells` - Write VALUES to cells
4. ✅ `appendRows` - Append VALUES to a sheet

### What's Missing

**Critical gaps preventing real-world usage:**

| Feature Category | User Need | Current Workaround | Impact |
|-----------------|-----------|-------------------|---------|
| **Formulas** | `=SUM(N2:N24)` instead of calculated values | Manual calculation outside sheets | High - No auto-updating |
| **Formatting** | Bold headers, currency $13,299.34, colors | Everything is plain text | High - Unreadable sheets |
| **Sheet Management** | Create/rename tabs | Manual UI interaction required | Medium - Workflow friction |
| **Layout** | Freeze header rows, adjust column widths | Data gets cut off, headers scroll away | Medium - Poor UX |
| **Advanced** | Charts, dropdowns, conditional formatting | Not possible via MCP | Low-Med - Nice to have |

**Real-world example:**
User managing a stock portfolio spreadsheet needs:
- Portfolio values to auto-update with formulas
- Currency formatting for dollar amounts
- Percentage formatting for returns
- Green/red conditional formatting for gains/losses
- Frozen header row when scrolling
- Multiple tabs (Portfolio, Dividends, Margin)

**Current state:** Not possible with existing MCP tools
**Desired state:** Fully automated via MCP

---

## Technical Architecture

### Google Sheets API Capabilities

The **Google Sheets API v4** provides two primary methods for modifications:

#### 1. `spreadsheets.values` Namespace (Currently Used)
- **Purpose:** Simple value updates
- **Methods:** `update()`, `append()`, `batchUpdate()`
- **Limitation:** Can only set VALUES, not formulas or formatting

#### 2. `spreadsheets.batchUpdate` Method (NEW - Required for Advanced Features)
- **Purpose:** Comprehensive sheet modifications
- **Method:** `spreadsheets.batchUpdate()`
- **Capabilities:** Accepts an array of **Request objects** that can modify:
  - Cell data (values AND formulas)
  - Cell formatting (bold, colors, number formats)
  - Sheet properties (name, frozen rows/columns)
  - Advanced features (charts, conditional formatting, data validation)

**Key Insight:**
All 10 missing features can be implemented using `batchUpdate()` with different request types.

### Implementation Strategy

**Core approach:**
Create **new MCP tools** that use `spreadsheets.batchUpdate()` with specialized request objects.

**Design principle:**
Each MCP tool = One user intention = One or more batchUpdate requests

**Example flow:**
```typescript
// User intention: "Set cell A1 to formula =SUM(B1:B10)"
MCP Tool: updateCellsWithFormula({ range: "A1", formula: "=SUM(B1:B10)" })
  ↓
Google API: spreadsheets.batchUpdate({
  requests: [{
    updateCells: {
      range: { ... },
      fields: "userEnteredValue",
      rows: [{
        values: [{
          userEnteredValue: { formulaValue: "=SUM(B1:B10)" }
        }]
      }]
    }
  }]
})
```

---

## Implementation Plan

### Phase 1: Formula Support (CRITICAL - Priority 1)

**Why first:** Most requested feature; enables dynamic spreadsheets

#### New MCP Tool: `updateCellsWithFormula`

**Purpose:** Set cell formulas instead of values

**Input Schema:**
```typescript
{
  spreadsheetId: string;      // Required
  range: string;              // A1 notation (e.g., "N25")
  formula: string;            // Formula with = prefix (e.g., "=SUM(N2:N24)")
  sheetName?: string;         // Optional, defaults to first sheet
}
```

**Implementation Steps:**

1. **Add tool definition** (in `server.setRequestHandler(ListToolsRequestSchema)`)
   ```typescript
   {
     name: "updateCellsWithFormula",
     description: "Set cell formulas in Google Sheets (e.g., =SUM(A1:A10))",
     inputSchema: { /* see above */ }
   }
   ```

2. **Implement handler** (in `server.setRequestHandler(CallToolRequestSchema)`)
   ```typescript
   case "updateCellsWithFormula": {
     // Validate inputs
     const { spreadsheetId, range, formula, sheetName } = args;

     // Get sheet ID from name
     const sheetId = await getSheetId(spreadsheetId, sheetName);

     // Parse range to GridRange
     const gridRange = parseA1Notation(range, sheetId);

     // Build batchUpdate request
     await sheets.spreadsheets.batchUpdate({
       spreadsheetId,
       requestBody: {
         requests: [{
           updateCells: {
             range: gridRange,
             fields: "userEnteredValue",
             rows: [{
               values: [{
                 userEnteredValue: {
                   formulaValue: formula
                 }
               }]
             }]
           }
         }]
       }
     });

     // Invalidate cache
     await cacheManager.invalidate(`sheet:${spreadsheetId}:*`);

     return { content: [{ type: "text", text: `Formula set: ${formula}` }] };
   }
   ```

3. **Add helper functions**
   ```typescript
   // Convert A1 notation to GridRange
   function parseA1Notation(range: string, sheetId: number): GridRange {
     // Parse "A1" → { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 1 }
     // Parse "B2:D5" → { sheetId, startRowIndex: 1, endRowIndex: 5, startColumnIndex: 1, endColumnIndex: 4 }
   }

   // Get sheet ID by name
   async function getSheetId(spreadsheetId: string, sheetName?: string): Promise<number> {
     const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
     const sheet = sheetName
       ? spreadsheet.data.sheets?.find(s => s.properties?.title === sheetName)
       : spreadsheet.data.sheets?.[0];
     return sheet?.properties?.sheetId ?? 0;
   }
   ```

4. **Add TypeScript interfaces**
   ```typescript
   interface GridRange {
     sheetId: number;
     startRowIndex: number;
     endRowIndex: number;
     startColumnIndex: number;
     endColumnIndex: number;
   }
   ```

**Testing:**
```typescript
// Test cases
updateCellsWithFormula({
  spreadsheetId: "abc123",
  range: "N25",
  formula: "=SUM(N2:N24)"
});

// Should create a cell that displays the calculated sum
// Changing N2:N24 should auto-update N25
```

**Edge Cases:**
- ⚠️ Invalid formula syntax → Return error with formula validation message
- ⚠️ Circular reference → Google Sheets will handle, return warning
- ⚠️ Multi-cell range → Apply formula to all cells in range

---

### Phase 2: Cell Formatting (CRITICAL - Priority 2)

**Why second:** Essential for readable spreadsheets; user explicitly mentioned bold headers and currency formatting

#### New MCP Tool: `formatCells`

**Purpose:** Apply text and number formatting to cells

**Input Schema:**
```typescript
{
  spreadsheetId: string;
  range: string;              // A1 notation
  format: {
    // Text formatting
    bold?: boolean;
    italic?: boolean;
    fontSize?: number;         // Points (e.g., 12)

    // Colors
    foregroundColor?: {        // Text color
      red: number;             // 0.0 - 1.0
      green: number;
      blue: number;
    };
    backgroundColor?: {        // Cell background
      red: number;
      green: number;
      blue: number;
    };

    // Number formatting
    numberFormat?: {
      type: "CURRENCY" | "PERCENT" | "DATE" | "NUMBER" | "TEXT";
      pattern?: string;        // Custom format (e.g., "$#,##0.00")
    };
  };
}
```

**Implementation Steps:**

1. **Add tool definition**
   ```typescript
   {
     name: "formatCells",
     description: "Apply formatting to cells (bold, colors, currency, etc.)",
     inputSchema: { /* see above */ }
   }
   ```

2. **Implement handler**
   ```typescript
   case "formatCells": {
     const { spreadsheetId, range, format } = args;
     const sheetId = await getSheetId(spreadsheetId);
     const gridRange = parseA1Notation(range, sheetId);

     // Build CellFormat object
     const cellFormat: CellFormat = {
       textFormat: {
         bold: format.bold,
         italic: format.italic,
         fontSize: format.fontSize,
         foregroundColor: format.foregroundColor ? {
           red: format.foregroundColor.red,
           green: format.foregroundColor.green,
           blue: format.foregroundColor.blue
         } : undefined
       },
       backgroundColor: format.backgroundColor,
       numberFormat: format.numberFormat ? {
         type: format.numberFormat.type,
         pattern: format.numberFormat.pattern
       } : undefined
     };

     // Apply via repeatCell (more efficient than updateCells for formatting)
     await sheets.spreadsheets.batchUpdate({
       spreadsheetId,
       requestBody: {
         requests: [{
           repeatCell: {
             range: gridRange,
             cell: { userEnteredFormat: cellFormat },
             fields: buildFieldMask(cellFormat) // Only update specified fields
           }
         }]
       }
     });

     await cacheManager.invalidate(`sheet:${spreadsheetId}:*`);
     return { content: [{ type: "text", text: "Formatting applied" }] };
   }
   ```

3. **Add helper for field mask**
   ```typescript
   function buildFieldMask(format: CellFormat): string {
     // Build field mask like "userEnteredFormat.textFormat.bold,userEnteredFormat.backgroundColor"
     const fields: string[] = [];
     if (format.textFormat?.bold !== undefined) fields.push("userEnteredFormat.textFormat.bold");
     if (format.textFormat?.italic !== undefined) fields.push("userEnteredFormat.textFormat.italic");
     if (format.backgroundColor) fields.push("userEnteredFormat.backgroundColor");
     if (format.numberFormat) fields.push("userEnteredFormat.numberFormat");
     return fields.join(",");
   }
   ```

**Common Formatting Presets:**
```typescript
// Helper constants for common formats
const FORMATS = {
  CURRENCY_USD: { type: "CURRENCY", pattern: "$#,##0.00" },
  PERCENT_2_DECIMALS: { type: "PERCENT", pattern: "0.00%" },
  DATE_SHORT: { type: "DATE", pattern: "M/d/yyyy" },
  HEADER_BOLD: { bold: true, fontSize: 11 },
  GREEN_BACKGROUND: { backgroundColor: { red: 0.0, green: 1.0, blue: 0.0 } },
  RED_TEXT: { foregroundColor: { red: 1.0, green: 0.0, blue: 0.0 } }
};
```

**Testing:**
```typescript
// Bold header row
formatCells({
  spreadsheetId: "abc123",
  range: "A1:Z1",
  format: { bold: true, fontSize: 11 }
});

// Currency formatting
formatCells({
  spreadsheetId: "abc123",
  range: "N2:N24",
  format: {
    numberFormat: { type: "CURRENCY", pattern: "$#,##0.00" }
  }
});

// Percentage with 2 decimals
formatCells({
  spreadsheetId: "abc123",
  range: "O2:O24",
  format: {
    numberFormat: { type: "PERCENT", pattern: "0.00%" }
  }
});
```

---

### Phase 3: Conditional Formatting (HIGH Priority)

**Why third:** Enables visual data analysis (red for losses, green for gains)

#### New MCP Tool: `addConditionalFormatting`

**Purpose:** Apply conditional formatting rules

**Input Schema:**
```typescript
{
  spreadsheetId: string;
  range: string;
  rule: {
    condition: {
      type: "NUMBER_GREATER" | "NUMBER_LESS" | "TEXT_CONTAINS" | "CUSTOM_FORMULA";
      values?: string[];       // Comparison values
      formula?: string;        // For CUSTOM_FORMULA type
    };
    format: {
      backgroundColor?: { red: number; green: number; blue: number; };
      foregroundColor?: { red: number; green: number; blue: number; };
      bold?: boolean;
    };
  };
}
```

**Implementation:**
```typescript
case "addConditionalFormatting": {
  const { spreadsheetId, range, rule } = args;
  const sheetId = await getSheetId(spreadsheetId);
  const gridRange = parseA1Notation(range, sheetId);

  // Build BooleanRule
  const booleanRule = {
    condition: {
      type: rule.condition.type,
      values: rule.condition.values?.map(v => ({ userEnteredValue: v }))
    },
    format: {
      backgroundColor: rule.format.backgroundColor,
      textFormat: {
        foregroundColor: rule.format.foregroundColor,
        bold: rule.format.bold
      }
    }
  };

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [{
        addConditionalFormatRule: {
          rule: {
            ranges: [gridRange],
            booleanRule
          },
          index: 0  // Add as first rule
        }
      }]
    }
  });

  return { content: [{ type: "text", text: "Conditional formatting added" }] };
}
```

**Example Usage:**
```typescript
// Green for gains (> 0)
addConditionalFormatting({
  spreadsheetId: "abc123",
  range: "P2:P24",  // Profit/Loss column
  rule: {
    condition: { type: "NUMBER_GREATER", values: ["0"] },
    format: { backgroundColor: { red: 0.0, green: 1.0, blue: 0.0 } }
  }
});

// Red for losses (< 0)
addConditionalFormatting({
  spreadsheetId: "abc123",
  range: "P2:P24",
  rule: {
    condition: { type: "NUMBER_LESS", values: ["0"] },
    format: { backgroundColor: { red: 1.0, green: 0.0, blue: 0.0 } }
  }
});
```

---

### Phase 4: Sheet Management (HIGH Priority)

**Why fourth:** Essential for organizing multi-tab spreadsheets

#### New MCP Tools (3 tools)

##### 4.1: `createSheet`

**Purpose:** Add a new tab/sheet to a spreadsheet

**Input Schema:**
```typescript
{
  spreadsheetId: string;
  sheetName: string;          // Name of new sheet
  index?: number;             // Position (default: end)
  rowCount?: number;          // Default: 1000
  columnCount?: number;       // Default: 26
}
```

**Implementation:**
```typescript
case "createSheet": {
  const { spreadsheetId, sheetName, index, rowCount = 1000, columnCount = 26 } = args;

  const response = await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [{
        addSheet: {
          properties: {
            title: sheetName,
            index,
            gridProperties: {
              rowCount,
              columnCount
            }
          }
        }
      }]
    }
  });

  const newSheetId = response.data.replies?.[0]?.addSheet?.properties?.sheetId;

  return {
    content: [{
      type: "text",
      text: `Sheet "${sheetName}" created with ID: ${newSheetId}`
    }]
  };
}
```

##### 4.2: `renameSheet`

**Purpose:** Rename an existing sheet/tab

**Input Schema:**
```typescript
{
  spreadsheetId: string;
  sheetId: number;            // Numeric sheet ID
  newName: string;
}
```

**Implementation:**
```typescript
case "renameSheet": {
  const { spreadsheetId, sheetId, newName } = args;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [{
        updateSheetProperties: {
          properties: {
            sheetId,
            title: newName
          },
          fields: "title"
        }
      }]
    }
  });

  return { content: [{ type: "text", text: `Sheet renamed to "${newName}"` }] };
}
```

##### 4.3: `deleteSheet`

**Purpose:** Delete a sheet/tab

**Input Schema:**
```typescript
{
  spreadsheetId: string;
  sheetId: number;
}
```

**Implementation:**
```typescript
case "deleteSheet": {
  const { spreadsheetId, sheetId } = args;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [{
        deleteSheet: { sheetId }
      }]
    }
  });

  return { content: [{ type: "text", text: "Sheet deleted" }] };
}
```

**Testing Workflow:**
```typescript
// 1. Create new sheets
createSheet({ spreadsheetId: "abc", sheetName: "Dividend Tracker" });
createSheet({ spreadsheetId: "abc", sheetName: "Margin Dashboard" });

// 2. Rename existing sheet
renameSheet({ spreadsheetId: "abc", sheetId: 0, newName: "Portfolio Overview" });

// 3. Delete unused sheet
deleteSheet({ spreadsheetId: "abc", sheetId: 123456 });
```

---

### Phase 5: Layout Controls (MEDIUM Priority)

**Why fifth:** Improves usability but not critical for functionality

#### New MCP Tools (2 tools)

##### 5.1: `freezeRowsColumns`

**Purpose:** Freeze header rows/columns for scrolling

**Input Schema:**
```typescript
{
  spreadsheetId: string;
  sheetName?: string;
  frozenRowCount?: number;    // Number of rows to freeze (default: 0)
  frozenColumnCount?: number; // Number of columns to freeze (default: 0)
}
```

**Implementation:**
```typescript
case "freezeRowsColumns": {
  const { spreadsheetId, sheetName, frozenRowCount = 0, frozenColumnCount = 0 } = args;
  const sheetId = await getSheetId(spreadsheetId, sheetName);

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [{
        updateSheetProperties: {
          properties: {
            sheetId,
            gridProperties: {
              frozenRowCount,
              frozenColumnCount
            }
          },
          fields: "gridProperties.frozenRowCount,gridProperties.frozenColumnCount"
        }
      }]
    }
  });

  return { content: [{ type: "text", text: `Frozen ${frozenRowCount} rows, ${frozenColumnCount} columns` }] };
}
```

##### 5.2: `setColumnWidth`

**Purpose:** Adjust column widths

**Input Schema:**
```typescript
{
  spreadsheetId: string;
  sheetName?: string;
  columns: Array<{
    columnIndex: number;      // 0-based (A=0, B=1, etc.)
    width: number;            // Pixels (default: 100)
  }>;
}
```

**Implementation:**
```typescript
case "setColumnWidth": {
  const { spreadsheetId, sheetName, columns } = args;
  const sheetId = await getSheetId(spreadsheetId, sheetName);

  const requests = columns.map(col => ({
    updateDimensionProperties: {
      range: {
        sheetId,
        dimension: "COLUMNS",
        startIndex: col.columnIndex,
        endIndex: col.columnIndex + 1
      },
      properties: {
        pixelSize: col.width
      },
      fields: "pixelSize"
    }
  }));

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests }
  });

  return { content: [{ type: "text", text: `Updated ${columns.length} column widths` }] };
}
```

**Example Usage:**
```typescript
// Freeze first row (header)
freezeRowsColumns({
  spreadsheetId: "abc123",
  frozenRowCount: 1
});

// Adjust column widths
setColumnWidth({
  spreadsheetId: "abc123",
  columns: [
    { columnIndex: 0, width: 150 },  // Column A: Ticker symbol
    { columnIndex: 1, width: 250 },  // Column B: Company name
    { columnIndex: 13, width: 120 }  // Column N: Total value
  ]
});
```

---

### Phase 6: Advanced Features (NICE TO HAVE - Low-Med Priority)

**Why last:** Nice-to-have features; less critical for MVP

#### 6.1: `mergeCells`

**Purpose:** Merge cells for headers

**Input Schema:**
```typescript
{
  spreadsheetId: string;
  range: string;              // A1 notation for range to merge
  mergeType?: "MERGE_ALL" | "MERGE_COLUMNS" | "MERGE_ROWS";
}
```

**Implementation:**
```typescript
case "mergeCells": {
  const { spreadsheetId, range, mergeType = "MERGE_ALL" } = args;
  const sheetId = await getSheetId(spreadsheetId);
  const gridRange = parseA1Notation(range, sheetId);

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [{
        mergeCells: {
          range: gridRange,
          mergeType
        }
      }]
    }
  });

  return { content: [{ type: "text", text: "Cells merged" }] };
}
```

#### 6.2: `setDataValidation`

**Purpose:** Create dropdown menus and validation rules

**Input Schema:**
```typescript
{
  spreadsheetId: string;
  range: string;
  validation: {
    type: "LIST_OF_VALUES" | "NUMBER_BETWEEN" | "DATE_AFTER";
    values?: string[];        // For dropdown lists
    min?: number;             // For number/date ranges
    max?: number;
    strict?: boolean;         // Reject invalid input?
    showDropdown?: boolean;   // Show dropdown UI?
  };
}
```

**Implementation:**
```typescript
case "setDataValidation": {
  const { spreadsheetId, range, validation } = args;
  const sheetId = await getSheetId(spreadsheetId);
  const gridRange = parseA1Notation(range, sheetId);

  const dataValidation = {
    condition: {
      type: validation.type,
      values: validation.values?.map(v => ({ userEnteredValue: v }))
    },
    strict: validation.strict ?? true,
    showCustomUi: validation.showDropdown ?? true
  };

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [{
        setDataValidation: {
          range: gridRange,
          rule: dataValidation
        }
      }]
    }
  });

  return { content: [{ type: "text", text: "Data validation applied" }] };
}
```

#### 6.3: `createChart`

**Purpose:** Create charts from data

**Input Schema:**
```typescript
{
  spreadsheetId: string;
  sheetName?: string;
  chartType: "LINE" | "BAR" | "COLUMN" | "PIE" | "SCATTER";
  dataRange: string;          // A1 notation for source data
  position: {
    row: number;              // Where to place chart
    column: number;
  };
  title?: string;
}
```

**Implementation:**
```typescript
case "createChart": {
  const { spreadsheetId, sheetName, chartType, dataRange, position, title } = args;
  const sheetId = await getSheetId(spreadsheetId, sheetName);
  const sourceRange = parseA1Notation(dataRange, sheetId);

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [{
        addChart: {
          chart: {
            spec: {
              title,
              basicChart: {
                chartType,
                domains: [{ domain: { sourceRange } }],
                series: [{ series: { sourceRange } }]
              }
            },
            position: {
              overlayPosition: {
                anchorCell: {
                  sheetId,
                  rowIndex: position.row,
                  columnIndex: position.column
                }
              }
            }
          }
        }
      }]
    }
  });

  return { content: [{ type: "text", text: `${chartType} chart created` }] };
}
```

**Example Usage:**
```typescript
// Dropdown for Layer 1/2 selection
setDataValidation({
  spreadsheetId: "abc123",
  range: "F2:F24",  // Layer column
  validation: {
    type: "LIST_OF_VALUES",
    values: ["Layer 1", "Layer 2"],
    showDropdown: true
  }
});

// Chart for dividend income over time
createChart({
  spreadsheetId: "abc123",
  chartType: "LINE",
  dataRange: "A1:B12",  // Month & Dividend Income
  position: { row: 15, column: 0 },
  title: "Monthly Dividend Income"
});
```

---

## Implementation Checklist

### Phase 1: Formulas ✅
- [ ] Add `updateCellsWithFormula` tool definition
- [ ] Implement handler with `batchUpdate` + `updateCells` request
- [ ] Add `parseA1Notation()` helper function
- [ ] Add `getSheetId()` helper function
- [ ] Add TypeScript interfaces (`GridRange`)
- [ ] Test with `=SUM()`, `=AVERAGE()`, cell references
- [ ] Update cache invalidation logic

### Phase 2: Formatting ✅
- [ ] Add `formatCells` tool definition
- [ ] Implement handler with `repeatCell` request
- [ ] Add `buildFieldMask()` helper function
- [ ] Add common format presets (currency, percent, bold)
- [ ] Test text formatting (bold, italic, fontSize)
- [ ] Test colors (foreground, background)
- [ ] Test number formatting (currency, percent, date)

### Phase 3: Conditional Formatting ✅
- [ ] Add `addConditionalFormatting` tool definition
- [ ] Implement handler with `addConditionalFormatRule` request
- [ ] Support common condition types (NUMBER_GREATER, NUMBER_LESS, TEXT_CONTAINS)
- [ ] Test green/red conditional formatting for gains/losses
- [ ] Document rule priority and conflicts

### Phase 4: Sheet Management ✅
- [ ] Add `createSheet` tool definition
- [ ] Implement `createSheet` handler with `addSheet` request
- [ ] Add `renameSheet` tool definition
- [ ] Implement `renameSheet` handler with `updateSheetProperties` request
- [ ] Add `deleteSheet` tool definition
- [ ] Implement `deleteSheet` handler with `deleteSheet` request
- [ ] Test creating multiple sheets
- [ ] Test renaming sheets
- [ ] Test deleting sheets (with warnings)

### Phase 5: Layout Controls ✅
- [ ] Add `freezeRowsColumns` tool definition
- [ ] Implement handler with `updateSheetProperties` request
- [ ] Add `setColumnWidth` tool definition
- [ ] Implement handler with `updateDimensionProperties` request
- [ ] Support batch column width updates
- [ ] Test freezing rows and columns simultaneously
- [ ] Test adjusting multiple column widths

### Phase 6: Advanced Features ✅
- [ ] Add `mergeCells` tool definition
- [ ] Implement handler with `mergeCells` request
- [ ] Add `setDataValidation` tool definition
- [ ] Implement handler with `setDataValidation` request
- [ ] Add `createChart` tool definition
- [ ] Implement handler with `addChart` request
- [ ] Test dropdown validation
- [ ] Test chart creation with various types

### Cross-Cutting Concerns ✅
- [ ] Update cache invalidation for all write operations
- [ ] Add performance monitoring for new tools
- [ ] Update Winston logging for new operations
- [ ] Add error handling for Google API errors
- [ ] Add TypeScript type safety for all interfaces
- [ ] Update CLAUDE.md documentation
- [ ] Add CHANGELOG entry
- [ ] Update README with new features

---

## Testing Strategy

### Unit Tests

**Test file:** `src/__tests__/sheets-advanced.test.ts`

```typescript
describe('Advanced Sheets Operations', () => {
  describe('Formula Support', () => {
    it('should set cell formula', async () => {
      // Test updateCellsWithFormula
    });

    it('should handle invalid formulas', async () => {
      // Test error handling
    });
  });

  describe('Cell Formatting', () => {
    it('should apply bold formatting', async () => {
      // Test formatCells with bold
    });

    it('should apply currency formatting', async () => {
      // Test numberFormat with CURRENCY
    });

    it('should apply multiple formats simultaneously', async () => {
      // Test combined formatting
    });
  });

  describe('Sheet Management', () => {
    it('should create new sheet', async () => {
      // Test createSheet
    });

    it('should rename sheet', async () => {
      // Test renameSheet
    });

    it('should delete sheet', async () => {
      // Test deleteSheet
    });
  });

  // Additional test suites for other features...
});
```

### Integration Tests

**Real Google Sheets test:**

1. Create test spreadsheet
2. Run all MCP tools in sequence
3. Verify results in Google Sheets UI
4. Clean up test spreadsheet

### End-to-End Test (User Workflow)

**Scenario:** Create a stock portfolio tracker

```typescript
// 1. Create new sheets
await createSheet({ spreadsheetId, sheetName: "Portfolio" });
await createSheet({ spreadsheetId, sheetName: "Dividends" });

// 2. Set up headers with formatting
await updateCells({ spreadsheetId, range: "A1:P1", values: [[headers]] });
await formatCells({ spreadsheetId, range: "A1:P1", format: { bold: true } });

// 3. Add data
await appendRows({ spreadsheetId, values: portfolioData });

// 4. Add formulas
await updateCellsWithFormula({ spreadsheetId, range: "N25", formula: "=SUM(N2:N24)" });

// 5. Format numbers
await formatCells({
  spreadsheetId,
  range: "N2:N24",
  format: { numberFormat: { type: "CURRENCY", pattern: "$#,##0.00" } }
});

// 6. Add conditional formatting
await addConditionalFormatting({
  spreadsheetId,
  range: "P2:P24",
  rule: {
    condition: { type: "NUMBER_GREATER", values: ["0"] },
    format: { backgroundColor: { red: 0.0, green: 1.0, blue: 0.0 } }
  }
});

// 7. Freeze header row
await freezeRowsColumns({ spreadsheetId, frozenRowCount: 1 });

// 8. Adjust column widths
await setColumnWidth({
  spreadsheetId,
  columns: [
    { columnIndex: 0, width: 80 },   // Ticker
    { columnIndex: 1, width: 200 },  // Name
    { columnIndex: 13, width: 120 }  // Total Value
  ]
});

// Result: Fully formatted, functional portfolio tracker! 🎉
```

---

## Error Handling

### Common Errors and Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| `Invalid A1 notation` | Malformed range string | Validate format with regex before parsing |
| `Sheet not found` | Invalid sheet ID/name | Check sheet exists before operation |
| `Invalid formula syntax` | Bad formula string | Return descriptive error from Google API |
| `Circular reference` | Formula references itself | Allow Google Sheets to handle, return warning |
| `Permission denied` | Insufficient OAuth scopes | Check OAuth scopes include `spreadsheets` (not just `readonly`) |
| `Range exceeds sheet dimensions` | Range outside sheet boundaries | Validate range against sheet dimensions |

### Error Response Format

```typescript
// Standardized error response
return {
  content: [{
    type: "text",
    text: JSON.stringify({
      error: true,
      message: "Invalid formula syntax",
      details: "Formula must start with '=' character",
      formula: userInput,
      suggestions: ["Try: =SUM(A1:A10)", "Try: =AVERAGE(B2:B20)"]
    }, null, 2)
  }]
};
```

---

## Security Considerations

### OAuth Scopes

**Current scope:** `https://www.googleapis.com/auth/drive` (full access)

**Required for advanced features:** Same scope is sufficient

**Verification:**
- Check `gcp-oauth.keys.json` includes Drive scope
- Ensure credentials file has full spreadsheets access
- No additional OAuth consent required

### Input Validation

**Critical validations:**

1. **Spreadsheet ID format** - Must be valid Google Sheets ID
2. **Range validation** - A1 notation must be well-formed
3. **Formula sanitization** - Prevent malicious formula injection
4. **Color values** - RGB values must be 0.0-1.0
5. **Sheet name** - Prevent special characters that break API

**Example validation:**
```typescript
function validateA1Notation(range: string): boolean {
  const a1Regex = /^[A-Z]+[0-9]+(:[A-Z]+[0-9]+)?$/;
  return a1Regex.test(range);
}

function validateSpreadsheetId(id: string): boolean {
  // Google Sheets IDs are 44 characters
  return /^[a-zA-Z0-9-_]{44}$/.test(id);
}
```

### Rate Limiting

**Google Sheets API quotas:**
- **Read requests:** 100 requests per 100 seconds per user
- **Write requests:** 100 requests per 100 seconds per user

**Mitigation strategies:**
- Use `batchUpdate` for multiple operations (1 API call instead of many)
- Implement exponential backoff on rate limit errors
- Cache read operations when possible

---

## Performance Optimization

### Batch Operations

**Problem:** Multiple MCP tool calls = Multiple API requests

**Solution:** Add **batch operation tools**

#### New MCP Tool: `batchSheetOperations`

**Purpose:** Execute multiple operations in one API call

**Example:**
```typescript
// Instead of this (3 API calls):
await updateCellsWithFormula({ ... });
await formatCells({ ... });
await freezeRowsColumns({ ... });

// Do this (1 API call):
await batchSheetOperations({
  spreadsheetId: "abc123",
  operations: [
    { type: "formula", range: "N25", formula: "=SUM(N2:N24)" },
    { type: "format", range: "A1:P1", format: { bold: true } },
    { type: "freeze", frozenRowCount: 1 }
  ]
});
```

**Implementation:**
```typescript
case "batchSheetOperations": {
  const { spreadsheetId, operations } = args;
  const requests: Request[] = [];

  // Build array of requests
  for (const op of operations) {
    switch (op.type) {
      case "formula":
        requests.push(buildFormulaRequest(op));
        break;
      case "format":
        requests.push(buildFormatRequest(op));
        break;
      case "freeze":
        requests.push(buildFreezeRequest(op));
        break;
    }
  }

  // Single API call with all requests
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests }
  });

  return { content: [{ type: "text", text: `Executed ${requests.length} operations` }] };
}
```

### Caching Strategy

**Existing cache:** Redis for read operations

**New cache keys:**
- `sheet:${spreadsheetId}:metadata` - Sheet names, IDs, dimensions
- `sheet:${spreadsheetId}:format:${range}` - Cell formats (optional)

**Cache invalidation:**
- Invalidate on ALL write operations
- Pattern: `sheet:${spreadsheetId}:*`

---

## Documentation Updates

### README.md

Add new section:

```markdown
## Advanced Google Sheets Operations

### Formula Support
- `updateCellsWithFormula` - Set cell formulas (e.g., =SUM(A1:A10))

### Cell Formatting
- `formatCells` - Apply text formatting (bold, colors) and number formats (currency, percent)

### Conditional Formatting
- `addConditionalFormatting` - Apply conditional formatting rules

### Sheet Management
- `createSheet` - Create new sheets/tabs
- `renameSheet` - Rename existing sheets
- `deleteSheet` - Delete sheets

### Layout Controls
- `freezeRowsColumns` - Freeze header rows/columns
- `setColumnWidth` - Adjust column widths

### Advanced Features
- `mergeCells` - Merge cells for headers
- `setDataValidation` - Create dropdown menus
- `createChart` - Generate charts from data

### Batch Operations
- `batchSheetOperations` - Execute multiple operations efficiently
```

### CLAUDE.md

Update tools section:

```markdown
## Google Sheets Tools

### Basic Operations
- search, read, listSheets, readSheet
- createFile, updateFile, createFolder
- updateCells, appendRows

### Advanced Operations (NEW)
- **Formulas:** updateCellsWithFormula
- **Formatting:** formatCells, addConditionalFormatting
- **Sheet Management:** createSheet, renameSheet, deleteSheet
- **Layout:** freezeRowsColumns, setColumnWidth
- **Advanced:** mergeCells, setDataValidation, createChart
- **Batch:** batchSheetOperations
```

### CHANGELOG.md

Add entry:

```markdown
## [1.4.0] - 2025-10-XX

### Added - Google Sheets Advanced Features
- **Formula Support** - `updateCellsWithFormula` for setting cell formulas
- **Cell Formatting** - `formatCells` for text styles, colors, number formats
- **Conditional Formatting** - `addConditionalFormatting` for conditional formatting rules
- **Sheet Management** - `createSheet`, `renameSheet`, `deleteSheet` for tab management
- **Layout Controls** - `freezeRowsColumns` and `setColumnWidth` for layout customization
- **Advanced Features** - `mergeCells`, `setDataValidation`, `createChart`
- **Batch Operations** - `batchSheetOperations` for efficient multi-operation execution

### Technical Details
- All features implemented using `spreadsheets.batchUpdate()` API
- Added helper functions: `parseA1Notation()`, `getSheetId()`, `buildFieldMask()`
- Enhanced cache invalidation for write operations
- Added TypeScript interfaces for new request types
```

---

## Migration Guide

### For Existing Users

**Breaking Changes:** None ✅

All existing MCP tools continue to work unchanged.

**New Capabilities:**

1. **Replace value-based updates with formulas:**
   ```typescript
   // Old way (static value)
   updateCells({ range: "N25", values: [[200170.81]] });

   // New way (dynamic formula)
   updateCellsWithFormula({ range: "N25", formula: "=SUM(N2:N24)" });
   ```

2. **Add formatting to existing sheets:**
   ```typescript
   // Format headers
   formatCells({ range: "A1:P1", format: { bold: true, fontSize: 11 } });

   // Format currency columns
   formatCells({
     range: "N2:N24",
     format: { numberFormat: { type: "CURRENCY", pattern: "$#,##0.00" } }
   });
   ```

3. **Organize with multiple sheets:**
   ```typescript
   // Create organized structure
   createSheet({ sheetName: "Portfolio Overview" });
   createSheet({ sheetName: "Dividend Tracker" });
   createSheet({ sheetName: "Margin Dashboard" });
   ```

---

## Success Criteria

### Definition of Done

✅ **Phase 1 Complete** when:
- User can set formulas that auto-update
- Test suite passes for all formula types
- Documentation includes examples

✅ **Phase 2 Complete** when:
- User can format text (bold, colors, fonts)
- User can format numbers (currency, percent)
- All formatting tests pass

✅ **Phase 3 Complete** when:
- User can add conditional formatting rules
- Red/green conditional formatting works for gains/losses
- Tests verify rule application

✅ **Phase 4 Complete** when:
- User can create, rename, delete sheets
- Multi-sheet workflows function correctly
- Tests cover all sheet operations

✅ **Phase 5 Complete** when:
- User can freeze rows/columns
- User can adjust column widths
- Layout tests pass

✅ **Phase 6 Complete** when:
- User can merge cells, add dropdowns, create charts
- All advanced features documented
- Full test coverage

✅ **Project Complete** when:
- All 10 requested features implemented
- User can build stock portfolio tracker end-to-end
- Documentation updated
- CHANGELOG published
- Zero breaking changes to existing tools

---

## Timeline Estimate

**For 1 developer, non-entrepreneur pace:**

| Phase | Tasks | Est. Time | Notes |
|-------|-------|-----------|-------|
| **Phase 1** | Formula support | 4-6 hours | Core helpers + 1 tool |
| **Phase 2** | Cell formatting | 4-6 hours | Complex formatting logic |
| **Phase 3** | Conditional formatting | 2-3 hours | Reuse helpers from Phase 2 |
| **Phase 4** | Sheet management | 3-4 hours | 3 simple tools |
| **Phase 5** | Layout controls | 2-3 hours | 2 straightforward tools |
| **Phase 6** | Advanced features | 6-8 hours | 3 complex tools |
| **Testing** | Unit + integration tests | 6-8 hours | Comprehensive coverage |
| **Documentation** | README, CLAUDE.md, CHANGELOG | 2-3 hours | Writing + examples |
| **Buffer** | Bug fixes, edge cases | 4-6 hours | 20% buffer |
| **TOTAL** | | **33-47 hours** | ~1 week full-time or ~2-3 weeks part-time |

**For your pace (entrepreneur with limited coding experience):**

- **Recommendation:** Implement **Phase 1-4** first (critical features)
- **Timeline:** 2-3 weeks, working in small increments
- **Approach:**
  1. Complete Phase 1 (formulas) - Test thoroughly
  2. Complete Phase 2 (formatting) - Test thoroughly
  3. Complete Phase 3 (conditional formatting) - Test thoroughly
  4. Complete Phase 4 (sheet management) - Test thoroughly
  5. Pause and evaluate need for Phases 5-6

**Warning Signals:**
- ⚠️ **LARGE CHANGE ALERT** - Each phase modifies core `index.ts` file
- ⛔ **HIGH RISK** - Phases 2-3 have complex formatting logic
- 💬 **LEARNING OPPORTUNITY** - Good time to understand `batchUpdate` API deeply

**Mitigation:**
- Make one small change at a time
- Test after each tool implementation
- Commit to git after each successful test
- Ask for code review at end of each phase

---

## Potential Challenges

### Challenge 1: A1 Notation Parsing

**Problem:** Converting "B2:D5" to `{ startRowIndex: 1, endRowIndex: 5, startColumnIndex: 1, endColumnIndex: 4 }`

**Solution:** Use a library or implement robust parser

**Recommended library:**
```bash
npm install a1-notation
```

**Or implement manually:**
```typescript
function columnLetterToIndex(letter: string): number {
  // A=0, B=1, ..., Z=25, AA=26, etc.
  let index = 0;
  for (let i = 0; i < letter.length; i++) {
    index = index * 26 + (letter.charCodeAt(i) - 'A'.charCodeAt(0) + 1);
  }
  return index - 1;
}

function parseA1Notation(range: string, sheetId: number): GridRange {
  // Parse "A1" or "A1:B10"
  const parts = range.split(':');
  const start = parts[0];
  const end = parts[1] || start;

  const startMatch = start.match(/([A-Z]+)([0-9]+)/);
  const endMatch = end.match(/([A-Z]+)([0-9]+)/);

  if (!startMatch || !endMatch) {
    throw new Error(`Invalid A1 notation: ${range}`);
  }

  return {
    sheetId,
    startRowIndex: parseInt(startMatch[2]) - 1,
    endRowIndex: parseInt(endMatch[2]),
    startColumnIndex: columnLetterToIndex(startMatch[1]),
    endColumnIndex: columnLetterToIndex(endMatch[1]) + 1
  };
}
```

### Challenge 2: Field Mask Generation

**Problem:** Google Sheets API requires specifying which fields to update

**Solution:** Build field mask dynamically based on provided fields

**Example:**
```typescript
function buildFieldMask(obj: any, prefix = ''): string[] {
  const fields: string[] = [];
  for (const key in obj) {
    if (obj[key] !== undefined) {
      const path = prefix ? `${prefix}.${key}` : key;
      if (typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
        fields.push(...buildFieldMask(obj[key], path));
      } else {
        fields.push(path);
      }
    }
  }
  return fields;
}

// Usage:
const format = { textFormat: { bold: true }, backgroundColor: { red: 1.0 } };
const mask = buildFieldMask({ userEnteredFormat: format });
// Result: ["userEnteredFormat.textFormat.bold", "userEnteredFormat.backgroundColor.red"]
```

### Challenge 3: Type Safety

**Problem:** Google Sheets API types from googleapis are complex

**Solution:** Create simplified interfaces for MCP tools

**Example:**
```typescript
// Simplified interface for MCP tool
interface SimpleCellFormat {
  bold?: boolean;
  italic?: boolean;
  fontSize?: number;
  foregroundColor?: { red: number; green: number; blue: number; };
  backgroundColor?: { red: number; green: number; blue: number; };
}

// Conversion function
function toGoogleCellFormat(simple: SimpleCellFormat): CellFormat {
  return {
    textFormat: {
      bold: simple.bold,
      italic: simple.italic,
      fontSize: simple.fontSize ? { magnitude: simple.fontSize, unit: 'PT' } : undefined,
      foregroundColor: simple.foregroundColor ? {
        red: simple.foregroundColor.red,
        green: simple.foregroundColor.green,
        blue: simple.foregroundColor.blue
      } : undefined
    },
    backgroundColor: simple.backgroundColor
  };
}
```

---

## Risk Assessment

### Low Risk ✅
- **Sheet management tools** (createSheet, renameSheet, deleteSheet) - Straightforward API calls
- **Layout tools** (freezeRowsColumns, setColumnWidth) - Simple property updates
- **Formula tool** (updateCellsWithFormula) - Single request type

### Medium Risk ⚠️
- **Cell formatting** - Complex nested objects, many optional fields
- **A1 notation parsing** - Edge cases (AA1, Z999, multi-sheet ranges)
- **Conditional formatting** - Complex rule syntax

### High Risk ⛔
- **Batch operations** - Requires careful request ordering
- **Charts** - Complex chart spec structure
- **Data validation** - Many condition types to support

### Mitigation Strategies
1. **Start with low-risk features** (Phase 1, 4, 5)
2. **Test incrementally** after each tool implementation
3. **Use Google Sheets API Playground** to verify request structures
4. **Add comprehensive error handling** for all edge cases
5. **Commit frequently** to git for easy rollback

---

## Questions for User

Before implementation, please confirm:

1. **Priority:** Should we implement all 10 features or focus on critical ones (Phases 1-4)?
2. **Timeline:** Are you okay with 2-3 weeks of incremental development?
3. **Testing:** Do you have a test Google Sheets document we can use?
4. **Batch operations:** Do you want `batchSheetOperations` tool for efficiency?
5. **Advanced features:** Are charts/data validation must-haves or nice-to-haves?

---

## Conclusion

This implementation plan provides a **comprehensive roadmap** to add 10 critical features to your Google Sheets MCP integration. The phased approach allows for:

✅ **Incremental progress** - Deliver value in small chunks
✅ **Risk management** - Start with simpler features
✅ **Testing at every step** - Ensure quality
✅ **Zero breaking changes** - Existing tools continue working
✅ **Real-world readiness** - Production-ready for 10-20 users

**Next Steps:**
1. Review this plan
2. Confirm priorities and timeline
3. Begin Phase 1 implementation (formulas)
4. Test thoroughly
5. Iterate through phases

**Final Note:**
This plan is designed for **entrepreneurs with limited coding experience**. Each phase includes:
- Detailed code examples
- Step-by-step instructions
- Warning signals for complex changes
- Testing strategies
- Clear success criteria

Take your time, implement one phase at a time, and test thoroughly. You've got this! 💪
