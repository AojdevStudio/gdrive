# Google Drive MCP Server API Documentation

## Overview

The Google Drive MCP Server implements the Model Context Protocol to provide standardized access to Google Workspace services. This document details the available APIs, their parameters, and usage examples.

## Authentication

The server uses OAuth 2.0 for authentication with Google APIs, featuring **enterprise-grade token security** with versioned encryption and automatic key rotation.

### Required Scopes
- `https://www.googleapis.com/auth/drive.file` - Full Drive access
- `https://www.googleapis.com/auth/spreadsheets` - Sheets read/write
- `https://www.googleapis.com/auth/documents` - Docs read/write  
- `https://www.googleapis.com/auth/forms` - Forms creation/management
- `https://www.googleapis.com/auth/script.projects.readonly` - Apps Script access

### Token Security Architecture

#### TokenManager Interface
The `TokenManager` class provides secure, versioned token storage with the following key methods:

```typescript
export interface TokenData {
  access_token: string;
  refresh_token: string;
  expiry_date: number;
  token_type: string;
  scope: string;
}

export interface VersionedTokenStorage {
  version: string;           // Key version (v1, v2, etc.)
  algorithm: string;         // Encryption algorithm (aes-256-gcm)
  keyDerivation: {
    method: 'pbkdf2';
    iterations: number;      // Min 100,000 iterations
    salt: string;           // Unique salt per token
  };
  data: string;             // Encrypted token data
  createdAt: string;        // ISO timestamp
  keyId: string;           // Key identifier
}

// Main TokenManager methods
class TokenManager {
  static getInstance(logger: Logger): TokenManager
  async getTokens(): Promise<TokenData | null>
  async storeTokens(tokens: TokenData): Promise<void>
  async deleteTokens(): Promise<void>
  async rotateEncryptionKey(): Promise<void>
}
```

#### KeyRotationManager Interface
The `KeyRotationManager` handles encryption key lifecycle:

```typescript
export interface KeyMetadata {
  version: string;          // Key version identifier
  algorithm: string;        // Always 'aes-256-gcm'
  createdAt: string;       // ISO timestamp
  iterations: number;      // PBKDF2 iterations (min 100,000)
  salt: string;           // Base64 salt for key derivation
}

export interface RegisteredKey {
  version: string;
  key: Buffer;             // 32-byte encryption key
  metadata: KeyMetadata;
}

// Main KeyRotationManager methods
class KeyRotationManager {
  static getInstance(logger: Logger): KeyRotationManager
  registerKey(version: string, key: Buffer, metadata: KeyMetadata): void
  getKey(version: string): RegisteredKey | undefined
  getCurrentKey(): RegisteredKey
  setCurrentVersion(version: string): void
  getVersions(): string[]
  getKeyMetadata(version: string): KeyMetadata | undefined
  hasVersion(version: string): boolean
  clearKeys(): void
}
```

### Security Features
- **AES-256-GCM Encryption**: All tokens encrypted with authenticated encryption
- **PBKDF2 Key Derivation**: Minimum 100,000 iterations for key strengthening
- **Versioned Keys**: Support for key rotation without data loss
- **Memory Protection**: Automatic key clearing and secure disposal
- **Audit Trail**: Comprehensive logging of all authentication events

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

### Token Security
- **AES-256-GCM Encryption**: All OAuth tokens encrypted at rest with authenticated encryption
- **PBKDF2 Key Derivation**: Keys strengthened with minimum 100,000 iterations
- **Versioned Encryption**: Support for seamless key rotation without data loss
- **Memory Protection**: Encryption keys automatically cleared from memory
- **Local Storage Only**: Tokens never transmitted over network

### API Security
- All API calls use HTTPS with certificate validation
- File access strictly respects Google Drive permissions and sharing settings
- No caching of sensitive file contents in persistent storage
- Rate limiting and quota management to prevent API abuse

### Audit & Monitoring
- **Comprehensive Audit Trail**: All authentication events logged with timestamps
- **Health Monitoring**: Real-time token validity and system health checks
- **Security Events**: Key rotation, token refresh, and failure events tracked
- **Structured Logging**: Winston-based logging with configurable levels

### Data Protection
- **Zero Knowledge**: Server cannot decrypt tokens without proper environment keys
- **Backup Security**: Token backups encrypted with same security standards
- **Graceful Degradation**: System continues operating if Redis cache unavailable
- **Automatic Cleanup**: Temporary files and sensitive data automatically purged