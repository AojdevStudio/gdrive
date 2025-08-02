# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Model Context Protocol (MCP) server for Google Drive integration. It provides:
- Full read/write access to Google Drive files and folders
- Resource access to Google Drive files via `gdrive:///<file_id>` URIs
- Tools for searching, reading, creating, and updating files
- Comprehensive Google Sheets operations (read, update, append)
- Google Forms creation and management with question types
- **Google Docs API integration** - Create documents, insert text, replace text, apply formatting, insert tables
- **Batch file operations** - Process multiple files in a single operation (create, update, delete, move)
- Enhanced search with natural language parsing
- Forms response handling and analysis
- **Redis caching infrastructure** - High-performance caching for improved response times
- **Performance monitoring and logging** - Structured logging with Winston and comprehensive performance metrics
- Automatic export of Google Workspace files to readable formats
- Docker support for containerized deployment with Redis

## Key Commands

### Build & Development
- `npm run build` - Compile TypeScript to JavaScript in dist/ folder
- `npm run watch` - Watch mode for development (auto-rebuild on changes)
- `npm run prepare` - Runs build automatically (used by npm install)

### Authentication
- `node ./dist/index.js auth` - Run authentication flow to get Google Drive credentials
- Requires `gcp-oauth.keys.json` file in project root
- Saves credentials to `.gdrive-server-credentials.json`

### Server Usage
- `node ./dist/index.js` - Start the MCP server (requires authentication first)
- Server runs on stdio transport for MCP communication

### Changelog
- `./scripts/changelog/update-changelog.py --auto` - update change log by running script to analyze git commits. 

## Architecture

### Core Components
- **index.ts** - Main server implementation with MCP SDK
- **Authentication** - Uses Google Cloud local auth with OAuth2
- **Drive API Integration** - Google Drive v3 API for file operations
- **Sheets API Integration** - Google Sheets v4 API for spreadsheet operations
- **Forms API Integration** - Google Forms v1 API for form creation and management
- **Docs API Integration** - Google Docs v1 API for document manipulation
- **Redis Cache Manager** - High-performance caching with automatic invalidation
- **Performance Monitor** - Real-time performance tracking and statistics
- **Winston Logger** - Structured logging with file rotation and console output

### MCP Implementation
- **Resources**: Lists and reads Google Drive files
- **Tools**: 
  - **Read Operations**: search, read, listSheets, readSheet
  - **Write Operations**: createFile, updateFile, createFolder
  - **Sheets Operations**: updateCells, appendRows
  - **Forms Operations**: createForm, getForm, addQuestion, listResponses
  - **Docs Operations**: createDocument, insertText, replaceText, applyTextStyle, insertTable
  - **Batch Operations**: batchFileOperations (create, update, delete, move multiple files)
  - **Enhanced Search**: enhancedSearch with natural language parsing
- **Transport**: StdioServerTransport for MCP communication

### File Type Handling
- Google Docs → Exported as Markdown
- Google Sheets → Exported as CSV
- Google Presentations → Exported as Plain text
- Google Drawings → Exported as PNG
- Text files → Direct text content
- Binary files → Base64 encoded blob

## Environment Variables
- `GDRIVE_CREDENTIALS_PATH` - Path to credentials file (default: `../../../.gdrive-server-credentials.json`)
- `GDRIVE_OAUTH_PATH` - Path to OAuth keys file (default: `../../../gcp-oauth.keys.json`)
- `REDIS_URL` - Redis connection URL for caching (default: `redis://localhost:6379`)
- `LOG_LEVEL` - Winston logging level (default: `info`)
- `NODE_ENV` - Environment mode (default: `development`)

## Docker Usage

### Authentication Setup (Required First)
Authentication must be performed on the host machine before running Docker:

```bash
# 1. Ensure OAuth keys are in place
cp /path/to/gcp-oauth.keys.json credentials/

# 2. Run authentication on host (opens browser)
./scripts/auth.sh

# 3. Verify credentials were created
ls -la credentials/
# Should see: .gdrive-server-credentials.json and .gdrive-mcp-tokens.json
```

### Building and Running with Docker
```bash
# Build the Docker image
docker build -t gdrive-mcp-server .

# Run with Docker Compose (includes Redis) - RECOMMENDED
docker-compose up -d

# Run standalone with Docker (without Redis caching)
docker run -i --rm \
  -v ${PWD}/credentials:/credentials:ro \
  -v ${PWD}/data:/data \
  -v ${PWD}/logs:/app/logs \
  --env-file .env \
  gdrive-mcp-server
```

### Claude Desktop Docker Integration
Add to your Claude Desktop configuration:
```json
{
  "mcpServers": {
    "gdrive": {
      "command": "docker",
      "args": [
        "run", "-i", "--rm", "--init",
        "-v", "/path/to/gdrive-mcp/credentials:/credentials:ro",
        "-v", "/path/to/gdrive-mcp/data:/data",
        "-v", "/path/to/gdrive-mcp/logs:/app/logs",
        "--env-file", "/path/to/gdrive-mcp/.env",
        "gdrive-mcp-server"
      ]
    }
  }
}
```

For full functionality with Redis caching, use Docker Compose instead:
```bash
docker-compose up -d
```

## Performance & Monitoring Features

### Redis Caching
- Automatic caching of search results and file reads
- 5-minute TTL for cached data
- Cache invalidation on write operations
- Graceful fallback when Redis is unavailable

### Performance Monitoring
- Real-time operation timing and statistics
- Memory usage tracking
- Cache hit/miss ratios
- Performance metrics logged every 30 seconds

### Structured Logging
- Winston-based logging with configurable levels
- File rotation for log management
- Separate error and combined log files
- Console output for development

### Batch Operations
- Process multiple files in a single operation
- Supports create, update, delete, and move operations
- Optimized for efficiency and reduced API calls
- Comprehensive error handling per operation

## Development Notes
- Uses TypeScript with ES modules (ES2022 target)
- Standalone tsconfig.json with modern JavaScript features
- Output compiled to `dist/` directory
- Executable shebang added to compiled files via shx
- Build requirements: Node.js 18+ for ES2022 support
- Redis optional but recommended for optimal performance