# Google Drive MCP Server API Documentation (v3.2.0)

## Overview

The Google Drive MCP Server v3.2.0 implements the Model Context Protocol with a **code execution architecture** that enables developers to write JavaScript code that directly imports and uses Google Workspace operations.

**Version:** 3.2.0
**Release Date:** 2025-12-23
**Architecture:** Code execution model with progressive tool discovery via `gdrive://tools` resource
**Operations:** 40+ functions across 6 modules (Drive, Sheets, Forms, Docs, Gmail, Apps Script)

---

## 🚨 Architecture: Code Execution (v3.0+)

This is a fundamental shift from v2.0.0. Instead of calling operation-based tools with parameters, you write JavaScript code that imports functions directly:

**Before (v2.0.0):**
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

**After (v3.0.0+):**
```javascript
import { readSheet } from './modules/sheets';

const data = await readSheet({
  spreadsheetId: 'abc123',
  range: 'Sheet1!A1:B10'
});

return data;
```

### Key Benefits

- **98.7% Token Reduction** - Progressive discovery means agents only load operations they need
- **Local Data Processing** - Filter/transform data before returning (90-95% data reduction)
- **Complex Workflows** - Write loops, conditionals, and multi-step logic in a single execution
- **Unlimited Scalability** - Foundation for hundreds of operations without context bloat

---

## Authentication

The server uses OAuth 2.0 for authentication with Google APIs, featuring **enterprise-grade token security** with automatic key rotation and encryption.

### Required Scopes

```
https://www.googleapis.com/auth/drive.file           - Full Drive access
https://www.googleapis.com/auth/spreadsheets         - Sheets read/write
https://www.googleapis.com/auth/documents            - Docs read/write
https://www.googleapis.com/auth/forms                - Forms creation/management
https://www.googleapis.com/auth/script.projects.readonly - Apps Script access
https://www.googleapis.com/auth/gmail.readonly       - Read emails
https://www.googleapis.com/auth/gmail.send           - Send emails
https://www.googleapis.com/auth/gmail.compose        - Compose drafts
https://www.googleapis.com/auth/gmail.modify         - Modify labels
```

### Security Features

- **AES-256-GCM Encryption** - All tokens encrypted at rest
- **PBKDF2 Key Derivation** - Minimum 100,000 iterations for key strengthening
- **Automatic Token Refresh** - Tokens refresh automatically with no manual intervention
- **Versioned Keys** - Support for key rotation without data loss
- **Audit Trail** - Comprehensive logging of all authentication events

---

## MCP Protocol Implementation

### ListResourcesRequestSchema

Lists available Google Drive files with pagination support.

**Request:**
```json
{
  "cursor": "optional_pagination_token"
}
```

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

**Request:**
```json
{
  "uri": "gdrive:///<file_id>"
}
```

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

### Tool Discovery Resource

**Resource:** `gdrive://tools`
**Type:** Hierarchical structure of all available modules and operations
**Purpose:** Progressive discovery - agents explore operations on-demand instead of loading all 40+ operations upfront

---

## Modules API

All operations are organized into 6 modules. Import and use them directly in your code execution:

```javascript
import { search, read, createFile } from './modules/drive';
import { readSheet, updateCells } from './modules/sheets';
import { createForm, addQuestion } from './modules/forms';
import { createDocument, insertText } from './modules/docs';
import { sendMessage, listLabels } from './modules/gmail';
```

---

## 📁 `drive` Module - Google Drive Operations

Complete file and folder management for Google Drive.

### `search(options)`

Search for files and folders with natural language queries.

**Parameters:**
```typescript
{
  query: string           // Search query (e.g., "spreadsheets modified last week")
  pageSize?: number      // Results per page (default: 10)
  pageToken?: string     // Pagination token for subsequent pages
}
```

**Returns:**
```typescript
{
  files: Array<{
    id: string
    name: string
    mimeType: string
    webViewLink: string
    createdTime: string
    modifiedTime: string
  }>,
  nextPageToken?: string
}
```

**Example:**
```javascript
import { search } from './modules/drive';

const results = await search({
  query: 'spreadsheets modified this month'
});

console.log(`Found ${results.files.length} files`);
results.files.forEach(f => console.log(`- ${f.name} (${f.mimeType})`));
```

---

### `enhancedSearch(options)`

Advanced search with filters, date ranges, and complex queries.

