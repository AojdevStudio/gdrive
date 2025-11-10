# Migration Guide: v2.x → v3.0

**Google Drive MCP Server v3.0.0** introduces a **code execution architecture** - a fundamental shift from calling individual tools to writing JavaScript code that interacts with Google Workspace APIs.

## Overview of Changes

### What Changed?

**v2.x (Operation-Based Tools):**
- 5 consolidated tools with operations parameter
- Each request = one operation execution
- Sequential operations require multiple tool calls

**v3.0 (Code Execution):**
- 1 tool: `executeCode`
- Write JavaScript code to interact with APIs
- Process data locally, use loops/conditionals
- Progressive tool discovery via `gdrive://tools` resource

### Why This Change?

1. **Massive Token Efficiency** - Up to 98.7% reduction in token usage
2. **Local Data Processing** - Filter/transform large datasets before returning to model
3. **Complex Workflows** - Multi-step operations with control flow
4. **Scalability** - Foundation for hundreds of operations without context bloat

## Breaking Changes

### ⚠️ All v2.x Tool Calls Must Be Converted

Version 3.0 **removes all legacy tools**:
- ❌ `sheets` tool (with operations)
- ❌ `drive` tool (with operations)
- ❌ `forms` tool (with operations)
- ❌ `docs` tool (with operations)
- ❌ `getAppScript` tool

These are replaced with:
- ✅ `executeCode` tool (write JavaScript to call operations)
- ✅ `gdrive://tools` resource (discover available operations)

## Migration Steps

### Step 1: Understand the New Pattern

**Old Pattern (v2.x):**
```json
{
  "name": "sheets",
  "arguments": {
    "operation": "read",
    "spreadsheetId": "abc123",
    "range": "Sheet1!A1:B10"
  }
}
```

**New Pattern (v3.0):**
```json
{
  "name": "executeCode",
  "arguments": {
    "code": "import { readSheet } from './modules/sheets';\nconst data = await readSheet({ spreadsheetId: 'abc123', range: 'Sheet1!A1:B10' });\nreturn data;",
    "timeout": 30000
  }
}
```

### Step 2: Convert Tool Calls to Code

Use this mapping table to convert your existing tool calls:

## Complete Operation Mapping

### Google Drive Operations

#### Search Files
**v2.x:**
```json
{
  "name": "drive",
  "arguments": {
    "operation": "search",
    "query": "type:spreadsheet modifiedDate > 2025-01-01",
    "pageSize": 10
  }
}
```

**v3.0:**
```javascript
import { search } from './modules/drive';

const results = await search({
  query: 'type:spreadsheet modifiedDate > 2025-01-01',
  pageSize: 10
});

return results;
```

#### Enhanced Search
**v2.x:**
```json
{
  "name": "drive",
  "arguments": {
    "operation": "enhancedSearch",
    "query": "quarterly reports",
    "filters": {
      "mimeType": "application/vnd.google-apps.spreadsheet",
      "modifiedAfter": "2025-01-01"
    }
  }
}
```

**v3.0:**
```javascript
import { enhancedSearch } from './modules/drive';

const results = await enhancedSearch({
  query: 'quarterly reports',
  filters: {
    mimeType: 'application/vnd.google-apps.spreadsheet',
    modifiedAfter: '2025-01-01'
  }
});

return results;
```

#### Read File
**v2.x:**
```json
{
  "name": "drive",
  "arguments": {
    "operation": "read",
    "fileId": "file123"
  }
}
```

**v3.0:**
```javascript
import { read } from './modules/drive';

const content = await read({ fileId: 'file123' });
return content;
```

#### Create File
**v2.x:**
```json
{
  "name": "drive",
  "arguments": {
    "operation": "create",
    "name": "New Document.txt",
    "content": "Hello, World!",
    "mimeType": "text/plain",
    "parentId": "folder123"
  }
}
```

**v3.0:**
```javascript
import { createFile } from './modules/drive';

const file = await createFile({
  name: 'New Document.txt',
  content: 'Hello, World!',
  mimeType: 'text/plain',
  parentId: 'folder123'
});

return file;
```

#### Update File
**v2.x:**
```json
{
  "name": "drive",
  "arguments": {
    "operation": "update",
    "fileId": "file123",
    "content": "Updated content"
  }
}
```

**v3.0:**
```javascript
import { updateFile } from './modules/drive';

const result = await updateFile({
  fileId: 'file123',
  content: 'Updated content'
});

return result;
```

#### Create Folder
**v2.x:**
```json
{
  "name": "drive",
  "arguments": {
    "operation": "createFolder",
    "name": "New Folder",
    "parentId": "parent123"
  }
}
```

