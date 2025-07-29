# Google Drive MCP Server

A Model Context Protocol (MCP) server that provides comprehensive integration with Google Drive, Sheets, Docs, and Forms. This server enables AI assistants to interact with Google Workspace through a standardized interface.

## Features

### Current Features (v0.6.3 - Phase 3+)
- **Automatic OAuth Token Refresh** ✅ 🆕
  - Eliminates manual re-authentication every hour
  - Proactive token refresh 10 minutes before expiry
  - Secure token persistence with AES-256-GCM encryption
  - Comprehensive audit trail for all token operations
  - Docker health checks for token status monitoring
  - Graceful error handling with automatic retry logic

- **Google Drive Integration**
  - List and search files/folders
  - Read file contents with automatic format conversion
  - Create new files and folders
  - Update existing file contents
  - Export Google Workspace files to readable formats
  
- **Google Sheets Support**
  - List sheets within spreadsheets
  - Read sheet contents with range support
  - Update cell values with A1 notation
  - Append rows to existing sheets
  - Export sheets as CSV

- **Google Forms Integration**
  - Create new forms with titles and descriptions
  - Add questions with multiple types (text, multiple choice, checkbox, etc.)
  - Retrieve form structure and metadata
  - List and analyze form responses
  - Support for various question types and validation

- **Enhanced Search**
  - Natural language query parsing
  - Smart query mappings (e.g., "spreadsheets modified this week")
  - Advanced filtering by MIME type, modification date, owner
  - Improved search result ranking and display

- **Docker Support**
  - Containerized deployment with Docker
  - Docker Compose configuration
  - Health checks and volume management

- **Google Docs Integration** ✅
  - Create new documents with title and content
  - Insert text at specific positions
  - Find and replace text content
  - Apply text formatting and styles
  - Insert tables with custom dimensions

- **Batch Operations** ✅
  - Process multiple files in single operations
  - Support for create, update, delete, and move operations
  - Efficient API usage with comprehensive error handling

- **Redis Caching & Performance** ✅
  - High-performance Redis caching for search results and file reads
  - Automatic cache invalidation on write operations
  - Performance monitoring with real-time statistics
  - Structured logging with Winston

### Planned Features (Phase 4 - See [PLAN.md](./PLAN.md))
- **Advanced Forms**: Quiz mode, validation rules, sections
- **Permissions Management**: Share files and manage access
- **Push Notifications**: Real-time updates for form responses

## Components

### Tools

#### Read Operations

- **search**
  - Search for files in Google Drive
  - Input: `query` (string): Search query
  - Returns file names and MIME types of matching files

- **read**
  - Read contents of a file from Google Drive
  - Input: `fileId` (string): The Google Drive file ID
  - Returns file contents in appropriate format

- **listSheets**
  - List all sheets within a Google Spreadsheet
  - Input: `spreadsheetId` (string): The spreadsheet ID
  - Returns list of sheet names and IDs

- **readSheet**
  - Read contents of a specific sheet
  - Inputs:
    - `spreadsheetId` (string): The spreadsheet ID
    - `sheetName` (string): Name of the sheet
    - `range` (string, optional): A1 notation range (e.g., 'A1:D10')
  - Returns formatted table of sheet contents

#### Write Operations

- **createFile**
  - Create a new file in Google Drive
  - Inputs:
    - `name` (string): Name of the file
    - `mimeType` (string): MIME type (e.g., 'text/plain')
    - `content` (string): File content
    - `parentFolderId` (string, optional): Parent folder ID
  - Returns created file ID and details

- **updateFile**
  - Update content of an existing file
  - Inputs:
    - `fileId` (string): ID of file to update
    - `content` (string): New content
    - `mimeType` (string, optional): Content MIME type
  - Returns update confirmation

- **createFolder**
  - Create a new folder in Google Drive
  - Inputs:
    - `name` (string): Folder name
    - `parentFolderId` (string, optional): Parent folder ID
  - Returns created folder ID