**Parameters:**
```typescript
{
  query: string,
  filters?: {
    mimeType?: string              // Filter by MIME type
    createdAfter?: string          // ISO 8601 date
    createdBefore?: string         // ISO 8601 date
    modifiedAfter?: string         // ISO 8601 date
    modifiedBefore?: string        // ISO 8601 date
    ownedByMe?: boolean            // Only files I own
    sharedWithMe?: boolean         // Only shared files
    trashed?: boolean              // Include trashed files
    parents?: string               // Parent folder ID
  },
  orderBy?: string,              // "modifiedTime desc", "name", etc.
  pageSize?: number,
  pageToken?: string
}
```

**Example:**
```javascript
import { enhancedSearch } from './modules/drive';

const budget = await enhancedSearch({
  query: 'budget',
  filters: {
    mimeType: 'application/vnd.google-apps.spreadsheet',
    modifiedAfter: '2025-01-01',
    ownedByMe: true
  },
  orderBy: 'modifiedTime desc'
});
```

---

### `read(options)`

Read file contents with automatic format conversion.

**Parameters:**
```typescript
{
  fileId: string         // Google Drive file ID
}
```

**Returns:**
```typescript
{
  id: string
  name: string
  mimeType: string
  content: string        // File content (format depends on type)
}
```

**Supported File Types:**
- **Google Docs** → Exported as Markdown
- **Google Sheets** → Exported as CSV
- **Google Slides** → Exported as Plain Text
- **Google Drawings** → Exported as PNG (base64)
- **Text Files** → UTF-8 text
- **Binary Files** → Base64-encoded blob

**Example:**
```javascript
import { read } from './modules/drive';

const file = await read({
  fileId: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms'
});

console.log(`${file.name}:\n${file.content.substring(0, 200)}...`);
```

---

### `createFile(options)`

Create a new file in Google Drive.

**Parameters:**
```typescript
{
  name: string           // File name
  content?: string       // File content (optional)
  mimeType?: string      // MIME type (default: text/plain)
  parentId?: string      // Parent folder ID (optional)
}
```

**Returns:**
```typescript
{
  id: string
  name: string
  mimeType: string
  webViewLink: string
}
```

**Example:**
```javascript
import { createFile } from './modules/drive';

const file = await createFile({
  name: 'Meeting Notes.txt',
  content: 'Q4 Planning Meeting\n\n1. Budget review\n2. Timeline discussion',
  mimeType: 'text/plain'
});

return { fileId: file.id, url: file.webViewLink };
```

---

### `updateFile(options)`

Update an existing file's content.

**Parameters:**
```typescript
{
  fileId: string         // File ID to update
  content: string        // New content
}
```

**Example:**
```javascript
import { updateFile } from './modules/drive';

await updateFile({
  fileId: '1abc123',
  content: 'Updated content here'
});
```

---

### `createFolder(options)`

Create a new folder.

**Parameters:**
```typescript
{
  name: string           // Folder name
  parentId?: string      // Parent folder ID (optional)
}
```

**Returns:**
```typescript
{
  id: string
  name: string
  mimeType: "application/vnd.google-apps.folder"
  webViewLink: string
}
```

**Example:**
```javascript
import { createFolder } from './modules/drive';

const folder = await createFolder({
  name: 'Q4 Reports'
});

return folder.id;
```

---

### `batchOperations(options)`

Process multiple file operations efficiently in a single call.

**Parameters:**
```typescript
{
  operations: Array<
    | {
        type: 'create'
        name: string
        content?: string
        mimeType?: string
        parentId?: string
      }
    | {
        type: 'update'
        fileId: string
        content: string
      }
    | {
        type: 'delete'
        fileId: string
      }
    | {
        type: 'move'
        fileId: string
        parentId: string
      }
  >
}
```

**Returns:**
```typescript
{
  results: Array<{
    success: boolean
    data?: object
    error?: string
  }>
}
```

**Example:**
```javascript
import { batchOperations } from './modules/drive';

const results = await batchOperations({
  operations: [
    { type: 'create', name: 'file1.txt', content: 'Content 1' },
    { type: 'create', name: 'file2.txt', content: 'Content 2' },
    { type: 'delete', fileId: 'old_file_id' }
  ]
});

console.log(`${results.results.filter(r => r.success).length} operations succeeded`);
```

---

## 📊 `sheets` Module - Google Sheets Operations

Complete spreadsheet management and data manipulation.

### `listSheets(options)`

List all sheets in a spreadsheet.

**Parameters:**
```typescript
{
  spreadsheetId: string
}
```

**Returns:**
```typescript
{
  sheets: Array<{
    properties: {
      sheetId: number
      title: string
      index: number
      hidden: boolean
      rightToLeft: boolean
    }
  }>
}
```

**Example:**
```javascript
import { listSheets } from './modules/sheets';

const sheets = await listSheets({
  spreadsheetId: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms'
});

sheets.sheets.forEach(s => console.log(`- ${s.properties.title}`));
```