**v3.0:**
```javascript
import { createFolder } from './modules/drive';

const folder = await createFolder({
  name: 'New Folder',
  parentId: 'parent123'
});

return folder;
```

#### Batch Operations
**v2.x:**
```json
{
  "name": "drive",
  "arguments": {
    "operation": "batch",
    "operations": [
      { "type": "create", "name": "File1.txt", "content": "Content 1" },
      { "type": "update", "fileId": "file123", "content": "Updated" },
      { "type": "delete", "fileId": "file456" }
    ]
  }
}
```

**v3.0:**
```javascript
import { batchOperations } from './modules/drive';

const results = await batchOperations({
  operations: [
    { type: 'create', name: 'File1.txt', content: 'Content 1' },
    { type: 'update', fileId: 'file123', content: 'Updated' },
    { type: 'delete', fileId: 'file456' }
  ]
});

return results;
```

### Google Sheets Operations

#### List Sheets
**v2.x:**
```json
{
  "name": "sheets",
  "arguments": {
    "operation": "list",
    "spreadsheetId": "spreadsheet123"
  }
}
```

**v3.0:**
```javascript
import { listSheets } from './modules/sheets';

const sheets = await listSheets({
  spreadsheetId: 'spreadsheet123'
});

return sheets;
```

#### Read Sheet
**v2.x:**
```json
{
  "name": "sheets",
  "arguments": {
    "operation": "read",
    "spreadsheetId": "spreadsheet123",
    "range": "Sheet1!A1:B10"
  }
}
```

**v3.0:**
```javascript
import { readSheet } from './modules/sheets';

const data = await readSheet({
  spreadsheetId: 'spreadsheet123',
  range: 'Sheet1!A1:B10'
});

return data;
```

#### Create Sheet
**v2.x:**
```json
{
  "name": "sheets",
  "arguments": {
    "operation": "create",
    "spreadsheetId": "spreadsheet123",
    "sheetName": "New Sheet",
    "rowCount": 1000,
    "columnCount": 26
  }
}
```

**v3.0:**
```javascript
import { createSheet } from './modules/sheets';

const result = await createSheet({
  spreadsheetId: 'spreadsheet123',
  sheetName: 'New Sheet',
  rowCount: 1000,
  columnCount: 26
});

return result;
```

#### Rename Sheet
**v2.x:**
```json
{
  "name": "sheets",
  "arguments": {
    "operation": "rename",
    "spreadsheetId": "spreadsheet123",
    "sheetId": 0,
    "newName": "Renamed Sheet"
  }
}
```

**v3.0:**
```javascript
import { renameSheet } from './modules/sheets';

const result = await renameSheet({
  spreadsheetId: 'spreadsheet123',
  sheetId: 0,
  newName: 'Renamed Sheet'
});

return result;
```

#### Delete Sheet
**v2.x:**
```json
{
  "name": "sheets",
  "arguments": {
    "operation": "delete",
    "spreadsheetId": "spreadsheet123",
    "sheetId": 1
  }
}
```

**v3.0:**
```javascript
import { deleteSheet } from './modules/sheets';

const result = await deleteSheet({
  spreadsheetId: 'spreadsheet123',
  sheetId: 1
});

return result;
```

#### Update Cells
**v2.x:**
```json
{
  "name": "sheets",
  "arguments": {
    "operation": "update",
    "spreadsheetId": "spreadsheet123",
    "range": "Sheet1!A1:B2",
    "values": [["Name", "Value"], ["Item 1", "100"]]
  }
}
```

**v3.0:**
```javascript
import { updateCells } from './modules/sheets';

const result = await updateCells({
  spreadsheetId: 'spreadsheet123',
  range: 'Sheet1!A1:B2',
  values: [['Name', 'Value'], ['Item 1', '100']]
});

return result;
```

#### Update Cells with Formula
**v2.x:**
```json
{
  "name": "sheets",
  "arguments": {
    "operation": "updateFormula",
    "spreadsheetId": "spreadsheet123",
    "range": "Sheet1!C2",
    "formula": "=SUM(A2:B2)"
  }
}
```

**v3.0:**
```javascript
import { updateCellsWithFormula } from './modules/sheets';

const result = await updateCellsWithFormula({
  spreadsheetId: 'spreadsheet123',
  range: 'Sheet1!C2',
  formula: '=SUM(A2:B2)'
});

return result;
```

#### Format Cells
**v2.x:**
```json
{
  "name": "sheets",
  "arguments": {
    "operation": "format",
    "spreadsheetId": "spreadsheet123",
    "sheetId": 0,
    "range": { "startRowIndex": 0, "endRowIndex": 1 },
    "format": {
      "bold": true,
      "backgroundColor": { "red": 0.9, "green": 0.9, "blue": 0.9 }
    }
  }
}
```

