# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Model Context Protocol (MCP) server for Google Drive integration. It provides:
- Resource access to Google Drive files via `gdrive:///<file_id>` URIs
- Tools for searching, reading files, and working with Google Sheets
- Automatic export of Google Workspace files to readable formats

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

## Architecture

### Core Components
- **index.ts** - Main server implementation with MCP SDK
- **Authentication** - Uses Google Cloud local auth with OAuth2
- **Drive API Integration** - Google Drive v3 API for file operations
- **Sheets API Integration** - Google Sheets v4 API for spreadsheet operations

### MCP Implementation
- **Resources**: Lists and reads Google Drive files
- **Tools**: search, read, listSheets, readSheet
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

## Development Notes
- Uses TypeScript with ES modules (ES2022 target)
- Standalone tsconfig.json with modern JavaScript features
- Output compiled to `dist/` directory
- Executable shebang added to compiled files via shx
- Build requirements: Node.js 18+ for ES2022 support