---

### `readSheet(options)`

Read data from a specific range in a spreadsheet.

**Parameters:**
```typescript
{
  spreadsheetId: string
  range: string          // A1 notation (e.g., "Sheet1!A1:D10")
}
```

**Returns:**
```typescript
{
  range: string
  majorDimension: string // "ROWS" or "COLUMNS"
  values: any[][]        // 2D array of cell values
}
```

**Example:**
```javascript
import { readSheet } from './modules/sheets';

const data = await readSheet({
  spreadsheetId: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms',
  range: 'Sheet1!A1:C20'
});

// Process locally - no tokens consumed
const totals = data.values.slice(1).map(row => ({
  name: row[0],
  amount: parseFloat(row[1]) || 0
}));

return totals;
```

---

### `createSheet(options)`

Create a new sheet in a spreadsheet.

**Parameters:**
```typescript
{
  spreadsheetId: string
  sheetName: string
  index?: number              // Position (0-based)
  hidden?: boolean            // Hide the sheet
  rightToLeft?: boolean       // RTL text direction
  rowCount?: number           // Number of rows (default: 1000)
  columnCount?: number        // Number of columns (default: 26)
  frozenRowCount?: number     // Frozen rows
  frozenColumnCount?: number  // Frozen columns
  tabColor?: {                // Tab color (RGB 0.0-1.0)
    red?: number
    green?: number
    blue?: number
    alpha?: number
  }
}
```

**Returns:**
```typescript
{
  spreadsheetId: string
  replies: Array<{ spreadsheetId: string }>
}
```

**Example:**
```javascript
import { createSheet } from './modules/sheets';

await createSheet({
  spreadsheetId: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms',
  sheetName: 'Q4 Sales',
  frozenRowCount: 1,
  tabColor: {
    red: 0.2,
    green: 0.6,
    blue: 0.9
  }
});
```

---

### `renameSheet(options)`

Rename an existing sheet.

**Parameters:**
```typescript
{
  spreadsheetId: string
  sheetName?: string     // Sheet name (use this OR sheetId)
  sheetId?: number       // Sheet ID (use this OR sheetName)
  newName: string        // New name
}
```

**Example:**
```javascript
import { renameSheet } from './modules/sheets';

await renameSheet({
  spreadsheetId: '1abc123',
  sheetName: 'Old Name',
  newName: 'New Name'
});
```

---

### `deleteSheet(options)`

Delete a sheet from a spreadsheet.

**Parameters:**
```typescript
{
  spreadsheetId: string
  sheetName?: string     // Sheet name (use this OR sheetId)
  sheetId?: number       // Sheet ID (use this OR sheetName)
}
```

**Example:**
```javascript
import { deleteSheet } from './modules/sheets';

await deleteSheet({
  spreadsheetId: '1abc123',
  sheetName: 'Obsolete Data'
});
```

---

### `updateCells(options)`

Update cell values in a range.

**Parameters:**
```typescript
{
  spreadsheetId: string
  range: string          // A1 notation (e.g., "Sheet1!A1:B2")
  values: any[][]        // 2D array of values
}
```

**Example:**
```javascript
import { updateCells } from './modules/sheets';

await updateCells({
  spreadsheetId: '1abc123',
  range: 'Sheet1!A1:C2',
  values: [
    ['Product', 'Price', 'Quantity'],
    ['Widget', 19.99, 100]
  ]
});
```

---

### `updateCellsWithFormula(options)`

Apply Google Sheets formulas to specific cells.

**Parameters:**
```typescript
{
  spreadsheetId: string
  range: string          // A1 notation
  formula: string        // Formula starting with '='
  sheetName?: string     // Sheet name (if not in range)
}
```

**Security Note:** Be cautious with user-provided formulas. Functions like `IMPORTXML`, `IMPORTHTML`, and `IMPORTDATA` can access external URLs.

**Examples:**

SUM formula:
```javascript
import { updateCellsWithFormula } from './modules/sheets';

await updateCellsWithFormula({
  spreadsheetId: '1abc123',
  range: 'Sheet1!D25',
  formula: '=SUM(D2:D24)'
});
```

Relative references (applied to range):
```javascript
// Applies =D2*1.1 to E2, =D3*1.1 to E3, etc.
await updateCellsWithFormula({
  spreadsheetId: '1abc123',
  range: 'E2:E25',
  formula: '=D2*1.1'
});
```

VLOOKUP:
```javascript
await updateCellsWithFormula({
  spreadsheetId: '1abc123',
  range: 'Sheet1!C2',
  formula: '=VLOOKUP(A2,Prices!A:B,2,FALSE)'
});
```