**v3.0:**
```javascript
import { formatCells } from './modules/sheets';

const result = await formatCells({
  spreadsheetId: 'spreadsheet123',
  sheetId: 0,
  range: { startRowIndex: 0, endRowIndex: 1 },
  format: {
    textFormat: { bold: true },
    backgroundColor: { red: 0.9, green: 0.9, blue: 0.9 }
  }
});

return result;
```

#### Append Rows
**v2.x:**
```json
{
  "name": "sheets",
  "arguments": {
    "operation": "append",
    "spreadsheetId": "spreadsheet123",
    "range": "Sheet1",
    "values": [["New", "Data"], ["More", "Rows"]]
  }
}
```

**v3.0:**
```javascript
import { appendRows } from './modules/sheets';

const result = await appendRows({
  spreadsheetId: 'spreadsheet123',
  range: 'Sheet1',
  values: [['New', 'Data'], ['More', 'Rows']]
});

return result;
```

### Google Forms Operations

#### Create Form
**v2.x:**
```json
{
  "name": "forms",
  "arguments": {
    "operation": "create",
    "title": "Survey Form",
    "description": "Please complete this survey"
  }
}
```

**v3.0:**
```javascript
import { createForm } from './modules/forms';

const form = await createForm({
  title: 'Survey Form',
  description: 'Please complete this survey'
});

return form;
```

#### Read Form
**v2.x:**
```json
{
  "name": "forms",
  "arguments": {
    "operation": "read",
    "formId": "form123"
  }
}
```

**v3.0:**
```javascript
import { readForm } from './modules/forms';

const formData = await readForm({ formId: 'form123' });
return formData;
```

#### Add Question
**v2.x:**
```json
{
  "name": "forms",
  "arguments": {
    "operation": "addQuestion",
    "formId": "form123",
    "title": "What is your name?",
    "type": "TEXT",
    "required": true
  }
}
```

**v3.0:**
```javascript
import { addQuestion } from './modules/forms';

const result = await addQuestion({
  formId: 'form123',
  title: 'What is your name?',
  type: 'TEXT',
  required: true
});

return result;
```

#### List Responses
**v2.x:**
```json
{
  "name": "forms",
  "arguments": {
    "operation": "listResponses",
    "formId": "form123"
  }
}
```

**v3.0:**
```javascript
import { listResponses } from './modules/forms';

const responses = await listResponses({ formId: 'form123' });
return responses;
```

### Google Docs Operations

#### Create Document
**v2.x:**
```json
{
  "name": "docs",
  "arguments": {
    "operation": "create",
    "title": "New Document",
    "content": "Initial content",
    "parentId": "folder123"
  }
}
```

**v3.0:**
```javascript
import { createDocument } from './modules/docs';

const doc = await createDocument({
  title: 'New Document',
  content: 'Initial content',
  parentId: 'folder123'
});

return doc;
```

#### Insert Text
**v2.x:**
```json
{
  "name": "docs",
  "arguments": {
    "operation": "insertText",
    "documentId": "doc123",
    "text": "Hello, World!",
    "index": 1
  }
}
```

**v3.0:**
```javascript
import { insertText } from './modules/docs';

const result = await insertText({
  documentId: 'doc123',
  text: 'Hello, World!',
  index: 1
});

return result;
```

#### Replace Text
**v2.x:**
```json
{
  "name": "docs",
  "arguments": {
    "operation": "replaceText",
    "documentId": "doc123",
    "searchText": "old text",
    "replaceText": "new text",
    "matchCase": false
  }
}
```

**v3.0:**
```javascript
import { replaceText } from './modules/docs';

const result = await replaceText({
  documentId: 'doc123',
  searchText: 'old text',
  replaceText: 'new text',
  matchCase: false
});

return result;
```

#### Apply Text Style
**v2.x:**
```json
{
  "name": "docs",
  "arguments": {
    "operation": "applyTextStyle",
    "documentId": "doc123",
    "startIndex": 1,
    "endIndex": 10,
    "bold": true,
    "fontSize": 14
  }
}
```

**v3.0:**
```javascript
import { applyTextStyle } from './modules/docs';

const result = await applyTextStyle({
  documentId: 'doc123',
  startIndex: 1,
  endIndex: 10,
  bold: true,
  fontSize: 14
});

return result;
```

#### Insert Table
**v2.x:**
```json
{
  "name": "docs",
  "arguments": {
    "operation": "insertTable",
    "documentId": "doc123",
    "rows": 3,
    "columns": 2,
    "index": 1
  }
}
```

