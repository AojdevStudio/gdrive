# Google Drive MCP Server API Documentation (v2.0.0)

## Overview

The Google Drive MCP Server v2.0.0 implements the Model Context Protocol to provide standardized access to Google Workspace services through **5 consolidated operation-based tools** with **32 total operations**.

**Version:** 2.0.0
**Release Date:** 2025-10-11
**Architecture:** Operation-based tools following [HOW2MCP 2025 patterns](https://github.com/modelcontextprotocol/servers)

---

## 🚨 Breaking Changes from v1.x

**v2.0.0** consolidates 41+ individual tools into 5 operation-based tools. See [Migration Guide](../MIGRATION_V2.md) for complete migration instructions.

---

## Authentication

The server uses OAuth 2.0 for authentication with Google APIs, featuring **enterprise-grade token security** with versioned encryption and automatic key rotation.

### Required Scopes
- `https://www.googleapis.com/auth/drive.file` - Full Drive access
- `https://www.googleapis.com/auth/spreadsheets` - Sheets read/write
- `https://www.googleapis.com/auth/documents` - Docs read/write
- `https://www.googleapis.com/auth/forms` - Forms creation/management
- `https://www.googleapis.com/auth/script.projects.readonly` - Apps Script access

### Security Features
- **AES-256-GCM Encryption** - All tokens encrypted at rest
- **PBKDF2 Key Derivation** - Minimum 100,000 iterations for key strengthening
- **Versioned Keys** - Support for key rotation without data loss
- **Audit Trail** - Comprehensive logging of all authentication events

---

## MCP Protocol Implementation

### ListResourcesRequestSchema
Lists available Google Drive files with pagination support.

**Request Parameters:**
- `cursor` (optional): Pagination token for next page

**Response:**
```json
{
  "resources": [
    {
      "uri": "gdrive:///<file_id>",
      "mimeType": "application/vnd.google-apps.spreadsheet",
      "name": "My Spreadsheet"
    }
  ],
  "nextCursor": "next_page_token"
}
```

### ReadResourceRequestSchema
Reads the contents of a Google Drive file.

**Request Parameters:**
- `uri`: Resource URI in format `gdrive:///<file_id>`

**Response:**
```json
{
  "contents": [
    {
      "uri": "gdrive:///<file_id>",
      "mimeType": "text/csv",
      "text": "CSV content here..."
    }
  ]
}
```

---

## Consolidated Tools API (v2.0.0)

All tools follow the **operation-based pattern**:

```typescript
{
  name: "toolName",          // One of: sheets, drive, forms, docs, batch
  args: {
    operation: "...",         // Operation discriminator
    // ... operation-specific parameters
  }
}
```

---

## 📊 `sheets` Tool

**Description:** Unified tool for all Google Sheets operations

**Operations:** 12 operations for complete Sheets management

### Common Parameters
- `spreadsheetId` (required): Google Spreadsheet ID

---

### Operation: `list`

**Description:** List all sheets in a spreadsheet

**Parameters:**
```typescript
{
  operation: "list",
  spreadsheetId: string
}
```

**Example Request:**
```json
{
  "name": "sheets",
  "args": {
    "operation": "list",
    "spreadsheetId": "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
  }
}
```

**Response:**
```
Available sheets:
- Sheet1 (ID: 0)
- Sales Data (ID: 1234567)
- Summary (ID: 9876543)
```

---

### Operation: `read`

**Description:** Read data from a specific range

**Parameters:**
```typescript
{
  operation: "read",
  spreadsheetId: string,
  range: string  // A1 notation (e.g., "Sheet1!A1:D10")
}
```

**Example Request:**
```json
{
  "name": "sheets",
  "args": {
    "operation": "read",
    "spreadsheetId": "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms",
    "range": "Sheet1!A1:B10"
  }
}
```

**Response:**
```
Sheet1!A1:B10:
Name     Age
John     30
Jane     25
Bob      35
```

---

### Operation: `create`

**Description:** Create a new sheet in a spreadsheet

**Parameters:**
```typescript
{
  operation: "create",
  spreadsheetId: string,
  sheetName: string,         // Required: name for new sheet
  index?: number,            // Optional: position (0-based)
  hidden?: boolean,          // Optional: hide sheet
  rightToLeft?: boolean,     // Optional: RTL text direction
  rowCount?: number,         // Optional: rows (default: 1000)
  columnCount?: number,      // Optional: columns (default: 26)
  frozenRowCount?: number,   // Optional: frozen rows
  frozenColumnCount?: number,// Optional: frozen columns
  tabColor?: {               // Optional: tab color
    red?: number,            // 0.0 - 1.0
    green?: number,
    blue?: number,
    alpha?: number
  }
}
```

**Example Request:**
```json
{
  "name": "sheets",
  "args": {
    "operation": "create",
    "spreadsheetId": "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms",
    "sheetName": "Q4 Sales",
    "rowCount": 1000,
    "columnCount": 26,
    "frozenRowCount": 1,
    "tabColor": {
      "red": 0.2,
      "green": 0.6,
      "blue": 0.9
    }
  }
}
```

---

### Operation: `rename`

**Description:** Rename an existing sheet

**Parameters:**
```typescript
{
  operation: "rename",
  spreadsheetId: string,
  sheetName?: string,  // Sheet name to rename (use this OR sheetId)
  sheetId?: number,    // Sheet ID to rename (use this OR sheetName)
  newName: string      // New name for the sheet
}
```

**Note:** Either `sheetName` or `sheetId` must be provided.

**Example Request:**
```json
{
  "name": "sheets",
  "args": {
    "operation": "rename",
    "spreadsheetId": "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms",
    "sheetName": "Old Name",
    "newName": "New Name"
  }
}
```

---

### Operation: `delete`

**Description:** Delete a sheet from a spreadsheet

**Parameters:**
```typescript
{
  operation: "delete",
  spreadsheetId: string,
  sheetName?: string,  // Sheet name to delete (use this OR sheetId)
  sheetId?: number     // Sheet ID to delete (use this OR sheetName)
}
```

**Note:** Either `sheetName` or `sheetId` must be provided.

**Example Request:**
```json
{
  "name": "sheets",
  "args": {
    "operation": "delete",
    "spreadsheetId": "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms",
    "sheetName": "Obsolete Data"
  }
}
```

---

### Operation: `update`

**Description:** Update cell values in a range

**Parameters:**
```typescript
{
  operation: "update",
  spreadsheetId: string,
  range: string,           // A1 notation
  values: any[][]          // 2D array of cell values
}
```

**Example Request:**
```json
{
  "name": "sheets",
  "args": {
    "operation": "update",
    "spreadsheetId": "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms",
    "range": "Sheet1!A1:B2",
    "values": [
      ["Name", "Age"],
      ["John", 30]
    ]
  }
}
```

---

### Operation: `updateFormula`

**Description:** Apply formulas to specific cells

**Parameters:**
```typescript
{
  operation: "updateFormula",
  spreadsheetId: string,
  range: string,         // A1 notation
  formula: string,       // Formula (must start with '=')
  sheetName?: string     // Optional: sheet name if not in range
}
```

**Example Request:**
```json
{
  "name": "sheets",
  "args": {
    "operation": "updateFormula",
    "spreadsheetId": "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms",
    "range": "Sheet1!D25",
    "formula": "=SUM(D2:D24)"
  }
}
```

**Security Note:** Be cautious with user-provided formulas. Functions like `IMPORTXML`, `IMPORTHTML`, and `IMPORTDATA` can access external URLs. Consider implementing validation if accepting user input.

---

### Operation: `format`

**Description:** Apply formatting to cells (bold, colors, number formats)

**Parameters:**
```typescript
{
  operation: "format",
  spreadsheetId: string,
  range: string,           // A1 notation
  format: {
    bold?: boolean,
    italic?: boolean,
    fontSize?: number,
    foregroundColor?: {    // Text color (RGB 0.0-1.0)
      red?: number,
      green?: number,
      blue?: number,
      alpha?: number
    },
    backgroundColor?: {    // Cell background (RGB 0.0-1.0)
      red?: number,
      green?: number,
      blue?: number,
      alpha?: number
    },
    numberFormat?: {
      type: "CURRENCY" | "PERCENT" | "DATE" | "NUMBER" | "TEXT",
      pattern?: string    // Custom pattern (e.g., "$#,##0.00")
    }
  }
}
```

**Example Request:**
```json
{
  "name": "sheets",
  "args": {
    "operation": "format",
    "spreadsheetId": "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms",
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

---

### Operation: `conditionalFormat`

**Description:** Add conditional formatting rules to highlight cells

**Parameters:**
```typescript
{
  operation: "conditionalFormat",
  spreadsheetId: string,
  range: string,           // A1 notation
  rule: {
    condition: {
      type: "NUMBER_GREATER" | "NUMBER_LESS" | "TEXT_CONTAINS" | "CUSTOM_FORMULA",
      values?: string[],   // Required for NUMBER_*/TEXT_CONTAINS
      formula?: string     // Required for CUSTOM_FORMULA
    },
    format: {
      backgroundColor?: {  // Cell background (RGB 0.0-1.0)
        red?: number,
        green?: number,
        blue?: number,
        alpha?: number
      },
      foregroundColor?: {  // Text color (RGB 0.0-1.0)
        red?: number,
        green?: number,
        blue?: number,
        alpha?: number
      },
      bold?: boolean
    }
  }
}
```

**Example Request:**
```json
{
  "name": "sheets",
  "args": {
    "operation": "conditionalFormat",
    "spreadsheetId": "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms",
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

---

### Operation: `append`

**Description:** Append rows to the end of a sheet

**Parameters:**
```typescript
{
  operation: "append",
  spreadsheetId: string,
  values: any[][],         // 2D array of values
  sheetName?: string       // Optional: sheet name (default: first sheet)
}
```

**Example Request:**
```json
{
  "name": "sheets",
  "args": {
    "operation": "append",
    "spreadsheetId": "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms",
    "sheetName": "Sheet1",
    "values": [
      ["New Row 1", "Data 1"],
      ["New Row 2", "Data 2"]
    ]
  }
}
```

---

### Operation: `freeze`

**Description:** Freeze header rows and columns for better scrolling

**Parameters:**
```typescript
{
  operation: "freeze",
  spreadsheetId: string,
  sheetName?: string,          // Optional: sheet name
  frozenRowCount?: number,     // Number of rows to freeze (default: 0)
  frozenColumnCount?: number   // Number of columns to freeze (default: 0)
}
```

**Example Request:**
```json
{
  "name": "sheets",
  "args": {
    "operation": "freeze",
    "spreadsheetId": "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms",
    "sheetName": "Sheet1",
    "frozenRowCount": 1,
    "frozenColumnCount": 2
  }
}
```

---

### Operation: `setColumnWidth`

**Description:** Adjust pixel widths for specific columns

**Parameters:**
```typescript
{
  operation: "setColumnWidth",
  spreadsheetId: string,
  sheetName?: string,      // Optional: sheet name
  columns: Array<{
    columnIndex: number,   // 0-based column index (A=0, B=1, etc.)
    width?: number         // Width in pixels (default: 100)
  }>
}
```

**Example Request:**
```json
{
  "name": "sheets",
  "args": {
    "operation": "setColumnWidth",
    "spreadsheetId": "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms",
    "sheetName": "Sheet1",
    "columns": [
      { "columnIndex": 0, "width": 150 },
      { "columnIndex": 1, "width": 200 }
    ]
  }
}
```

---

## 📁 `drive` Tool

**Description:** Unified tool for Google Drive file and folder operations

**Operations:** 7 operations for file management

---

### Operation: `search`

**Description:** Search files with natural language queries

**Parameters:**
```typescript
{
  operation: "search",
  query: string,     // Search query
  pageSize?: number  // Optional: results per page (default: 10)
}
```

**Example Request:**
```json
{
  "name": "drive",
  "args": {
    "operation": "search",
    "query": "spreadsheets modified last week"
  }
}
```

**Response:**
```
Found 3 files:
Quarterly Report Q1 2024 (application/vnd.google-apps.spreadsheet) - ID: 1abc...
Quarterly Report Q2 2024 (application/vnd.google-apps.spreadsheet) - ID: 2def...
Budget Tracking (application/vnd.google-apps.spreadsheet) - ID: 3ghi...
```

---

### Operation: `enhancedSearch`

**Description:** Advanced search with filters and date ranges

**Parameters:**
```typescript
{
  operation: "enhancedSearch",
  query: string,
  filters?: {
    mimeType?: string,         // Filter by MIME type
    createdAfter?: string,     // ISO 8601 date
    createdBefore?: string,
    modifiedAfter?: string,
    modifiedBefore?: string,
    ownedByMe?: boolean,
    sharedWithMe?: boolean,
    trashed?: boolean,
    parents?: string           // Parent folder ID
  },
  orderBy?: string,            // e.g., "modifiedTime desc", "name"
  pageSize?: number
}
```

**Example Request:**
```json
{
  "name": "drive",
  "args": {
    "operation": "enhancedSearch",
    "query": "budget",
    "filters": {
      "mimeType": "application/vnd.google-apps.spreadsheet",
      "modifiedAfter": "2025-01-01",
      "ownedByMe": true
    },
    "orderBy": "modifiedTime desc"
  }
}
```

---

### Operation: `read`

**Description:** Read file contents

**Parameters:**
```typescript
{
  operation: "read",
  fileId: string  // Google Drive file ID
}
```

**Example Request:**
```json
{
  "name": "drive",
  "args": {
    "operation": "read",
    "fileId": "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
  }
}
```

**File Type Handling:**
- Google Docs → Exported as Markdown
- Google Sheets → Exported as CSV
- Google Slides → Exported as Plain Text
- Google Drawings → Exported as PNG (base64)
- Text files → UTF-8 text
- Binary files → Base64-encoded blob

---

### Operation: `create`

**Description:** Create a new file

**Parameters:**
```typescript
{
  operation: "create",
  name: string,        // File name
  content: string,     // File content
  mimeType?: string,   // Optional: MIME type (default: text/plain)
  parentId?: string    // Optional: parent folder ID
}
```

**Example Request:**
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

---

### Operation: `update`

**Description:** Update an existing file

**Parameters:**
```typescript
{
  operation: "update",
  fileId: string,      // File ID to update
  content: string      // New content
}
```

**Example Request:**
```json
{
  "name": "drive",
  "args": {
    "operation": "update",
    "fileId": "1abc123",
    "content": "Updated content"
  }
}
```

---

### Operation: `createFolder`

**Description:** Create a new folder

**Parameters:**
```typescript
{
  operation: "createFolder",
  name: string,        // Folder name
  parentId?: string    // Optional: parent folder ID
}
```

**Example Request:**
```json
{
  "name": "drive",
  "args": {
    "operation": "createFolder",
    "name": "Project Files",
    "parentId": "0B1234567890"
  }
}
```

---

### Operation: `batch`

**Description:** Process multiple files in a single operation

**Parameters:**
```typescript
{
  operation: "batch",
  operations: Array<{
    type: "create" | "update" | "delete" | "move",
    // For create:
    name?: string,
    content?: string,
    mimeType?: string,
    // For update/delete/move:
    fileId?: string,
    // For update:
    content?: string,
    // For move:
    parentId?: string
  }>
}
```

**Example Request:**
```json
{
  "name": "drive",
  "args": {
    "operation": "batch",
    "operations": [
      { "type": "create", "name": "file1.txt", "content": "Content 1" },
      { "type": "update", "fileId": "1abc123", "content": "Updated" },
      { "type": "delete", "fileId": "2def456" }
    ]
  }
}
```

---

## 📋 `forms` Tool

**Description:** Unified tool for Google Forms creation and management

**Operations:** 4 operations for form building

---

### Operation: `create`

**Description:** Create a new Google Form

**Parameters:**
```typescript
{
  operation: "create",
  title: string,           // Form title
  description?: string     // Optional: form description
}
```

**Example Request:**
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

---

### Operation: `get`

**Description:** Retrieve form details and questions

**Parameters:**
```typescript
{
  operation: "get",
  formId: string  // Form ID
}
```

**Example Request:**
```json
{
  "name": "forms",
  "args": {
    "operation": "get",
    "formId": "1a2b3c4d5e6f"
  }
}
```

---

### Operation: `addQuestion`

**Description:** Add a question to an existing form

**Parameters:**
```typescript
{
  operation: "addQuestion",
  formId: string,
  title: string,                          // Question text
  type: "TEXT" | "PARAGRAPH_TEXT" |       // Question type
        "MULTIPLE_CHOICE" | "CHECKBOX" |
        "DROPDOWN" | "LINEAR_SCALE" |
        "DATE" | "TIME",
  required?: boolean,                     // Optional: required field
  options?: string[],                     // For MULTIPLE_CHOICE/CHECKBOX/DROPDOWN
  scaleMin?: number,                      // For LINEAR_SCALE (default: 1)
  scaleMax?: number,                      // For LINEAR_SCALE (default: 5)
  scaleMinLabel?: string,                 // For LINEAR_SCALE
  scaleMaxLabel?: string                  // For LINEAR_SCALE
}
```

**Example Request:**
```json
{
  "name": "forms",
  "args": {
    "operation": "addQuestion",
    "formId": "1a2b3c4d5e6f",
    "title": "How satisfied are you with our service?",
    "type": "MULTIPLE_CHOICE",
    "required": true,
    "options": ["Very Satisfied", "Satisfied", "Neutral", "Unsatisfied"]
  }
}
```

---

### Operation: `listResponses`

**Description:** Get all responses to a form

**Parameters:**
```typescript
{
  operation: "listResponses",
  formId: string  // Form ID
}
```

**Example Request:**
```json
{
  "name": "forms",
  "args": {
    "operation": "listResponses",
    "formId": "1a2b3c4d5e6f"
  }
}
```

---

## 📝 `docs` Tool

**Description:** Unified tool for Google Docs manipulation

**Operations:** 5 operations for document editing

---

### Operation: `create`

**Description:** Create a new Google Docs document

**Parameters:**
```typescript
{
  operation: "create",
  title: string,         // Document title
  content?: string,      // Optional: initial content
  parentId?: string      // Optional: parent folder ID
}
```

**Example Request:**
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

---

### Operation: `insertText`

**Description:** Insert text at a specific position

**Parameters:**
```typescript
{
  operation: "insertText",
  documentId: string,
  index: number,         // Position to insert (1 = beginning)
  text: string           // Text to insert
}
```

**Example Request:**
```json
{
  "name": "docs",
  "args": {
    "operation": "insertText",
    "documentId": "1abc123",
    "index": 1,
    "text": "New paragraph content\n"
  }
}
```

---

### Operation: `replaceText`

**Description:** Find and replace text in a document

**Parameters:**
```typescript
{
  operation: "replaceText",
  documentId: string,
  searchText: string,
  replaceText: string,
  matchCase?: boolean    // Optional: case-sensitive (default: false)
}
```

**Example Request:**
```json
{
  "name": "docs",
  "args": {
    "operation": "replaceText",
    "documentId": "1abc123",
    "searchText": "old term",
    "replaceText": "new term",
    "matchCase": false
  }
}
```

---

### Operation: `applyTextStyle`

**Description:** Apply formatting to text ranges

**Parameters:**
```typescript
{
  operation: "applyTextStyle",
  documentId: string,
  startIndex: number,
  endIndex: number,
  bold?: boolean,
  italic?: boolean,
  underline?: boolean,
  fontSize?: number,
  foregroundColor?: {    // Text color (RGB 0.0-1.0)
    red?: number,
    green?: number,
    blue?: number
  }
}
```

**Example Request:**
```json
{
  "name": "docs",
  "args": {
    "operation": "applyTextStyle",
    "documentId": "1abc123",
    "startIndex": 1,
    "endIndex": 50,
    "bold": true,
    "fontSize": 14
  }
}
```

---

### Operation: `insertTable`

**Description:** Insert a table into a document

**Parameters:**
```typescript
{
  operation: "insertTable",
  documentId: string,
  index: number,         // Position to insert
  rows: number,          // Number of rows
  columns: number        // Number of columns
}
```

**Example Request:**
```json
{
  "name": "docs",
  "args": {
    "operation": "insertTable",
    "documentId": "1abc123",
    "index": 100,
    "rows": 5,
    "columns": 3
  }
}
```

---

## 🔄 `batch` Tool

**Description:** Unified tool for efficient multi-file processing

**Operations:** 4 batch operation types

---

### Operation: `create`

**Description:** Create multiple files in a single request

**Parameters:**
```typescript
{
  operation: "create",
  operations: Array<{
    type: "create",
    name: string,
    content: string,
    mimeType?: string,
    parentId?: string
  }>
}
```

**Example Request:**
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

---

### Operation: `update`

**Description:** Update multiple files in a single request

**Parameters:**
```typescript
{
  operation: "update",
  operations: Array<{
    type: "update",
    fileId: string,
    content: string
  }>
}
```

**Example Request:**
```json
{
  "name": "batch",
  "args": {
    "operation": "update",
    "operations": [
      { "type": "update", "fileId": "1abc", "content": "New Content 1" },
      { "type": "update", "fileId": "2def", "content": "New Content 2" }
    ]
  }
}
```

---

### Operation: `delete`

**Description:** Delete multiple files in a single request

**Parameters:**
```typescript
{
  operation: "delete",
  operations: Array<{
    type: "delete",
    fileId: string
  }>
}
```

**Example Request:**
```json
{
  "name": "batch",
  "args": {
    "operation": "delete",
    "operations": [
      { "type": "delete", "fileId": "1abc" },
      { "type": "delete", "fileId": "2def" }
    ]
  }
}
```

---

### Operation: `move`

**Description:** Move multiple files in a single request

**Parameters:**
```typescript
{
  operation: "move",
  operations: Array<{
    type: "move",
    fileId: string,
    parentId: string
  }>
}
```

**Example Request:**
```json
{
  "name": "batch",
  "args": {
    "operation": "move",
    "operations": [
      { "type": "move", "fileId": "1abc", "parentId": "folder1" },
      { "type": "move", "fileId": "2def", "parentId": "folder1" }
    ]
  }
}
```

---

## Error Handling

The server implements standard MCP error responses:

```typescript
{
  content: [{
    type: "text",
    text: "Error message"
  }],
  isError: true
}
```

### Common Error Codes

| Error Type | Description | Resolution |
|------------|-------------|------------|
| Authentication Error | OAuth token invalid or expired | Re-authenticate using `node dist/index.js auth` |
| Permission Denied | Insufficient permissions for file | Check file sharing settings in Google Drive |
| File Not Found | File ID doesn't exist | Verify file ID is correct |
| Invalid Parameters | Missing or invalid parameters | Check parameter types and required fields |
| Quota Exceeded | API rate limit reached | Wait before retrying, implement backoff |
| Network Error | Connection to Google APIs failed | Check internet connection, retry |

### Error Response Format

```json
{
  "isError": true,
  "content": [{
    "type": "text",
    "text": "Error: File not found (ID: 1abc123)"
  }]
}
```

---

## TypeScript Type Definitions

### Sheets Tool Types

```typescript
type SheetsOperation =
  | "list" | "read" | "create" | "rename" | "delete"
  | "update" | "updateFormula" | "format" | "conditionalFormat"
  | "append" | "freeze" | "setColumnWidth";

interface SheetsToolArgs {
  operation: SheetsOperation;
  spreadsheetId: string;
  // ... operation-specific parameters
}
```

### Drive Tool Types

```typescript
type DriveOperation =
  | "search" | "enhancedSearch" | "read"
  | "create" | "update" | "createFolder" | "batch";

interface DriveToolArgs {
  operation: DriveOperation;
  // ... operation-specific parameters
}
```

### Forms Tool Types

```typescript
type FormsOperation = "create" | "get" | "addQuestion" | "listResponses";

interface FormsToolArgs {
  operation: FormsOperation;
  formId?: string;
  // ... operation-specific parameters
}
```

### Docs Tool Types

```typescript
type DocsOperation = "create" | "insertText" | "replaceText" | "applyTextStyle" | "insertTable";

interface DocsToolArgs {
  operation: DocsOperation;
  documentId?: string;
  // ... operation-specific parameters
}
```

### Batch Tool Types

```typescript
type BatchOperation = "create" | "update" | "delete" | "move";

interface BatchToolArgs {
  operation: BatchOperation;
  operations: Array<{
    type: "create" | "update" | "delete" | "move";
    // ... operation-specific parameters
  }>;
}
```

---

## Performance Considerations

### Redis Caching

The server includes optional Redis caching for improved performance:

- **Search results**: Cached for 5 minutes
- **File reads**: Cached for 5 minutes
- **Automatic invalidation**: On write operations

**Configuration:**
```bash
REDIS_URL=redis://localhost:6379
```

### Rate Limiting

Google APIs have rate limits. Implement exponential backoff for retries:

```typescript
async function callToolWithRetry(tool: string, args: any, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await mcpClient.callTool(tool, args);
    } catch (error) {
      if (error.message.includes('Quota exceeded')) {
        const delay = Math.pow(2, i) * 1000; // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }
}
```

### Batch Operations

Use batch operations when processing multiple files to reduce API calls:

```typescript
// ❌ Inefficient: Multiple individual calls
await mcpClient.callTool('drive', { operation: 'update', fileId: '1', content: 'A' });
await mcpClient.callTool('drive', { operation: 'update', fileId: '2', content: 'B' });
await mcpClient.callTool('drive', { operation: 'update', fileId: '3', content: 'C' });

// ✅ Efficient: Single batch call
await mcpClient.callTool('batch', {
  operation: 'update',
  operations: [
    { type: 'update', fileId: '1', content: 'A' },
    { type: 'update', fileId: '2', content: 'B' },
    { type: 'update', fileId: '3', content: 'C' }
  ]
});
```

---

## Migration from v1.x

**All existing tool calls must be updated.** See the [Migration Guide](../MIGRATION_V2.md) for:

- Complete before/after examples for all 32 operations
- TypeScript migration patterns
- Automated migration scripts
- FAQ and troubleshooting

**Quick Example:**

```typescript
// Before (v1.x)
await callTool('listSheets', { spreadsheetId: 'abc123' });

// After (v2.0.0)
await callTool('sheets', { operation: 'list', spreadsheetId: 'abc123' });
```

---

## Additional Resources

- **[README.md](../../README.md)** - Main project documentation
- **[CHANGELOG.md](../../CHANGELOG.md)** - Version history
- **[Migration Guide](../MIGRATION_V2.md)** - v1.x → v2.0.0 migration
- **[Architecture Documentation](../Architecture/ARCHITECTURE.md)** - System design
- **[Examples](../Examples/README.md)** - Usage examples
- **[Troubleshooting](../Troubleshooting/README.md)** - Common issues

---

**Questions or feedback?** Open an issue on [GitHub](https://github.com/AojdevStudio/gdrive/issues).
