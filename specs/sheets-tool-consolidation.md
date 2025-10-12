# Google Sheets Tools Consolidation Plan

**Created:** 2025-10-11
**Timeline:** 20 minutes
**Objective:** Refactor 9 individual Google Sheets tools into 1 consolidated `sheets` tool with operations

---

## Current State

We just implemented **9 individual Google Sheets tools**:
1. `listSheets`
2. `readSheet`
3. `createSheet`
4. `renameSheet`
5. `deleteSheet`
6. `updateCells`
7. `updateCellsWithFormula`
8. `formatCells`
9. `addConditionalFormatting`
10. `appendRows`
11. `freezeRowsColumns`
12. `setColumnWidth`

**Problem:** This overwhelms LLMs with too many tools. Original architecture used operations within tools.

---

## Target State

**ONE tool:** `sheets` with 12 operations

```typescript
{
  name: "sheets",
  description: "Perform Google Sheets operations",
  inputSchema: {
    type: "object",
    properties: {
      operation: {
        type: "string",
        enum: [
          "list",
          "read",
          "create",
          "rename",
          "delete",
          "update",
          "updateFormula",
          "format",
          "conditionalFormat",
          "append",
          "freeze",
          "setColumnWidth"
        ]
      },
      spreadsheetId: { type: "string" },
      // All other params from existing tools
      sheetName: { type: "string" },
      sheetId: { type: "number" },
      range: { type: "string" },
      values: { type: "array" },
      formula: { type: "string" },
      format: { type: "object" },
      rule: { type: "object" },
      frozenRowCount: { type: "number" },
      frozenColumnCount: { type: "number" },
      columns: { type: "array" },
      newName: { type: "string" },
      rowCount: { type: "number" },
      columnCount: { type: "number" },
      tabColor: { type: "object" }
    },
    required: ["operation", "spreadsheetId"]
  }
}
```

---

## Implementation Steps (20 minutes)

### Step 1: Add New Consolidated Tool Schema (5 min)

**Location:** `index.ts` around line 930

1. Add new tool definition with all 12 operations
2. Include ALL parameters from the 9 existing tools
3. Make parameters optional except `operation` and `spreadsheetId`

### Step 2: Create Operation Router Handler (10 min)

**Location:** `index.ts` around line 2020 (before existing sheet handlers)

```typescript
case "sheets": {
  const { operation, ...params } = args;

  switch (operation) {
    case "list": {
      // Copy logic from listSheets handler
      break;
    }
    case "read": {
      // Copy logic from readSheet handler
      break;
    }
    case "create": {
      // Copy logic from createSheet handler
      break;
    }
    case "rename": {
      // Copy logic from renameSheet handler
      break;
    }
    case "delete": {
      // Copy logic from deleteSheet handler
      break;
    }
    case "update": {
      // Copy logic from updateCells handler
      break;
    }
    case "updateFormula": {
      // Copy logic from updateCellsWithFormula handler
      break;
    }
    case "format": {
      // Copy logic from formatCells handler
      break;
    }
    case "conditionalFormat": {
      // Copy logic from addConditionalFormatting handler
      break;
    }
    case "append": {
      // Copy logic from appendRows handler
      break;
    }
    case "freeze": {
      // Copy logic from freezeRowsColumns handler
      break;
    }
    case "setColumnWidth": {
      // Copy logic from setColumnWidth handler
      break;
    }
    default:
      throw new Error(`Unknown operation: ${operation}`);
  }
  break;
}
```

### Step 3: Remove Old Tools (3 min)

1. **Delete old tool schemas** (lines ~936-1390)
   - Remove `listSheets` schema
   - Remove `readSheet` schema
   - Remove `createSheet` schema
   - Remove `renameSheet` schema
   - Remove `deleteSheet` schema
   - Remove `updateCells` schema
   - Remove `updateCellsWithFormula` schema
   - Remove `formatCells` schema
   - Remove `addConditionalFormatting` schema
   - Remove `appendRows` schema
   - Remove `freezeRowsColumns` schema
   - Remove `setColumnWidth` schema

2. **Delete old case handlers** (lines ~2023-2700)
   - Remove all 12 individual case blocks

### Step 4: Test (2 min)

Run quick test of all 12 operations using the test spreadsheet.

---

## Operation Parameter Requirements

| Operation | Required Params |
|-----------|-----------------|
| `list` | spreadsheetId |
| `read` | spreadsheetId, range |
| `create` | spreadsheetId, sheetName |
| `rename` | spreadsheetId, (sheetName OR sheetId), newName |
| `delete` | spreadsheetId, (sheetName OR sheetId) |
| `update` | spreadsheetId, range, values |
| `updateFormula` | spreadsheetId, range, formula |
| `format` | spreadsheetId, range, format |
| `conditionalFormat` | spreadsheetId, range, rule |
| `append` | spreadsheetId, values |
| `freeze` | spreadsheetId, frozenRowCount, frozenColumnCount |
| `setColumnWidth` | spreadsheetId, columns |

---

## File Changes

**File:** `index.ts`

**Changes:**
- **ADD:** 1 new consolidated tool schema (~80 lines)
- **ADD:** 1 new operation router handler (~300 lines)
- **DELETE:** 12 individual tool schemas (~450 lines)
- **DELETE:** 12 individual case handlers (~680 lines)

**Net Result:** ~750 lines removed, ~380 lines added = **370 lines smaller**

---

## Testing Checklist

Test each operation once:

- [ ] `list` - List all sheets
- [ ] `read` - Read range from sheet
- [ ] `create` - Create new sheet
- [ ] `rename` - Rename a sheet
- [ ] `delete` - Delete a sheet
- [ ] `update` - Update cells with values
- [ ] `updateFormula` - Set formula in cell
- [ ] `format` - Format cells
- [ ] `conditionalFormat` - Add conditional formatting
- [ ] `append` - Append rows
- [ ] `freeze` - Freeze rows/columns
- [ ] `setColumnWidth` - Set column widths

---

## Timeline

| Task | Time | Cumulative |
|------|------|------------|
| Add consolidated tool schema | 5 min | 5 min |
| Create operation router | 10 min | 15 min |
| Remove old tools & handlers | 3 min | 18 min |
| Test all operations | 2 min | 20 min |

---

## Example Usage

```typescript
// List sheets
sheets({ operation: "list", spreadsheetId: "abc123" })

// Create and format
sheets({
  operation: "create",
  spreadsheetId: "abc123",
  sheetName: "Report"
})

sheets({
  operation: "format",
  spreadsheetId: "abc123",
  range: "Report!A1:E1",
  format: { bold: true, backgroundColor: {...} }
})

// Freeze header
sheets({
  operation: "freeze",
  spreadsheetId: "abc123",
  frozenRowCount: 1
})
```

---

## Success Criteria

✅ Only 1 `sheets` tool exposed (not 12)
✅ All 12 operations work identically to before
✅ Tool count reduced from 41 to 30
✅ Tests pass
✅ Cleaner, more maintainable code
