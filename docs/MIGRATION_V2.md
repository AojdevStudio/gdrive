# Migration Guide: v1.x → v2.0.0

## Overview

Google Drive MCP Server v2.0.0 introduces a **major breaking change** to improve LLM tool selection performance and code maintainability. We've consolidated **41+ individual tools** into **5 operation-based tools**, reducing tool count by 88%.

### What Changed

Previously, each operation was implemented as a separate tool (e.g., `listSheets`, `readSheet`, `createSheet`). Now, related operations are grouped under unified tools with an `operation` parameter (e.g., `sheets` tool with operations: `list`, `read`, `create`).

### Why This Change?

- **Faster LLM Tool Selection:** With 88% fewer tools (41+ → 5), AI assistants can identify the correct tool more quickly
- **Better Type Safety:** Zod discriminated unions ensure compile-time type checking for all operations
- **Cleaner Codebase:** Centralized handlers eliminate code duplication
- **Future-Proof:** Follows 2025 MCP architecture patterns from [HOW2MCP](https://github.com/modelcontextprotocol/servers)

### Migration Effort

**Estimated Time:** 5-15 minutes per integration, depending on complexity

All existing tool calls must be updated, but the parameter structures remain largely the same. Only the tool name and addition of an `operation` field are required.

---

## Breaking Changes Summary

| Old Tool (v1.x) | New Tool (v2.0.0) | Operation | Notes |
|-----------------|-------------------|-----------|-------|
| **Google Sheets** | | | |
| `listSheets` | `sheets` | `"list"` | Lists all sheets in a spreadsheet |
| `readSheet` | `sheets` | `"read"` | Reads data from a range |
| `createSheet` | `sheets` | `"create"` | Creates a new sheet |
| `renameSheet` | `sheets` | `"rename"` | Renames an existing sheet |
| `deleteSheet` | `sheets` | `"delete"` | Deletes a sheet |
| `updateCells` | `sheets` | `"update"` | Updates cell values |
| `updateCellsWithFormula` | `sheets` | `"updateFormula"` | Applies formulas to cells |
| `formatCells` | `sheets` | `"format"` | Applies cell formatting |
| `addConditionalFormatting` | `sheets` | `"conditionalFormat"` | Adds conditional formatting rules |
| `appendRows` | `sheets` | `"append"` | Appends rows to a sheet |
| `freezeRowsColumns` | `sheets` | `"freeze"` | Freezes header rows/columns |
| `setColumnWidth` | `sheets` | `"setColumnWidth"` | Adjusts column widths |
| **Google Drive** | | | |
| `search` | `drive` | `"search"` | Searches files with queries |
| `enhancedSearch` | `drive` | `"enhancedSearch"` | Advanced search with filters |
| `read` | `drive` | `"read"` | Reads file contents |
| `createFile` | `drive` | `"create"` | Creates new files |
| `updateFile` | `drive` | `"update"` | Updates existing files |
| `createFolder` | `drive` | `"createFolder"` | Creates new folders |
| `batchFileOperations` | `drive` | `"batch"` | Batch file operations |
| **Google Forms** | | | |
| `createForm` | `forms` | `"create"` | Creates new forms |
| `getForm` | `forms` | `"get"` | Retrieves form details |
| `addQuestion` | `forms` | `"addQuestion"` | Adds questions to forms |
| `listResponses` | `forms` | `"listResponses"` | Gets form responses |
| **Google Docs** | | | |
| `createDocument` | `docs` | `"create"` | Creates new documents |
| `insertText` | `docs` | `"insertText"` | Inserts text at positions |
| `replaceText` | `docs` | `"replaceText"` | Find and replace text |
| `applyTextStyle` | `docs` | `"applyTextStyle"` | Applies text formatting |
| `insertTable` | `docs` | `"insertTable"` | Inserts tables |
| **Batch Operations** | | | |
| `batchFileOperations` (create) | `batch` | `"create"` | Creates multiple files |
| `batchFileOperations` (update) | `batch` | `"update"` | Updates multiple files |
| `batchFileOperations` (delete) | `batch` | `"delete"` | Deletes multiple files |
| `batchFileOperations` (move) | `batch` | `"move"` | Moves multiple files |

---

## Google Sheets Operations Migration

### Operation: List Sheets

**Description:** List all sheets in a spreadsheet

**Before (v1.x):**
```json
{
  "name": "listSheets",
  "args": {
    "spreadsheetId": "abc123"
  }
}
```

**After (v2.0.0):**
```json
{
  "name": "sheets",
  "args": {
    "operation": "list",
    "spreadsheetId": "abc123"
  }
}
```

**Changes:**
- Tool name: `listSheets` → `sheets`
- New parameter: `operation: "list"`
- All other parameters remain identical

---

### Operation: Read Sheet

**Description:** Read data from a specific range in a sheet

**Before (v1.x):**
```json
{
  "name": "readSheet",
  "args": {
    "spreadsheetId": "abc123",
    "range": "Sheet1!A1:B10"
  }
}
```

**After (v2.0.0):**
```json
{
  "name": "sheets",
  "args": {
    "operation": "read",
    "spreadsheetId": "abc123",
    "range": "Sheet1!A1:B10"
  }
}
```

**Changes:**
- Tool name: `readSheet` → `sheets`
- New parameter: `operation: "read"`
- All other parameters remain identical

---

### Operation: Create Sheet

**Description:** Create a new sheet in a spreadsheet

**Before (v1.x):**
```json
{
  "name": "createSheet",
  "args": {
    "spreadsheetId": "abc123",
    "sheetName": "Q4 Data",
    "rowCount": 1000,
    "columnCount": 26
  }
}
```

**After (v2.0.0):**
```json
{
  "name": "sheets",
  "args": {
    "operation": "create",
    "spreadsheetId": "abc123",
    "sheetName": "Q4 Data",
    "rowCount": 1000,
    "columnCount": 26
  }
}
```

**Changes:**
- Tool name: `createSheet` → `sheets`
- New parameter: `operation: "create"`
- All other parameters remain identical

---

### Operation: Rename Sheet

**Description:** Rename an existing sheet

**Before (v1.x):**
```json
{
  "name": "renameSheet",
  "args": {
    "spreadsheetId": "abc123",
    "sheetName": "Old Name",
    "newName": "New Name"
  }
}
```

**After (v2.0.0):**
```json
{
  "name": "sheets",
  "args": {
    "operation": "rename",
    "spreadsheetId": "abc123",
    "sheetName": "Old Name",
    "newName": "New Name"
  }
}
```

**Changes:**
- Tool name: `renameSheet` → `sheets`
- New parameter: `operation: "rename"`
- All other parameters remain identical

---

### Operation: Delete Sheet

**Description:** Delete a sheet from a spreadsheet

**Before (v1.x):**
```json
{
  "name": "deleteSheet",
  "args": {
    "spreadsheetId": "abc123",
    "sheetName": "Obsolete Data"
  }
}
```

**After (v2.0.0):**
```json
{
  "name": "sheets",
  "args": {
    "operation": "delete",
    "spreadsheetId": "abc123",
    "sheetName": "Obsolete Data"
  }
}
```

**Changes:**
- Tool name: `deleteSheet` → `sheets`
- New parameter: `operation: "delete"`
- All other parameters remain identical

---

### Operation: Update Cells

**Description:** Update cell values in a specific range

**Before (v1.x):**
```json
{
  "name": "updateCells",
  "args": {
    "spreadsheetId": "abc123",
    "range": "Sheet1!A1:B2",
    "values": [
      ["Name", "Age"],
      ["John", 30]
    ]
  }
}
```

**After (v2.0.0):**
```json
{
  "name": "sheets",
  "args": {
    "operation": "update",
    "spreadsheetId": "abc123",
    "range": "Sheet1!A1:B2",
    "values": [
      ["Name", "Age"],
      ["John", 30]
    ]
  }
}
```

**Changes:**
- Tool name: `updateCells` → `sheets`
- New parameter: `operation: "update"`
- All other parameters remain identical

---

### Operation: Update Cells with Formula

**Description:** Apply formulas to specific cells

**Before (v1.x):**
```json
{
  "name": "updateCellsWithFormula",
  "args": {
    "spreadsheetId": "abc123",
    "range": "Sheet1!D25",
    "formula": "=SUM(D2:D24)"
  }
}
```

**After (v2.0.0):**
```json
{
  "name": "sheets",
  "args": {
    "operation": "updateFormula",
    "spreadsheetId": "abc123",
    "range": "Sheet1!D25",
    "formula": "=SUM(D2:D24)"
  }
}
```

**Changes:**
- Tool name: `updateCellsWithFormula` → `sheets`
- New parameter: `operation: "updateFormula"`
- All other parameters remain identical

---

### Operation: Format Cells

**Description:** Apply formatting to cells (bold, colors, number formats)

**Before (v1.x):**
```json
{
  "name": "formatCells",
  "args": {
    "spreadsheetId": "abc123",
    "range": "Sheet1!A1:Z1",
    "format": {
      "bold": true,
      "backgroundColor": {
        "red": 0.85,
        "green": 0.85,
        "blue": 0.85
      }
    }
  }
}
```

**After (v2.0.0):**
```json
{
  "name": "sheets",
  "args": {
    "operation": "format",
    "spreadsheetId": "abc123",
    "range": "Sheet1!A1:Z1",
    "format": {
      "bold": true,
      "backgroundColor": {
        "red": 0.85,
        "green": 0.85,
        "blue": 0.85
      }
    }
  }
}
```

**Changes:**
- Tool name: `formatCells` → `sheets`
- New parameter: `operation: "format"`
- All other parameters remain identical

---

### Operation: Add Conditional Formatting

**Description:** Add conditional formatting rules to highlight cells

**Before (v1.x):**
```json
{
  "name": "addConditionalFormatting",
  "args": {
    "spreadsheetId": "abc123",
    "range": "Sheet1!D2:D25",
    "rule": {
      "condition": {
        "type": "NUMBER_GREATER",
        "values": ["0"]
      },
      "format": {
        "backgroundColor": {
          "red": 0.7,
          "green": 0.9,
          "blue": 0.7
        }
      }
    }
  }
}
```

**After (v2.0.0):**
```json
{
  "name": "sheets",
  "args": {
    "operation": "conditionalFormat",
    "spreadsheetId": "abc123",
    "range": "Sheet1!D2:D25",
    "rule": {
      "condition": {
        "type": "NUMBER_GREATER",
        "values": ["0"]
      },
      "format": {
        "backgroundColor": {
          "red": 0.7,
          "green": 0.9,
          "blue": 0.7
        }
      }
    }
  }
}
```

**Changes:**
- Tool name: `addConditionalFormatting` → `sheets`
- New parameter: `operation: "conditionalFormat"`
- All other parameters remain identical

---

### Operation: Append Rows

**Description:** Append rows to the end of a sheet

**Before (v1.x):**
```json
{
  "name": "appendRows",
  "args": {
    "spreadsheetId": "abc123",
    "sheetName": "Sheet1",
    "values": [
      ["New Row 1", "Data 1"],
      ["New Row 2", "Data 2"]
    ]
  }
}
```

**After (v2.0.0):**
```json
{
  "name": "sheets",
  "args": {
    "operation": "append",
    "spreadsheetId": "abc123",
    "sheetName": "Sheet1",
    "values": [
      ["New Row 1", "Data 1"],
      ["New Row 2", "Data 2"]
    ]
  }
}
```

**Changes:**
- Tool name: `appendRows` → `sheets`
- New parameter: `operation: "append"`
- All other parameters remain identical

---

### Operation: Freeze Rows/Columns

**Description:** Freeze header rows and columns for better scrolling

**Before (v1.x):**
```json
{
  "name": "freezeRowsColumns",
  "args": {
    "spreadsheetId": "abc123",
    "sheetName": "Sheet1",
    "frozenRowCount": 1,
    "frozenColumnCount": 2
  }
}
```

**After (v2.0.0):**
```json
{
  "name": "sheets",
  "args": {
    "operation": "freeze",
    "spreadsheetId": "abc123",
    "sheetName": "Sheet1",
    "frozenRowCount": 1,
    "frozenColumnCount": 2
  }
}
```

**Changes:**
- Tool name: `freezeRowsColumns` → `sheets`
- New parameter: `operation: "freeze"`
- All other parameters remain identical

---

### Operation: Set Column Width

**Description:** Adjust pixel widths for specific columns

**Before (v1.x):**
```json
{
  "name": "setColumnWidth",
  "args": {
    "spreadsheetId": "abc123",
    "sheetName": "Sheet1",
    "columns": [
      { "columnIndex": 0, "width": 150 },
      { "columnIndex": 1, "width": 200 }
    ]
  }
}
```

**After (v2.0.0):**
```json
{
  "name": "sheets",
  "args": {
    "operation": "setColumnWidth",
    "spreadsheetId": "abc123",
    "sheetName": "Sheet1",
    "columns": [
      { "columnIndex": 0, "width": 150 },
      { "columnIndex": 1, "width": 200 }
    ]
  }
}
```

**Changes:**
- Tool name: `setColumnWidth` → `sheets`
- New parameter: `operation: "setColumnWidth"`
- All other parameters remain identical

---

## Google Drive Operations Migration

### Operation: Search Files

**Description:** Search files with natural language queries

**Before (v1.x):**
```json
{
  "name": "search",
  "args": {
    "query": "spreadsheets modified last week"
  }
}
```

**After (v2.0.0):**
```json
{
  "name": "drive",
  "args": {
    "operation": "search",
    "query": "spreadsheets modified last week"
  }
}
```

**Changes:**
- Tool name: `search` → `drive`
- New parameter: `operation: "search"`
- All other parameters remain identical

---

### Operation: Enhanced Search

**Description:** Advanced search with filters and date ranges

**Before (v1.x):**
```json
{
  "name": "enhancedSearch",
  "args": {
    "query": "budget",
    "filters": {
      "mimeType": "application/vnd.google-apps.spreadsheet",
      "modifiedAfter": "2025-01-01"
    }
  }
}
```

**After (v2.0.0):**
```json
{
  "name": "drive",
  "args": {
    "operation": "enhancedSearch",
    "query": "budget",
    "filters": {
      "mimeType": "application/vnd.google-apps.spreadsheet",
      "modifiedAfter": "2025-01-01"
    }
  }
}
```

**Changes:**
- Tool name: `enhancedSearch` → `drive`
- New parameter: `operation: "enhancedSearch"`
- All other parameters remain identical

---

### Operation: Read File

**Description:** Read file contents

**Before (v1.x):**
```json
{
  "name": "read",
  "args": {
    "fileId": "abc123"
  }
}
```

**After (v2.0.0):**
```json
{
  "name": "drive",
  "args": {
    "operation": "read",
    "fileId": "abc123"
  }
}
```

**Changes:**
- Tool name: `read` → `drive`
- New parameter: `operation: "read"`
- All other parameters remain identical

---

### Operation: Create File

**Description:** Create a new file

**Before (v1.x):**
```json
{
  "name": "createFile",
  "args": {
    "name": "report.txt",
    "content": "This is the report content",
    "mimeType": "text/plain"
  }
}
```

**After (v2.0.0):**
```json
{
  "name": "drive",
  "args": {
    "operation": "create",
    "name": "report.txt",
    "content": "This is the report content",
    "mimeType": "text/plain"
  }
}
```

**Changes:**
- Tool name: `createFile` → `drive`
- New parameter: `operation: "create"`
- All other parameters remain identical

---

### Operation: Update File

**Description:** Update an existing file

**Before (v1.x):**
```json
{
  "name": "updateFile",
  "args": {
    "fileId": "abc123",
    "content": "Updated content"
  }
}
```

**After (v2.0.0):**
```json
{
  "name": "drive",
  "args": {
    "operation": "update",
    "fileId": "abc123",
    "content": "Updated content"
  }
}
```

**Changes:**
- Tool name: `updateFile` → `drive`
- New parameter: `operation: "update"`
- All other parameters remain identical

---

### Operation: Create Folder

**Description:** Create a new folder

**Before (v1.x):**
```json
{
  "name": "createFolder",
  "args": {
    "name": "Project Files",
    "parentId": "parent123"
  }
}
```

**After (v2.0.0):**
```json
{
  "name": "drive",
  "args": {
    "operation": "createFolder",
    "name": "Project Files",
    "parentId": "parent123"
  }
}
```

**Changes:**
- Tool name: `createFolder` → `drive`
- New parameter: `operation: "createFolder"`
- All other parameters remain identical

---

### Operation: Batch File Operations

**Description:** Process multiple files in a single operation

**Before (v1.x):**
```json
{
  "name": "batchFileOperations",
  "args": {
    "operations": [
      { "type": "create", "name": "file1.txt", "content": "Content 1" },
      { "type": "update", "fileId": "abc123", "content": "Updated" }
    ]
  }
}
```

**After (v2.0.0):**
```json
{
  "name": "drive",
  "args": {
    "operation": "batch",
    "operations": [
      { "type": "create", "name": "file1.txt", "content": "Content 1" },
      { "type": "update", "fileId": "abc123", "content": "Updated" }
    ]
  }
}
```

**Changes:**
- Tool name: `batchFileOperations` → `drive`
- New parameter: `operation: "batch"`
- All other parameters remain identical

---

## Google Forms Operations Migration

### Operation: Create Form

**Description:** Create a new Google Form

**Before (v1.x):**
```json
{
  "name": "createForm",
  "args": {
    "title": "Customer Feedback Survey",
    "description": "Help us improve our service"
  }
}
```

**After (v2.0.0):**
```json
{
  "name": "forms",
  "args": {
    "operation": "create",
    "title": "Customer Feedback Survey",
    "description": "Help us improve our service"
  }
}
```

**Changes:**
- Tool name: `createForm` → `forms`
- New parameter: `operation: "create"`
- All other parameters remain identical

---

### Operation: Get Form

**Description:** Retrieve form details and questions

**Before (v1.x):**
```json
{
  "name": "getForm",
  "args": {
    "formId": "form123"
  }
}
```

**After (v2.0.0):**
```json
{
  "name": "forms",
  "args": {
    "operation": "get",
    "formId": "form123"
  }
}
```

**Changes:**
- Tool name: `getForm` → `forms`
- New parameter: `operation: "get"`
- All other parameters remain identical

---

### Operation: Add Question

**Description:** Add a question to an existing form

**Before (v1.x):**
```json
{
  "name": "addQuestion",
  "args": {
    "formId": "form123",
    "title": "How satisfied are you with our service?",
    "type": "MULTIPLE_CHOICE",
    "options": ["Very Satisfied", "Satisfied", "Neutral", "Unsatisfied"]
  }
}
```

**After (v2.0.0):**
```json
{
  "name": "forms",
  "args": {
    "operation": "addQuestion",
    "formId": "form123",
    "title": "How satisfied are you with our service?",
    "type": "MULTIPLE_CHOICE",
    "options": ["Very Satisfied", "Satisfied", "Neutral", "Unsatisfied"]
  }
}
```

**Changes:**
- Tool name: `addQuestion` → `forms`
- New parameter: `operation: "addQuestion"`
- All other parameters remain identical

---

### Operation: List Responses

**Description:** Get all responses to a form

**Before (v1.x):**
```json
{
  "name": "listResponses",
  "args": {
    "formId": "form123"
  }
}
```

**After (v2.0.0):**
```json
{
  "name": "forms",
  "args": {
    "operation": "listResponses",
    "formId": "form123"
  }
}
```

**Changes:**
- Tool name: `listResponses` → `forms`
- New parameter: `operation: "listResponses"`
- All other parameters remain identical

---

## Google Docs Operations Migration

### Operation: Create Document

**Description:** Create a new Google Docs document

**Before (v1.x):**
```json
{
  "name": "createDocument",
  "args": {
    "title": "Project Proposal",
    "content": "# Overview\n\nThis document outlines..."
  }
}
```

**After (v2.0.0):**
```json
{
  "name": "docs",
  "args": {
    "operation": "create",
    "title": "Project Proposal",
    "content": "# Overview\n\nThis document outlines..."
  }
}
```

**Changes:**
- Tool name: `createDocument` → `docs`
- New parameter: `operation: "create"`
- All other parameters remain identical

---

### Operation: Insert Text

**Description:** Insert text at a specific position in a document

**Before (v1.x):**
```json
{
  "name": "insertText",
  "args": {
    "documentId": "doc123",
    "index": 1,
    "text": "New paragraph content"
  }
}
```

**After (v2.0.0):**
```json
{
  "name": "docs",
  "args": {
    "operation": "insertText",
    "documentId": "doc123",
    "index": 1,
    "text": "New paragraph content"
  }
}
```

**Changes:**
- Tool name: `insertText` → `docs`
- New parameter: `operation: "insertText"`
- All other parameters remain identical

---

### Operation: Replace Text

**Description:** Find and replace text in a document

**Before (v1.x):**
```json
{
  "name": "replaceText",
  "args": {
    "documentId": "doc123",
    "searchText": "old term",
    "replaceText": "new term",
    "matchCase": false
  }
}
```

**After (v2.0.0):**
```json
{
  "name": "docs",
  "args": {
    "operation": "replaceText",
    "documentId": "doc123",
    "searchText": "old term",
    "replaceText": "new term",
    "matchCase": false
  }
}
```

**Changes:**
- Tool name: `replaceText` → `docs`
- New parameter: `operation: "replaceText"`
- All other parameters remain identical

---

### Operation: Apply Text Style

**Description:** Apply formatting to text ranges (bold, italic, colors)

**Before (v1.x):**
```json
{
  "name": "applyTextStyle",
  "args": {
    "documentId": "doc123",
    "startIndex": 1,
    "endIndex": 50,
    "bold": true,
    "fontSize": 14
  }
}
```

**After (v2.0.0):**
```json
{
  "name": "docs",
  "args": {
    "operation": "applyTextStyle",
    "documentId": "doc123",
    "startIndex": 1,
    "endIndex": 50,
    "bold": true,
    "fontSize": 14
  }
}
```

**Changes:**
- Tool name: `applyTextStyle` → `docs`
- New parameter: `operation: "applyTextStyle"`
- All other parameters remain identical

---

### Operation: Insert Table

**Description:** Insert a table into a document

**Before (v1.x):**
```json
{
  "name": "insertTable",
  "args": {
    "documentId": "doc123",
    "index": 100,
    "rows": 5,
    "columns": 3
  }
}
```

**After (v2.0.0):**
```json
{
  "name": "docs",
  "args": {
    "operation": "insertTable",
    "documentId": "doc123",
    "index": 100,
    "rows": 5,
    "columns": 3
  }
}
```

**Changes:**
- Tool name: `insertTable` → `docs`
- New parameter: `operation: "insertTable"`
- All other parameters remain identical

---

## Batch Operations Migration

### Operation: Batch Create

**Description:** Create multiple files in a single operation

**Before (v1.x):**
```json
{
  "name": "batchFileOperations",
  "args": {
    "operations": [
      { "type": "create", "name": "file1.txt", "content": "Content 1" },
      { "type": "create", "name": "file2.txt", "content": "Content 2" }
    ]
  }
}
```

**After (v2.0.0):**
```json
{
  "name": "batch",
  "args": {
    "operation": "create",
    "operations": [
      { "type": "create", "name": "file1.txt", "content": "Content 1" },
      { "type": "create", "name": "file2.txt", "content": "Content 2" }
    ]
  }
}
```

**Changes:**
- Tool name: `batchFileOperations` → `batch`
- New parameter: `operation: "create"`
- All other parameters remain identical

---

### Operation: Batch Update

**Description:** Update multiple files in a single operation

**Before (v1.x):**
```json
{
  "name": "batchFileOperations",
  "args": {
    "operations": [
      { "type": "update", "fileId": "file1", "content": "New Content 1" },
      { "type": "update", "fileId": "file2", "content": "New Content 2" }
    ]
  }
}
```

**After (v2.0.0):**
```json
{
  "name": "batch",
  "args": {
    "operation": "update",
    "operations": [
      { "type": "update", "fileId": "file1", "content": "New Content 1" },
      { "type": "update", "fileId": "file2", "content": "New Content 2" }
    ]
  }
}
```

**Changes:**
- Tool name: `batchFileOperations` → `batch`
- New parameter: `operation: "update"`
- All other parameters remain identical

---

### Operation: Batch Delete

**Description:** Delete multiple files in a single operation

**Before (v1.x):**
```json
{
  "name": "batchFileOperations",
  "args": {
    "operations": [
      { "type": "delete", "fileId": "file1" },
      { "type": "delete", "fileId": "file2" }
    ]
  }
}
```

**After (v2.0.0):**
```json
{
  "name": "batch",
  "args": {
    "operation": "delete",
    "operations": [
      { "type": "delete", "fileId": "file1" },
      { "type": "delete", "fileId": "file2" }
    ]
  }
}
```

**Changes:**
- Tool name: `batchFileOperations` → `batch`
- New parameter: `operation: "delete"`
- All other parameters remain identical

---

### Operation: Batch Move

**Description:** Move multiple files in a single operation

**Before (v1.x):**
```json
{
  "name": "batchFileOperations",
  "args": {
    "operations": [
      { "type": "move", "fileId": "file1", "parentId": "folder1" },
      { "type": "move", "fileId": "file2", "parentId": "folder1" }
    ]
  }
}
```

**After (v2.0.0):**
```json
{
  "name": "batch",
  "args": {
    "operation": "move",
    "operations": [
      { "type": "move", "fileId": "file1", "parentId": "folder1" },
      { "type": "move", "fileId": "file2", "parentId": "folder1" }
    ]
  }
}
```

**Changes:**
- Tool name: `batchFileOperations` → `batch`
- New parameter: `operation: "move"`
- All other parameters remain identical

---

## TypeScript/JavaScript Migration Examples

### TypeScript Client Migration

**Before (v1.x):**
```typescript
// Old individual tool calls
await mcpClient.callTool('listSheets', {
  spreadsheetId: 'abc123'
});

await mcpClient.callTool('updateCells', {
  spreadsheetId: 'abc123',
  range: 'Sheet1!A1:B2',
  values: [['Name', 'Age'], ['John', 30]]
});
```

**After (v2.0.0):**
```typescript
// New operation-based tool calls
await mcpClient.callTool('sheets', {
  operation: 'list',
  spreadsheetId: 'abc123'
});

await mcpClient.callTool('sheets', {
  operation: 'update',
  spreadsheetId: 'abc123',
  range: 'Sheet1!A1:B2',
  values: [['Name', 'Age'], ['John', 30]]
});
```

### Automated Migration Script

If you have many tool calls to migrate, consider creating a simple find-and-replace script:

```typescript
// Example migration helper
const toolMigrationMap: Record<string, { tool: string; operation: string }> = {
  listSheets: { tool: 'sheets', operation: 'list' },
  readSheet: { tool: 'sheets', operation: 'read' },
  createSheet: { tool: 'sheets', operation: 'create' },
  updateCells: { tool: 'sheets', operation: 'update' },
  // ... add all 32 mappings
};

function migrateToolCall(oldToolName: string, args: any) {
  const mapping = toolMigrationMap[oldToolName];
  if (!mapping) {
    throw new Error(`Unknown tool: ${oldToolName}`);
  }

  return {
    tool: mapping.tool,
    args: {
      operation: mapping.operation,
      ...args
    }
  };
}
```

---

## Frequently Asked Questions (FAQ)

### Q: Will old tools still work in v2.0.0?
**A:** No, all individual tools have been removed in v2.0.0. You must migrate to the new operation-based tools. This is a breaking change.

### Q: What if I have automated scripts using old tools?
**A:** You'll need to update all tool calls to use the new format. The migration is straightforward: change the tool name and add an `operation` parameter. All other parameters remain the same.

### Q: Is there a compatibility layer or deprecation period?
**A:** No. This is a clean breaking change with no backwards compatibility. We recommend thorough testing in a development environment before upgrading production systems.

### Q: Will response formats change?
**A:** No. Response formats remain identical. Only the request format (tool name + operation parameter) has changed.

### Q: How do I test my migration?
**A:**
1. Update your code to use the new format
2. Run your test suite
3. Use the MCP Inspector tool to verify tool calls
4. Test in a development environment before deploying to production

### Q: What if I encounter issues during migration?
**A:**
1. Check this migration guide for the correct format
2. Review the [API Documentation](./Developer-Guidelines/API.md) for detailed parameter information
3. Open an issue on [GitHub Issues](https://github.com/AojdevStudio/gdrive/issues) with:
   - Your old tool call format
   - Your new tool call format
   - Any error messages received

### Q: Can I still use v1.x?
**A:** Yes, but v1.x will no longer receive updates or security patches. We strongly recommend migrating to v2.0.0 to benefit from performance improvements and future enhancements.

### Q: Why such a drastic change?
**A:** The change improves LLM tool selection by 88% (41+ tools → 5 tools), reduces code duplication, improves type safety, and aligns with 2025 MCP best practices. These benefits significantly outweigh the one-time migration cost.

### Q: How long does migration typically take?
**A:** For most integrations: 5-15 minutes. Complex integrations with extensive tool usage may take 30-60 minutes. The changes are mechanical and can often be scripted.

### Q: Are there any performance differences?
**A:** No performance degradation. In fact, reduced tool count may improve LLM response times when selecting tools.

---

## Support

### Getting Help

**Documentation:**
- [README.md](../README.md) - Main project documentation
- [API Documentation](./Developer-Guidelines/API.md) - Complete API reference
- [Examples](./Examples/README.md) - Code examples and usage patterns

**Community Support:**
- **GitHub Issues:** [Report bugs or request help](https://github.com/AojdevStudio/gdrive/issues)
- **GitHub Discussions:** [Ask questions and share experiences](https://github.com/AojdevStudio/gdrive/discussions)

### Reporting Migration Issues

When reporting migration issues, please include:

1. **Old tool call format** (v1.x)
2. **New tool call format** (v2.0.0) you tried
3. **Error message** received (if any)
4. **Expected behavior**
5. **Actual behavior**
6. **MCP Client version**
7. **Google Drive MCP Server version**

**Issue Template:**
```markdown
## Migration Issue

**Old Tool Call (v1.x):**
```json
{
  "name": "listSheets",
  "args": { "spreadsheetId": "abc123" }
}
```

**New Tool Call (v2.0.0):**
```json
{
  "name": "sheets",
  "args": { "operation": "list", "spreadsheetId": "abc123" }
}
```

**Error Message:**
[Paste error message here]

**Expected:** List of sheets should be returned
**Actual:** Error occurred

**Environment:**
- MCP Client: [version]
- Server Version: 2.0.0
```

---

## Migration Checklist

Use this checklist to ensure complete migration:

### Pre-Migration
- [ ] Backup existing code and configurations
- [ ] Review this migration guide completely
- [ ] Identify all MCP tool calls in your codebase
- [ ] Plan testing strategy
- [ ] Set up development/staging environment

### Migration
- [ ] Update all `sheets` tool calls (12 operations)
- [ ] Update all `drive` tool calls (7 operations)
- [ ] Update all `forms` tool calls (4 operations)
- [ ] Update all `docs` tool calls (5 operations)
- [ ] Update all `batch` tool calls (4 operations)
- [ ] Update any tool call helper functions
- [ ] Update TypeScript type definitions (if using)

### Testing
- [ ] Run unit tests
- [ ] Run integration tests
- [ ] Test each operation type in development
- [ ] Verify response formats are unchanged
- [ ] Load test (if applicable)

### Deployment
- [ ] Update package.json to v2.0.0
- [ ] Deploy to staging environment
- [ ] Verify staging functionality
- [ ] Deploy to production
- [ ] Monitor for errors

### Documentation
- [ ] Update internal documentation
- [ ] Update team knowledge base
- [ ] Train team members on new format
- [ ] Update CI/CD pipelines (if applicable)

---

## Additional Resources

- **[README.md](../README.md)** - Main project documentation
- **[CHANGELOG.md](../CHANGELOG.md)** - Complete version history
- **[API Documentation](./Developer-Guidelines/API.md)** - Detailed API reference
- **[Architecture Documentation](./Architecture/ARCHITECTURE.md)** - System design details
- **[Examples](./Examples/README.md)** - Usage examples
- **[HOW2MCP 2025 Patterns](https://github.com/modelcontextprotocol/servers)** - MCP best practices

---

**Thank you for migrating to v2.0.0! This change significantly improves the developer experience and sets a solid foundation for future enhancements.**

**Questions or feedback?** Open an issue on [GitHub](https://github.com/AojdevStudio/gdrive/issues) or join the discussion in [GitHub Discussions](https://github.com/AojdevStudio/gdrive/discussions).
