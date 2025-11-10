# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 🎓 Critical Reference: how2mcp Repository

**Location:** `/Users/ossieirondi/projects/scratch/how2mcp/`

This is the **definitive 2025 MCP implementation guide** and must be consulted for all architectural decisions. It contains:

### Key Resources
- **📚 MCP-DOCS/**: 10+ comprehensive guides covering 2025 best practices
  - `MCP_IMPLEMENTATION_GUIDE.md` - Complete technical reference
  - `MCP_ARCHITECTURE_2025.md` - Modern component layers and patterns
  - `MCP_ADVANCED_PATTERNS_2025.md` - Production patterns (caching, streaming, versioning)
  - `MCP_QUICK_REFERENCE.md` - Essential patterns and error codes

- **💻 MCP_EXAMPLE_PROJECT/**: Production-ready reference implementation
  - `src/tools/index.ts` - Shows proper operation-based tool architecture
  - Example: `calculator` tool with operations: `add`, `subtract`, `multiply`, `divide`
  - Example: `data-processor` tool with operations: `count`, `sort`, `unique`, `reverse`

### Architecture Pattern to Follow
The example project demonstrates **operation-based tools** (NOT individual tools per operation):
```typescript
// ✅ CORRECT: One tool with operations parameter
{
  name: "calculator",
  inputSchema: {
    properties: {
      operation: { enum: ["add", "subtract", "multiply", "divide"] },
      a: { type: "number" },
      b: { type: "number" }
    }
  }
}

// ❌ WRONG: Separate tool for each operation
{ name: "add", ... }
{ name: "subtract", ... }
{ name: "multiply", ... }
```

**CRITICAL:** Always reference how2mcp patterns when implementing new tools or refactoring existing ones. This ensures we follow 2025 best practices for MCP architecture.

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
- **BMAD Framework Integration** - Agent-driven development methodology for structured brownfield and greenfield projects

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
  - **Sheets Operations**: createSheet, renameSheet, deleteSheet, updateCells, updateCellsWithFormula, formatCells, addConditionalFormatting, freezeRowsColumns, setColumnWidth, appendRows
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

### Build Optimizations (Updated 2025-09-23)
Recent improvements to Docker builds:
- Test files excluded from Docker images via `.dockerignore` for cleaner, smaller builds
- TypeScript compilation excludes test files from production builds
- Optimized build process removes development dependencies from container images

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

## Recent Updates (September 2025)

### Google Forms API Improvements
- **Fixed addQuestion JSON payload error** - Resolved "Invalid JSON payload" issue when programmatically adding questions to forms
- **Enhanced type safety** - Improved QuestionItem interface structure to match Google Forms API expectations
- **Comprehensive test coverage** - Added 21 tests covering all question types for robust validation
- **Better error handling** - Enhanced debugging and error reporting for form operations

### Security Enhancements
- **Enhanced TokenManager validation** - Improved base key validation for better authentication security
- **Authentication hardening** - Additional security measures for credential management

### CI/CD Pipeline Improvements
- **ESLint compliance** - Resolved all ESLint violations blocking CI pipeline
- **GitHub Actions optimization** - Fixed ESM/CommonJS compatibility issues
- **Test infrastructure** - Improved Jest coverage thresholds and testing workflows

## Project Management
- When issues are completed, IMPORTANT you MUST mark them DONE! Using the linear MCP