---

### `formatCells(options)`

Apply formatting to cells (bold, colors, number formats).

**Parameters:**
```typescript
{
  spreadsheetId: string
  sheetId?: number,      // Sheet ID
  range?: {              // OR range object
    startRowIndex: number
    endRowIndex: number
    startColumnIndex?: number
    endColumnIndex?: number
  },
  format: {
    bold?: boolean
    italic?: boolean
    underline?: boolean
    fontSize?: number
    foregroundColor?: {    // Text color (RGB 0.0-1.0)
      red?: number
      green?: number
      blue?: number
      alpha?: number
    },
    backgroundColor?: {    // Cell background (RGB 0.0-1.0)
      red?: number
      green?: number
      blue?: number
      alpha?: number
    },
    numberFormat?: {
      type: "CURRENCY" | "PERCENT" | "DATE" | "NUMBER" | "TEXT"
      pattern?: string     // Custom pattern (e.g., "$#,##0.00")
    }
  }
}
```

**Examples:**

Bold headers with gray background:
```javascript
import { formatCells } from './modules/sheets';

await formatCells({
  spreadsheetId: '1abc123',
  range: { startRowIndex: 0, endRowIndex: 1 },
  format: {
    bold: true,
    backgroundColor: {
      red: 0.85,
      green: 0.85,
      blue: 0.85
    }
  }
});
```

Currency formatting:
```javascript
await formatCells({
  spreadsheetId: '1abc123',
  range: { startRowIndex: 1, endRowIndex: 100, startColumnIndex: 2, endColumnIndex: 3 },
  format: {
    numberFormat: {
      type: 'CURRENCY',
      pattern: '$#,##0.00'
    }
  }
});
```

---

### `addConditionalFormatting(options)`

Add conditional formatting rules to highlight cells.

**Parameters:**
```typescript
{
  spreadsheetId: string
  sheetId: number
  range: {
    startRowIndex: number
    endRowIndex: number
    startColumnIndex?: number
    endColumnIndex?: number
  },
  rule: {
    condition: {
      type: "NUMBER_GREATER" | "NUMBER_LESS" | "TEXT_CONTAINS" | "CUSTOM_FORMULA"
      values?: Array<{ userEnteredValue: string }>
      formula?: string
    },
    format: {
      backgroundColor?: { red?: number, green?: number, blue?: number, alpha?: number }
      foregroundColor?: { red?: number, green?: number, blue?: number, alpha?: number }
      bold?: boolean
    }
  }
}
```

**Example:**
```javascript
import { addConditionalFormatting } from './modules/sheets';

await addConditionalFormatting({
  spreadsheetId: '1abc123',
  sheetId: 0,
  range: { startRowIndex: 1, endRowIndex: 100, startColumnIndex: 3, endColumnIndex: 4 },
  rule: {
    condition: {
      type: 'NUMBER_GREATER',
      values: [{ userEnteredValue: '0' }]
    },
    format: {
      backgroundColor: { red: 0.7, green: 0.9, blue: 0.7 }
    }
  }
});
```

---

### `freezeRowsColumns(options)`

Freeze header rows and columns for better scrolling.

**Parameters:**
```typescript
{
  spreadsheetId: string
  sheetId: number
  frozenRowCount?: number       // Rows to freeze
  frozenColumnCount?: number    // Columns to freeze
}
```

**Example:**
```javascript
import { freezeRowsColumns } from './modules/sheets';

await freezeRowsColumns({
  spreadsheetId: '1abc123',
  sheetId: 0,
  frozenRowCount: 1,
  frozenColumnCount: 2
});
```

---

### `setColumnWidth(options)`

Adjust pixel widths for specific columns.

**Parameters:**
```typescript
{
  spreadsheetId: string
  sheetId: number
  columns: Array<{
    columnIndex: number    // 0-based (A=0, B=1, etc.)
    width?: number         // Width in pixels (default: 100)
  }>
}
```

**Example:**
```javascript
import { setColumnWidth } from './modules/sheets';

await setColumnWidth({
  spreadsheetId: '1abc123',
  sheetId: 0,
  columns: [
    { columnIndex: 0, width: 150 },
    { columnIndex: 1, width: 200 }
  ]
});
```

---

### `appendRows(options)`

Append rows to the end of a sheet.

**Parameters:**
```typescript
{
  spreadsheetId: string
  values: any[][]        // 2D array of values
  sheetName?: string     // Sheet name (default: first sheet)
}
```

