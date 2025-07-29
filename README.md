# Google Drive MCP Server

A Model Context Protocol (MCP) server that provides comprehensive integration with Google Drive, Sheets, Docs, and Forms. This server enables AI assistants to interact with Google Workspace through a standardized interface.

## Features

### Current Features (v0.6.2 - Phase 3)
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

- **Google Apps Script Viewing** ✅
  - View source code of Apps Script projects
  - Read-only access to script contents
  - Support for all script file types (JS, HTML, JSON)
  - Automatic syntax highlighting in responses
  - Redis caching for frequently accessed scripts

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

#### Apps Script Operations

- **getAppScript**
  - Retrieve Google Apps Script code by script ID
  - Inputs:
    - `scriptId` (string): The Google Apps Script project ID
  - Returns formatted script content with all files and their source code
  - Supports automatic syntax highlighting for JavaScript and HTML files
  - Includes Redis caching for improved performance
  - Error handling for:
    - Script not found (404)
    - Permission denied (403)
    - API quota exceeded (429)

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

## Getting started

1. [Create a new Google Cloud project](https://console.cloud.google.com/projectcreate)
2. Enable the following APIs in your Google Cloud project:
   - [Google Drive API](https://console.cloud.google.com/apis/library/drive.googleapis.com)
   - [Google Sheets API](https://console.cloud.google.com/apis/library/sheets.googleapis.com)
   - [Google Docs API](https://console.cloud.google.com/apis/library/docs.googleapis.com)
   - [Google Forms API](https://console.cloud.google.com/apis/library/forms.googleapis.com)
   - [Google Apps Script API](https://console.cloud.google.com/apis/library/script.googleapis.com)
3. [Configure an OAuth consent screen](https://console.cloud.google.com/apis/credentials/consent) ("internal" is fine for testing)
4. Add OAuth scopes:
   - `https://www.googleapis.com/auth/drive`
   - `https://www.googleapis.com/auth/spreadsheets`
   - `https://www.googleapis.com/auth/documents`
   - `https://www.googleapis.com/auth/forms`
   - `https://www.googleapis.com/auth/script.projects.readonly`
5. [Create an OAuth Client ID](https://console.cloud.google.com/apis/credentials/oauthclient) for application type "Desktop App"
6. Download the JSON file of your client's OAuth keys
7. Rename the key file to `gcp-oauth.keys.json` and place into the root of this repo (i.e. `servers/gcp-oauth.keys.json`)

Make sure to build the server with either `npm run build` or `npm run watch`.

### Authentication

To authenticate and save credentials:

1. Run the server with the `auth` argument: `node ./dist auth`
2. This will open an authentication flow in your system browser
3. Complete the authentication process
4. Credentials will be saved in the root of this repo (i.e. `servers/.gdrive-server-credentials.json`)

### Usage with Desktop App

To integrate this server with the desktop app, add the following to your app's server configuration:

#### Docker

Authentication:

Assuming you have completed setting up the OAuth application on Google Cloud, you can now auth the server with the following command, replacing `/path/to/gcp-oauth.keys.json` with the path to your OAuth keys file:

```bash
docker run -i --rm --mount type=bind,source=/path/to/gcp-oauth.keys.json,target=/gcp-oauth.keys.json -v mcp-gdrive:/gdrive-server -e GDRIVE_OAUTH_PATH=/gcp-oauth.keys.json -e "GDRIVE_CREDENTIALS_PATH=/gdrive-server/credentials.json" -p 3000:3000 mcp/gdrive auth
```

The command will print the URL to open in your browser. Open this URL in your browser and complete the authentication process. The credentials will be saved in the `mcp-gdrive` volume.

Once authenticated, you can use the server in your app's server configuration:

```json
{
  "mcpServers": {
    "gdrive": {
      "command": "docker",
      "args": ["run", "-i", "--rm", "-v", "mcp-gdrive:/gdrive-server", "-e", "GDRIVE_CREDENTIALS_PATH=/gdrive-server/credentials.json", "mcp/gdrive"]
    }
  }
}
```

#### NPX

```json
{
  "mcpServers": {
    "gdrive": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-gdrive"
      ]
    }
  }
}
```

## License

This MCP server is licensed under the MIT License. This means you are free to use, modify, and distribute the software, subject to the terms and conditions of the MIT License. For more details, please see the LICENSE file in the project repository.