#### Sheets Operations

- **updateCells**
  - Update cells in a spreadsheet
  - Inputs:
    - `spreadsheetId` (string): Spreadsheet ID
    - `range` (string): A1 notation range (e.g., 'Sheet1!A1:B2')
    - `values` (array): 2D array of values
    - `valueInputOption` (string): 'RAW' or 'USER_ENTERED' (default)
  - Returns number of cells updated

- **appendRows**
  - Append rows to a spreadsheet
  - Inputs:
    - `spreadsheetId` (string): Spreadsheet ID
    - `range` (string): Sheet name or range to append to
    - `values` (array): 2D array of values
    - `valueInputOption` (string): 'RAW' or 'USER_ENTERED' (default)
  - Returns number of rows appended

#### Forms Operations

- **createForm**
  - Create a new Google Form
  - Inputs:
    - `title` (string): Title of the form
    - `description` (string, optional): Description of the form
  - Returns form ID and edit URL

- **getForm**
  - Retrieve form structure and metadata
  - Inputs:
    - `formId` (string): The Google Form ID
  - Returns form details including title, description, and question count

- **addQuestion**
  - Add a question to a Google Form
  - Inputs:
    - `formId` (string): The Google Form ID
    - `questionType` (string): Question type (TEXT, PARAGRAPH_TEXT, MULTIPLE_CHOICE, CHECKBOX, DROPDOWN, LINEAR_SCALE, DATE, TIME, FILE_UPLOAD)
    - `title` (string): Question text
    - `options` (array, optional): Options for choice questions
    - `required` (boolean, optional): Whether question is required
  - Returns confirmation with question details

- **listResponses**
  - List responses for a Google Form
  - Inputs:
    - `formId` (string): The Google Form ID
    - `pageSize` (number, optional): Max responses to return (1-5000, default 100)
  - Returns list of responses with timestamps and answer counts

#### Enhanced Search

- **enhancedSearch**
  - Natural language search with intelligent parsing
  - Inputs:
    - `query` (string): Natural language search query
    - `maxResults` (number, optional): Max results to return (1-100, default 10)
    - `filters` (object, optional): Additional filters for mimeType, modifiedAfter, owner
  - Supports queries like:
    - "spreadsheets modified this week"
    - "forms about customer feedback"
    - "documents shared with me"
  - Returns enhanced search results with detailed file information

### Resources

The server provides access to Google Drive files:

- **Files** (`gdrive:///<file_id>`)
  - Supports all file types
  - Google Workspace files are automatically exported:
    - Docs → Markdown
    - Sheets → CSV
    - Presentations → Plain text
    - Drawings → PNG
  - Other files are provided in their native format

## Getting Started

### Prerequisites