**Example:**
```javascript
import { appendRows } from './modules/sheets';

await appendRows({
  spreadsheetId: '1abc123',
  sheetName: 'Sheet1',
  values: [
    ['New Row 1', 'Data 1'],
    ['New Row 2', 'Data 2']
  ]
});
```

---

## 📋 `forms` Module - Google Forms Operations

Create and manage Google Forms with questions and responses.

### `createForm(options)`

Create a new Google Form.

**Parameters:**
```typescript
{
  title: string          // Form title
  description?: string   // Optional: form description
}
```

**Returns:**
```typescript
{
  formId: string
  title: string
  description: string
  responderUri: string   // Link to submit responses
}
```

**Example:**
```javascript
import { createForm } from './modules/forms';

const form = await createForm({
  title: 'Customer Feedback Survey',
  description: 'Help us improve our service'
});

return form.responderUri;
```

---

### `readForm(options)`

Retrieve form details and questions.

**Parameters:**
```typescript
{
  formId: string
}
```

**Returns:**
```typescript
{
  formId: string
  title: string
  description: string
  items: Array<{
    itemId: string
    title: string
    description: string
    questionItem?: {
      question: {
        questionType: string
        required: boolean
        options?: string[]
      }
    }
  }>
}
```

**Example:**
```javascript
import { readForm } from './modules/forms';

const form = await readForm({
  formId: '1a2b3c4d5e6f'
});

console.log(`Form: ${form.title}`);
console.log(`Questions: ${form.items.length}`);
```

---

### `addQuestion(options)`

Add a question to an existing form.

**Parameters:**
```typescript
{
  formId: string
  title: string                  // Question text
  type: "TEXT"                   // Single-line text
       | "PARAGRAPH_TEXT"         // Multi-line text
       | "MULTIPLE_CHOICE"        // Radio buttons
       | "CHECKBOX"               // Checkboxes
       | "DROPDOWN"               // Dropdown list
       | "LINEAR_SCALE"           // Rating scale
       | "DATE"                   // Date picker
       | "TIME",                  // Time picker
  required?: boolean             // Required field (default: false)
  options?: string[],            // For MULTIPLE_CHOICE/CHECKBOX/DROPDOWN
  scaleMin?: number,             // For LINEAR_SCALE (default: 1)
  scaleMax?: number,             // For LINEAR_SCALE (default: 5)
  scaleMinLabel?: string,        // For LINEAR_SCALE
  scaleMaxLabel?: string         // For LINEAR_SCALE
}
```

**Examples:**

Multiple choice question:
```javascript
import { addQuestion } from './modules/forms';

await addQuestion({
  formId: '1a2b3c4d5e6f',
  title: 'How satisfied are you with our service?',
  type: 'MULTIPLE_CHOICE',
  required: true,
  options: ['Very Satisfied', 'Satisfied', 'Neutral', 'Unsatisfied']
});
```

Linear scale:
```javascript
await addQuestion({
  formId: '1a2b3c4d5e6f',
  title: 'Rate our customer support',
  type: 'LINEAR_SCALE',
  scaleMin: 1,
  scaleMax: 10,
  scaleMinLabel: 'Poor',
  scaleMaxLabel: 'Excellent'
});
```

---

### `listResponses(options)`

Get all responses to a form.

**Parameters:**
```typescript
{
  formId: string
}
```

**Returns:**
```typescript
{
  responses: Array<{
    responseId: string
    createTime: string
    answers: {
      [questionId: string]: {
        textAnswers?: { answers: Array<{ value: string }> }
      }
    }
  }>
}
```

**Example:**
```javascript
import { listResponses } from './modules/forms';

const responses = await listResponses({
  formId: '1a2b3c4d5e6f'
});

console.log(`Received ${responses.responses.length} responses`);
```

---

## 📝 `docs` Module - Google Docs Operations

Create and manipulate Google Documents.

### `createDocument(options)`

Create a new Google Docs document.

**Parameters:**
```typescript
{
  title: string          // Document title
  content?: string       // Optional: initial content (plain text)
  parentId?: string      // Optional: parent folder ID
}
```

**Returns:**
```typescript
{
  documentId: string
  title: string
  body: {
    content: Array<object>
  }
}
```

**Example:**
```javascript
import { createDocument } from './modules/docs';

const doc = await createDocument({
  title: 'Project Proposal',
  content: 'Overview\n\nThis document outlines the Q4 initiative.'
});

return { documentId: doc.documentId, title: doc.title };
```

---

### `insertText(options)`

Insert text at a specific position in a document.

**Parameters:**
```typescript
{
  documentId: string
  index: number          // Position to insert (1 = after first character)
  text: string           // Text to insert
}
```