**v3.0:**
```javascript
import { insertTable } from './modules/docs';

const result = await insertTable({
  documentId: 'doc123',
  rows: 3,
  columns: 2,
  index: 1
});

return result;
```

## Advanced Patterns in v3.0

### Pattern 1: Local Data Filtering

**Old Way (v2.x):** Multiple sequential calls
```
1. Call "search" → Get 100 files (200KB result passed to model)
2. Model processes and decides which to read
3. Call "read" 10 times → 10 round trips
```

**New Way (v3.0):** Process locally
```javascript
import { search, read } from './modules/drive';

// Search once
const allFiles = await search({ query: 'reports 2025' });

// Filter locally (no tokens consumed for filtering)
const q1Reports = allFiles.files
  .filter(f => f.name.includes('Q1'))
  .slice(0, 5);

// Only return what's needed
return {
  count: q1Reports.length,
  files: q1Reports.map(f => ({ name: f.name, id: f.id }))
};
```

### Pattern 2: Complex Workflows

**Create and populate a spreadsheet with formatting:**
```javascript
import { createFile } from './modules/drive';
import { updateCells, formatCells } from './modules/sheets';

// Create spreadsheet
const sheet = await createFile({
  name: 'Q1 Sales Report',
  mimeType: 'application/vnd.google-apps.spreadsheet'
});

// Add headers and data
await updateCells({
  spreadsheetId: sheet.id,
  range: 'Sheet1!A1:C3',
  values: [
    ['Product', 'Revenue', 'Status'],
    ['Widget A', 50000, 'Active'],
    ['Widget B', 75000, 'Active']
  ]
});

// Format header row
await formatCells({
  spreadsheetId: sheet.id,
  sheetId: 0,
  range: { startRowIndex: 0, endRowIndex: 1 },
  format: {
    textFormat: { bold: true },
    backgroundColor: { red: 0.2, green: 0.4, blue: 0.8 }
  }
});

return {
  spreadsheetId: sheet.id,
  url: sheet.webViewLink
};
```

### Pattern 3: Batch Processing with Error Handling

```javascript
import { search, read } from './modules/drive';

const files = await search({ query: 'type:document' });
const summaries = [];
const errors = [];

for (const file of files.slice(0, 10)) {
  try {
    const content = await read({ fileId: file.id });
    summaries.push({
      name: file.name,
      wordCount: content.split(/\s+/).length,
      hasKeyword: content.includes('urgent'),
    });
  } catch (error) {
    errors.push({ file: file.name, error: error.message });
  }
}

return {
  successful: summaries.length,
  failed: errors.length,
  summaries,
  errors
};
```

## Tool Discovery

Use the `gdrive://tools` resource to discover available operations:

```
Resource URI: gdrive://tools
Returns: JSON structure of all available modules and functions
```

**Example Response:**
```json
{
  "drive": [
    {
      "name": "search",
      "signature": "async function search(options: SearchOptions): Promise<SearchResult>",
      "description": "Search Google Drive for files and folders"
    },
    ...
  ],
  "sheets": [...],
  "forms": [...],
  "docs": [...]
}
```

## Migration Checklist

- [ ] Identify all v2.x tool calls in your codebase
- [ ] Convert each tool call to JavaScript code using mapping table
- [ ] Test each conversion for correctness
- [ ] Consider consolidating multiple sequential operations into single code execution
- [ ] Update error handling to work with code execution errors
- [ ] Update documentation/comments to reflect new patterns
- [ ] Test with real data to verify functionality
- [ ] Monitor token usage to confirm efficiency improvements

## Benefits You'll See

### Token Efficiency
- **Before:** Loading 5 tools × ~500 tokens = 2,500 tokens upfront
- **After:** Loading 1 tool × ~200 tokens = 200 tokens upfront
- **Savings:** 92% reduction in tool definition tokens

### Data Processing
- **Before:** Passing 100 files × 2KB each = 200KB through model multiple times
- **After:** Filter to 5 files locally, return only 10KB to model
- **Savings:** 95% reduction in intermediate data tokens

### Complex Workflows
- **Before:** 10 sequential tool calls = 10 round trips to model
- **After:** 1 code execution with loop = 1 round trip
- **Savings:** 90% reduction in API calls

## Getting Help

- **Full Documentation:** See `README.md` for code execution examples
- **Tool Structure:** Read `gdrive://tools` resource for complete API reference
- **Issues:** Report problems at [GitHub Issues](https://github.com/AojdevStudio/gdrive/issues)

---

**Note:** This is a major breaking change. We recommend thorough testing in a development environment before updating production systems. The v2.x branch will be maintained for 6 months to allow gradual migration.