1. [Create a new Google Cloud project](https://console.cloud.google.com/projectcreate)
2. [Enable the Google Drive API](https://console.cloud.google.com/workspace-api/products)
3. [Configure an OAuth consent screen](https://console.cloud.google.com/apis/credentials/consent) ("internal" is fine for testing)
4. Add OAuth scope `https://www.googleapis.com/auth/drive`
5. [Create an OAuth Client ID](https://console.cloud.google.com/apis/credentials/oauthclient) for application type "Desktop App"
6. Download the JSON file of your client's OAuth keys
7. Rename the key file to `gcp-oauth.keys.json` and place into the credentials directory

### Setup

1. Clone the repository and install dependencies:
```bash
npm install
npm run build
```

2. Create a `.env` file based on `.env.example`:
```bash
# Generate a secure encryption key
openssl rand -base64 32

# Add the key to your .env file
echo "GDRIVE_TOKEN_ENCRYPTION_KEY=<your-generated-key>" > .env
```

### Authentication

With the new automatic token refresh feature, you only need to authenticate once:

#### Local Development
```bash
# Set encryption key
export GDRIVE_TOKEN_ENCRYPTION_KEY="your-base64-key"

# Run initial authentication
node ./dist/index.js auth

# The server will now automatically refresh tokens as needed
node ./dist/index.js
```

#### Docker
```bash
# Create credentials directory
mkdir -p credentials

# Copy your OAuth keys
cp /path/to/gcp-oauth.keys.json credentials/

# Set encryption key in .env
echo "GDRIVE_TOKEN_ENCRYPTION_KEY=$(openssl rand -base64 32)" > .env

# Run authentication
docker-compose run --rm gdrive-mcp-auth node dist/index.js auth

# Start the server (tokens will auto-refresh)
docker-compose up -d
```

### Health Monitoring

The server includes health checks for monitoring token status:

```bash
# Check health status
node ./dist/index.js health

# With Docker
docker-compose exec gdrive-mcp node dist/index.js health
```

Health states:
- **HEALTHY**: Token valid and refresh capability available
- **DEGRADED**: Token expiring soon but refresh in progress
- **UNHEALTHY**: Token expired or no refresh capability

### Usage with Claude Desktop

Add the following to your Claude Desktop configuration:

#### Local Installation
```json
{
  "mcpServers": {
    "gdrive": {
      "command": "node",
      "args": ["/path/to/gdrive-mcp/dist/index.js"],
      "env": {
        "GDRIVE_TOKEN_ENCRYPTION_KEY": "your-base64-key"
      }
    }
  }
}
```

#### Docker
```json
{
  "mcpServers": {
    "gdrive": {
      "command": "docker",
      "args": [
        "run", "-i", "--rm",
        "--env-file", "/path/to/.env",
        "-v", "gdrive-credentials:/credentials:ro",
        "gdrive-mcp-server"
      ]
    }
  }
}
```

## Security Features

### Token Encryption
- All tokens are encrypted at rest using AES-256-GCM
- Encryption keys are stored separately from encrypted data
- File permissions are set to 0600 (owner read/write only)

### Audit Trail
All token operations are logged for security forensics:
- TOKEN_ACQUIRED - Initial authentication
- TOKEN_REFRESHED - Successful refresh
- TOKEN_REFRESH_FAILED - Failed refresh attempts
- TOKEN_DELETED_INVALID_GRANT - Invalid token cleanup
- TOKEN_ENCRYPTED/DECRYPTED - Encryption operations

### Error Handling
- Invalid grant errors trigger immediate token deletion
- Automatic retry with exponential backoff for temporary failures
- Clear user guidance for re-authentication when needed

## Configuration

See `.env.example` for all available configuration options:

- `GDRIVE_TOKEN_ENCRYPTION_KEY` - **Required**: 32-byte base64 encryption key
- `GDRIVE_TOKEN_REFRESH_INTERVAL` - Token check interval (default: 30 minutes)
- `GDRIVE_TOKEN_PREEMPTIVE_REFRESH` - Refresh buffer time (default: 10 minutes)
- `GDRIVE_TOKEN_MAX_RETRIES` - Max refresh retry attempts (default: 3)
- `LOG_LEVEL` - Logging verbosity (error, warn, info, debug)
- `REDIS_URL` - Redis connection URL for caching

## Troubleshooting

### Token Refresh Issues
1. Check health status: `node dist/index.js health`
2. Verify encryption key is set correctly
3. Check audit logs for detailed error information
4. Ensure OAuth app has offline access scope

### Re-authentication Required
If you see "invalid_grant" errors:
1. Delete the token file
2. Run `node dist/index.js auth` again
3. Complete the OAuth flow

### Docker Health Check Failures
1. Check container logs: `docker-compose logs gdrive-mcp`
2. Verify credentials are mounted correctly
3. Ensure encryption key is passed via environment

## License

This MCP server is licensed under the MIT License. This means you are free to use, modify, and distribute the software, subject to the terms and conditions of the MIT License. For more details, please see the LICENSE file in the project repository.