**Example:**
```javascript
import { insertText } from './modules/docs';

await insertText({
  documentId: '1abc123',
  index: 1,
  text: 'Executive Summary\n\n'
});
```

---

### `replaceText(options)`

Find and replace text in a document.

**Parameters:**
```typescript
{
  documentId: string
  searchText: string
  replaceText: string
  matchCase?: boolean    // Case-sensitive (default: false)
}
```

**Example:**
```javascript
import { replaceText } from './modules/docs';

await replaceText({
  documentId: '1abc123',
  searchText: 'Q3',
  replaceText: 'Q4',
  matchCase: false
});
```

---

### `applyTextStyle(options)`

Apply formatting to text ranges.

**Parameters:**
```typescript
{
  documentId: string
  startIndex: number
  endIndex: number
  bold?: boolean
  italic?: boolean
  underline?: boolean
  fontSize?: number
  foregroundColor?: {    // RGB 0.0-1.0
    red?: number
    green?: number
    blue?: number
  }
}
```

**Example:**
```javascript
import { applyTextStyle } from './modules/docs';

await applyTextStyle({
  documentId: '1abc123',
  startIndex: 1,
  endIndex: 50,
  bold: true,
  fontSize: 14
});
```

---

### `insertTable(options)`

Insert a table into a document.

**Parameters:**
```typescript
{
  documentId: string
  index: number          // Position to insert
  rows: number           // Number of rows
  columns: number        // Number of columns
}
```

**Example:**
```javascript
import { insertTable } from './modules/docs';

await insertTable({
  documentId: '1abc123',
  index: 100,
  rows: 5,
  columns: 3
});
```

---

## 📧 `gmail` Module - Gmail Operations (NEW in v3.2.0)

Complete email management with message access, drafts, and label support.

### `listMessages(options)`

List messages in the user's mailbox.

**Parameters:**
```typescript
{
  maxResults?: number              // Max messages to return (default: 10, max: 500)
  labelIds?: string[]              // Filter by label IDs (e.g., ['INBOX', 'UNREAD'])
  pageToken?: string               // Pagination token
  includeSpamTrash?: boolean        // Include spam/trash (default: false)
}
```

**Returns:**
```typescript
{
  messages: Array<{
    id: string
    threadId: string
    labelIds?: string[]
  }>,
  nextPageToken?: string
}
```

**Example:**
```javascript
import { listMessages } from './modules/gmail';

const messages = await listMessages({
  maxResults: 20,
  labelIds: ['INBOX'],
  includeSpamTrash: false
});

console.log(`Found ${messages.messages.length} inbox messages`);
```

---

### `listThreads(options)`

List email threads in the user's mailbox.

**Parameters:**
```typescript
{
  maxResults?: number              // Max threads to return (default: 10)
  labelIds?: string[]              // Filter by label IDs
  pageToken?: string               // Pagination token
  includeSpamTrash?: boolean        // Include spam/trash (default: false)
}
```

**Returns:**
```typescript
{
  threads: Array<{
    id: string
    snippet: string
    historyId: string
    messages?: Array<{
      id: string
      threadId: string
    }>
  }>,
  nextPageToken?: string
}
```

**Example:**
```javascript
import { listThreads } from './modules/gmail';

const threads = await listThreads({
  maxResults: 15,
  labelIds: ['UNREAD']
});
```

---

### `getMessage(options)`

Get a specific message by ID with full content.

**Parameters:**
```typescript
{
  id: string                       // Message ID
  format?: "minimal"               // Only metadata (default)
         | "full"                  // Complete message with headers
         | "raw"                   // Raw RFC 2822 format
         | "metadata"              // Headers only
}
```

**Returns:**
```typescript
{
  id: string
  threadId: string
  labelIds?: string[]
  snippet: string
  payload?: {
    mimeType: string
    headers: Array<{ name: string, value: string }>
    body: { size: number, data?: string }
    parts?: Array<any>
  },
  raw?: string
}
```

**Example:**
```javascript
import { getMessage } from './modules/gmail';

const message = await getMessage({
  id: '18c123abc',
  format: 'full'
});

console.log(`From: ${message.payload.headers.find(h => h.name === 'From').value}`);
console.log(`Subject: ${message.payload.headers.find(h => h.name === 'Subject').value}`);
```

---

### `getThread(options)`

Get a thread with all its messages.

**Parameters:**
```typescript
{
  id: string                       // Thread ID
  format?: "minimal" | "full" | "metadata"  // Response format
}
```

**Returns:**
```typescript
{
  id: string
  historyId: string
  messages: Array<{
    id: string
    threadId: string
    labelIds?: string[]
    snippet: string
    payload?: object
  }>
}
```

