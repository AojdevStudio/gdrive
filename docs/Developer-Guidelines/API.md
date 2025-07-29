# Google Drive MCP Server API Documentation

## Overview

The Google Drive MCP Server implements the Model Context Protocol to provide standardized access to Google Workspace services. This document details the available APIs, their parameters, and usage examples.

## Authentication

The server uses OAuth 2.0 for authentication with Google APIs. Required scopes:
- `https://www.googleapis.com/auth/drive.readonly` (current)
- `https://www.googleapis.com/auth/spreadsheets.readonly` (current)

### Planned Scopes
- `https://www.googleapis.com/auth/drive.file`
- `https://www.googleapis.com/auth/spreadsheets`
- `https://www.googleapis.com/auth/documents`
- `https://www.googleapis.com/auth/forms`

## MCP Protocol Implementation

The server implements the following MCP handlers:

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

### ListToolsRequestSchema
Returns available tools.

**Response:**
```json
{
  "tools": [
    {
      "name": "search",
      "description": "Search for files in Google Drive",
      "inputSchema": { ... }
    },
    // ... other tools
  ]
}
```

### CallToolRequestSchema
Executes a specific tool.

## Tools API

### search
Search for files in Google Drive using full-text search.

**Parameters:**
```typescript
{
  query: string  // Search query
}
```

**Example:**
```json
{
  "name": "search",
  "arguments": {
    "query": "quarterly report"
  }
}
```

**Response:**
```
Found 3 files:
Quarterly Report Q1 2024 (application/vnd.google-apps.spreadsheet) - ID: 1abc...
Quarterly Report Q2 2024 (application/vnd.google-apps.document) - ID: 2def...
Quarterly Report Summary (application/pdf) - ID: 3ghi...
```

### read
Read the contents of a specific file.

**Parameters:**
```typescript
{
  fileId: string  // Google Drive file ID
}
```

**Example:**
```json
{
  "name": "read",
  "arguments": {
    "fileId": "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
  }
}
```

### listSheets
List all sheets within a Google Spreadsheet.

**Parameters:**
```typescript
{
  spreadsheetId: string  // Google Spreadsheet ID
}
```

**Response Example:**
```
Available sheets:
- Sheet1 (ID: 0)
- Sales Data (ID: 1234567)
- Summary (ID: 9876543)
```

### readSheet
Read contents from a specific sheet.

**Parameters:**
```typescript
{
  spreadsheetId: string,     // Google Spreadsheet ID
  sheetName: string,         // Name of the sheet
  range?: string            // Optional A1 notation range
}
```

**Example:**
```json
{
  "name": "readSheet",
  "arguments": {
    "spreadsheetId": "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms",
    "sheetName": "Sales Data",
    "range": "A1:D10"
  }
}
```

## File Type Handling

### Google Workspace Export Formats

| Source Type | Export Format | MIME Type |
|------------|---------------|-----------|
| Google Docs | Markdown | text/markdown |
| Google Sheets | CSV | text/csv |
| Google Slides | Plain Text | text/plain |
| Google Drawings | PNG | image/png |

### Binary File Handling
- Text files (`text/*`, `application/json`): Returned as UTF-8 text
- Binary files: Returned as base64-encoded blobs

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

Common errors:
- Authentication failures
- File not found
- Insufficient permissions
- API quota exceeded

## Planned API Additions

### File Management Tools
- `createFile`: Create new files/folders
- `updateFile`: Update file contents
- `uploadFile`: Upload local files
- `moveFile`: Move or rename files
- `deleteFile`: Move files to trash
- `shareFile`: Manage file permissions

### Enhanced Sheets Operations
- `updateSheet`: Update cell values using batchUpdate
- `appendSheet`: Append rows to a sheet
- `createSheet`: Create new sheets in a spreadsheet
- `formatSheet`: Apply formatting to cells
- `setFormulas`: Add formulas to cells

### Google Docs Operations
- `createDoc`: Create new documents
- `updateDoc`: Update document content
- `insertText`: Insert text at specific positions
- `replaceText`: Find and replace text
- `formatDoc`: Apply text formatting

### Google Forms Operations
- `createForm`: Create new forms
- `addQuestion`: Add questions to forms
- `updateQuestion`: Modify existing questions
- `listResponses`: Get form responses
- `exportResponses`: Export responses to Sheets

### Advanced Search
- Support for metadata filters
- Natural language query parsing
- Search result ranking
- Fuzzy matching

## Rate Limits and Quotas

Google Drive API has the following limits:
- 1,000,000,000 queries per day
- 1,000 queries per 100 seconds per user
- 10 queries per second per user

The server implements:
- Automatic retry with exponential backoff
- Request batching where possible
- Caching for frequently accessed resources

## WebSocket Events (Planned)

For real-time updates:
- `file.created`
- `file.updated`
- `file.deleted`
- `response.submitted` (Forms)

## Examples

### Complete Search and Read Flow
```javascript
// Search for files
const searchResult = await callTool({
  name: "search",
  arguments: { query: "project proposal" }
});

// Read specific file
const fileContent = await callTool({
  name: "read",
  arguments: { fileId: "1abc..." }
});

// List sheets if it's a spreadsheet
const sheets = await callTool({
  name: "listSheets",
  arguments: { spreadsheetId: "1abc..." }
});

// Read specific sheet data
const sheetData = await callTool({
  name: "readSheet",
  arguments: {
    spreadsheetId: "1abc...",
    sheetName: "Budget",
    range: "A1:E20"
  }
});
```

## Security Considerations

- OAuth tokens are stored locally and never transmitted
- All API calls use HTTPS
- File access respects Google Drive permissions
- No caching of sensitive file contents
- Audit logging for all operations (planned)