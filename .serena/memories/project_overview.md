# Google Drive MCP Server - Project Overview

## Project Purpose
- Model Context Protocol (MCP) server for comprehensive Google Workspace integration
- Provides read/write access to Google Drive, Sheets, Docs, Forms, and Apps Script
- Enables AI assistants to interact with Google services through standardized interface

## Tech Stack
- **Language**: TypeScript (ES2022, compiled to JavaScript)
- **Runtime**: Node.js 18+
- **Build System**: TypeScript compiler + shx for executable permissions
- **Testing**: Jest with comprehensive test coverage
- **Authentication**: Google Cloud OAuth2 + local-auth library
- **APIs**: Google Drive v3, Sheets v4, Forms v1, Docs v1, Apps Script
- **Caching**: Redis (optional but recommended)
- **Logging**: Winston with structured logging
- **Containerization**: Docker with multi-stage builds

## Code Architecture
- **Main Entry Point**: index.ts - Main server implementation with MCP SDK
- **Authentication**: OAuth2 with automatic token refresh and key rotation
- **API Integrations**: Direct Google API client usage with error handling
- **Performance**: Redis caching, performance monitoring, batch operations
- **Security**: AES-256-GCM encryption, PBKDF2 key derivation, timing-safe operations

## Key Commands
- `npm run build` - Compile TypeScript to dist/ folder
- `npm run watch` - Development watch mode
- `npm test` - Run Jest test suite
- `npm run lint` - ESLint validation
- `npm run type-check` - TypeScript type checking
- `node ./dist/index.js auth` - Authentication flow
- `node ./dist/index.js` - Start MCP server

## Current Google Sheets Operations
- **listSheets**: List all sheets in a spreadsheet
- **readSheet**: Read data from specific sheet/range
- **updateCells**: Update cells in specified range
- **appendRows**: Append data rows to sheet

## File Structure
- `index.ts` - Main server with all MCP tool implementations
- `src/__tests__/` - Comprehensive test suites
- `scripts/` - Utility scripts and migrations
- `docs/` - Documentation and guides
- `.bmad-core/` - BMAD framework for agent-driven development