**Example:**
```javascript
import { getThread } from './modules/gmail';

const thread = await getThread({
  id: '18c123abc',
  format: 'full'
});

console.log(`Thread has ${thread.messages.length} messages`);
```

---

### `searchMessages(options)`

Search messages using Gmail query syntax.

**Parameters:**
```typescript
{
  query: string                    // Gmail search query
  maxResults?: number              // Max results (default: 10)
  pageToken?: string               // Pagination token
  includeSpamTrash?: boolean        // Include spam/trash
}
```

**Query Examples:**
```
from:boss@company.com              // From specific sender
to:me@example.com                  // To me
subject:"budget report"            // Subject contains text
is:unread                          // Unread messages
is:read                            // Read messages
before:2025-01-01                  // Before date
after:2024-01-01                   // After date
has:attachment                     // Has attachments
in:DRAFT                           // In drafts
```

**Example:**
```javascript
import { searchMessages } from './modules/gmail';

const unread = await searchMessages({
  query: 'from:boss@company.com is:unread',
  maxResults: 20
});

console.log(`Found ${unread.messages.length} unread messages from boss`);
```

---

### `createDraft(options)`

Create an email draft.

**Parameters:**
```typescript
{
  to: string[]                     // Recipient email addresses
  subject: string                  // Email subject
  body: string                     // Email body
  cc?: string[]                    // CC recipients
  bcc?: string[]                   // BCC recipients
  isHtml?: boolean                 // Body is HTML (default: false)
  from?: string                    // Send-as alias (optional)
}
```

**Returns:**
```typescript
{
  id: string                       // Draft ID
  message: {
    id: string
    threadId: string
    payload: object
  }
}
```

**Example:**
```javascript
import { createDraft } from './modules/gmail';

const draft = await createDraft({
  to: ['client@example.com'],
  subject: 'Project Update',
  body: 'Hi,\n\nHere is your project update...',
  isHtml: false
});

console.log(`Draft created: ${draft.id}`);
```

---

### `sendMessage(options)`

Send a new email message.

**Parameters:**
```typescript
{
  to: string[]                     // Recipient addresses
  subject: string                  // Subject
  body: string                     // Body text
  cc?: string[]                    // CC recipients
  bcc?: string[]                   // BCC recipients
  isHtml?: boolean                 // Body is HTML (default: false)
  from?: string                    // Send-as alias (optional)
  threadId?: string                // Reply to thread (optional)
}
```

**Returns:**
```typescript
{
  id: string                       // Message ID
  threadId: string
  labelIds: string[]
}
```

**Example:**
```javascript
import { sendMessage } from './modules/gmail';

const message = await sendMessage({
  to: ['recipient@example.com'],
  cc: ['manager@company.com'],
  subject: 'Meeting Follow-up',
  body: 'Hi,\n\nThank you for the meeting today...',
  from: 'team@company.com'  // Send from alias
});

return `Email sent (ID: ${message.id})`;
```

---

### `sendDraft(options)`

Send an existing draft.

**Parameters:**
```typescript
{
  draftId: string                  // Draft ID to send
}
```

**Returns:**
```typescript
{
  id: string                       // Message ID
  threadId: string
  labelIds: string[]
}
```

**Example:**
```javascript
import { sendDraft } from './modules/gmail';

const message = await sendDraft({
  draftId: 'r1234567890'
});

console.log(`Draft sent as message: ${message.id}`);
```

---

### `listLabels(options)`

List all labels in the user's mailbox.

**Parameters:**
```typescript
{}                                 // No parameters
```

**Returns:**
```typescript
{
  labels: Array<{
    id: string
    name: string
    type: "system" | "user"
    messageListVisibility?: string
    labelListVisibility?: string
    color?: {
      textColor?: string
      backgroundColor?: string
    }
  }>
}
```

**Example:**
```javascript
import { listLabels } from './modules/gmail';

const labels = await listLabels({});

const customLabels = labels.labels.filter(l => l.type === 'user');
console.log(`Custom labels: ${customLabels.map(l => l.name).join(', ')}`);
```

---

### `modifyLabels(options)`

Add or remove labels from a message.

**Parameters:**
```typescript
{
  messageId: string                // Message ID
  addLabelIds?: string[]           // Label IDs to add
  removeLabelIds?: string[]        // Label IDs to remove
}
```

**Example:**
```javascript
import { modifyLabels } from './modules/gmail';

// Archive and mark as read
await modifyLabels({
  messageId: '18c123abc',
  removeLabelIds: ['UNREAD', 'INBOX'],  // Remove UNREAD and INBOX (archive)
  addLabelIds: ['ARCHIVE']               // Add ARCHIVE label
});
```

---

## Error Handling

All operations may throw errors. Handle them appropriately in your code:

```javascript
import { search } from './modules/drive';

try {
  const results = await search({ query: 'documents' });
} catch (error) {
  if (error.message.includes('Authentication')) {
    return { error: 'Please re-authenticate' };
  } else if (error.message.includes('Quota')) {
    return { error: 'Rate limit exceeded, retry in 60 seconds' };
  } else {
    throw error;
  }
}
```

### Common Error Codes

| Error Type | Description | Resolution |
|------------|-------------|------------|
| Authentication Error | OAuth token invalid or expired | Re-run `node dist/index.js auth` |
| Permission Denied | Insufficient permissions for file | Check file sharing settings in Google Drive |
| File Not Found | File ID doesn't exist | Verify file ID is correct |
| Quota Exceeded | API rate limit reached | Wait before retrying, implement exponential backoff |
| Network Error | Connection to Google APIs failed | Check internet connection, retry |
| Invalid Parameters | Missing or invalid parameters | Check parameter types and required fields |

---

## Performance Considerations

### Local Data Processing

A major advantage of the code execution model is processing data locally without consuming tokens:

```javascript
import { search } from './modules/drive';

// Search once (1 API call)
const allResults = await search({ query: 'reports', pageSize: 100 });

// Filter/process locally (no tokens, no API calls)
const q4Reports = allResults.files
  .filter(f => f.name.includes('Q4'))
  .filter(f => f.modifiedTime > '2024-10-01')
  .slice(0, 10)
  .map(f => ({ name: f.name, id: f.id }));

return q4Reports;  // Only return filtered data
```

### Rate Limiting

Google APIs have rate limits. Implement exponential backoff:

```javascript
async function callWithRetry(fn, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (error.message.includes('Quota exceeded') && i < maxRetries - 1) {
        const delay = Math.pow(2, i) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }
}
```

### Batch Operations

Use batch operations for multiple files:

```javascript
import { batchOperations } from './modules/drive';

// Efficient: 3 operations in 1 API call
const results = await batchOperations({
  operations: [
    { type: 'create', name: 'file1.txt', content: 'A' },
    { type: 'create', name: 'file2.txt', content: 'B' },
    { type: 'create', name: 'file3.txt', content: 'C' }
  ]
});
```

### Caching

The server automatically caches search results and file reads with:
- **TTL:** 5 minutes
- **Invalidation:** Automatic on write operations
- **Redis:** Optional but recommended for production

Configure with:
```bash
REDIS_URL=redis://localhost:6379
```

---

## Security Best Practices

1. **Formula Validation** - Validate user-provided formulas before using `updateCellsWithFormula`
2. **Email Handling** - Be careful with email content from untrusted sources
3. **Token Management** - Tokens are encrypted at rest, but keep encryption keys secure
4. **Rate Limiting** - Implement backoff for quota-exceeded errors
5. **Error Messages** - Don't expose sensitive file IDs in error messages to users

---

## Migration from v2.0.0

The v2.0.0 operation-based tool approach is replaced by code execution. See the [Migration Guide](../MIGRATION.md) for comprehensive before/after examples.

**Quick Comparison:**

| v2.0.0 (Operation-based) | v3.2.0 (Code Execution) |
|--------------------------|------------------------|
| `sheets` tool with `operation: "read"` | Import `readSheet` from `./modules/sheets` |
| Operation parameters in JSON | JavaScript function parameters |
| 40+ tool definitions | Progressive discovery via `gdrive://tools` |
| Limited to single operation per call | Write loops, conditionals, multi-step workflows |

---

## TypeScript Support

All operations are fully typed. Use TypeScript for autocompletion:

```typescript
import { readSheet } from './modules/sheets';
import type { ValueRange } from 'googleapis';

const data: ValueRange = await readSheet({
  spreadsheetId: 'abc123',
  range: 'Sheet1!A1:B10'
});
```

---

## Additional Resources

- **[README.md](../../README.md)** - Main project documentation
- **[CHANGELOG.md](../../CHANGELOG.md)** - Version history and release notes
- **[Migration Guide](../MIGRATION.md)** - Complete v2.0.0 → v3.2.0 migration
- **[Security Documentation](../Architecture/ARCHITECTURE.md#security)** - Security features and best practices
- **[Docker Deployment](../Deployment/DOCKER.md)** - Container setup and configuration
- **[Examples](../Examples/README.md)** - Complete usage examples

---

**Questions or feedback?** Open an issue on [GitHub](https://github.com/modelcontextprotocol/servers/issues).
