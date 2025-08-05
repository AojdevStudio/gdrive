# Technology Stack

## Overview
The Google Drive MCP Server is built on a modern TypeScript stack with enterprise-grade tooling for production deployment. This document details all technologies, versions, and configurations used in the project.

## Core Technologies

### Runtime & Language
- **Node.js**: v20+ (required for ES2022 support)
  - Using ES modules (`"type": "module"` in package.json)
  - Native async/await and modern JavaScript features
- **TypeScript**: v5.6.2
  - Target: ES2022
  - Strict mode enabled
  - ES module output with source maps

### MCP Framework
- **@modelcontextprotocol/sdk**: v1.0.1
  - StdioServerTransport for JSON-RPC communication
  - Built-in request/response schemas
  - Error handling and validation

## Google API Integration

### Google Cloud Libraries
- **@google-cloud/local-auth**: v3.0.1
  - OAuth 2.0 authentication flow
  - Local development authorization
  - Token management integration

- **googleapis**: v144.0.0
  - Google Drive API v3
  - Google Sheets API v4
  - Google Docs API v1
  - Google Forms API v1
  - Google Apps Script API v1

### OAuth Scopes
```javascript
const SCOPES = [
  "https://www.googleapis.com/auth/drive",
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/documents",
  "https://www.googleapis.com/auth/forms",
  "https://www.googleapis.com/auth/script.projects.readonly"
];
```

## Infrastructure Dependencies

### Caching
- **Redis**: v5.6.1 (client library)
  - Redis Server: v7-alpine (Docker)
  - Connection: `redis://localhost:6379`
  - Default TTL: 5 minutes
  - Pattern-based invalidation

### Logging
- **Winston**: v3.17.0
  - Structured JSON logging
  - Multiple transports (file, console)
  - Log rotation (5MB files, max 5)
  - Level-based filtering

## Development Dependencies

### Build Tools
- **TypeScript**: v5.6.2 (compiler)
- **shx**: v0.3.4 (cross-platform shell commands)
  - Used for chmod in build scripts

### Testing Framework
- **Jest**: v29.7.0
  - **ts-jest**: v29.1.2 (TypeScript support)
  - **@types/jest**: v29.5.12
  - **@jest/globals**: v29.7.0
  - Configured for unit, integration, and e2e tests

### Type Definitions
- **@types/node**: v22 (Node.js type definitions)

## Container & Deployment

### Docker
- **Base Image**: node:20-slim
- **Multi-stage Build**: Yes
- **Health Checks**: Built-in
- **Volumes**:
  - `/credentials` (read-only)
  - `/data` (persistent)
  - `/app/logs` (log persistence)

### Docker Compose
- **Version**: 3.8
- **Services**:
  - gdrive-mcp (main server)
  - redis (caching layer)
- **Networks**: Bridge network (mcp-network)
- **Restart Policy**: unless-stopped

## Configuration Management

### Environment Variables
```bash
# Core Configuration
NODE_ENV=production|development
LOG_LEVEL=silent|error|warn|info|debug

# Authentication
GDRIVE_CREDENTIALS_PATH=/credentials/.gdrive-server-credentials.json
GDRIVE_OAUTH_PATH=/credentials/gcp-oauth.keys.json
GDRIVE_TOKEN_STORAGE_PATH=/credentials/.gdrive-mcp-tokens.json
GDRIVE_TOKEN_ENCRYPTION_KEY=<base64-encoded-32-byte-key>

# Performance
REDIS_URL=redis://localhost:6379
GDRIVE_TOKEN_REFRESH_INTERVAL=1800000  # 30 minutes
GDRIVE_TOKEN_PREEMPTIVE_REFRESH=600000 # 10 minutes
GDRIVE_TOKEN_MAX_RETRIES=3
GDRIVE_TOKEN_RETRY_DELAY=1000

# Monitoring
GDRIVE_TOKEN_HEALTH_CHECK=true
GDRIVE_TOKEN_AUDIT_LOG_PATH=/app/logs/gdrive-mcp-audit.log
```

## Build Configuration

### TypeScript Compiler Options
```json
{
  "target": "ES2022",
  "module": "ES2022",
  "moduleResolution": "node",
  "strict": true,
  "esModuleInterop": true,
  "declaration": true,
  "sourceMap": true
}
```

### Package Scripts
- `build`: Compile TypeScript and set executable permissions
- `watch`: Development mode with auto-recompilation
- `test`: Run all tests
- `test:coverage`: Generate coverage reports
- `lint`: ESLint code analysis
- `type-check`: TypeScript type validation

## API Versions & Compatibility

### Google Workspace APIs
| Service | API Version | Features Used |
|---------|-------------|---------------|
| Drive | v3 | Files, folders, search, export |
| Sheets | v4 | Read, write, append, batch operations |
| Docs | v1 | Create, insert, replace, style, tables |
| Forms | v1 | Create, questions, responses |
| Apps Script | v1 | Read-only project access |

### MCP Protocol
- **Version**: 0.6.2
- **Transport**: stdio (JSON-RPC)
- **Handlers**: 4 (resources, tools, list tools, call tool)

## Security Technologies

### Encryption
- **Algorithm**: AES-256-GCM
- **Token Storage**: Encrypted JSON file
- **Key Management**: Environment variable based

### Authentication
- **OAuth 2.0**: Google's implementation
- **Refresh Tokens**: Offline access enabled
- **Token Monitoring**: 30-minute intervals
- **Preemptive Refresh**: 10-minute buffer

## Performance Technologies

### Caching Strategy
- **Redis**: In-memory data store
- **Serialization**: JSON stringify/parse
- **Key Patterns**:
  - `resources:*` (file listings)
  - `search:*` (search results)
  - `read:{fileId}` (file content)
  - `sheet:{id}:*` (spreadsheet data)

### Monitoring
- **Performance Tracking**: Custom implementation
- **Metrics Collection**: 30-second intervals
- **Health Checks**: 5-minute intervals
- **Memory Monitoring**: Built-in Node.js APIs

## File Format Support

### Export Formats
| Google Format | Export Format | MIME Type |
|---------------|---------------|-----------|
| Google Docs | Markdown | text/markdown |
| Google Sheets | CSV | text/csv |
| Google Slides | Plain Text | text/plain |
| Google Drawings | PNG | image/png |
| Text Files | UTF-8 | text/plain |
| Binary Files | Base64 | application/octet-stream |

## Development Environment

### Recommended Setup
- **Node.js**: v20+ (LTS recommended)
- **npm**: v10+ (comes with Node.js)
- **Docker**: v24+ (for containerized deployment)
- **Docker Compose**: v2.20+ (for multi-service setup)
- **Redis**: v7+ (for local development)

### IDE Support
- **TypeScript**: Full IntelliSense support
- **ESLint**: Code quality enforcement
- **Source Maps**: Debugging support
- **Jest**: Test runner integration

## Version Management

### Semantic Versioning
- Current Version: 0.6.2
- Following semver principles
- Breaking changes in major versions only

### Dependency Updates
- Regular security updates
- Compatibility testing before major updates
- Lock file maintained (package-lock.json)

## Known Limitations

### API Rate Limits
- Google Drive: 1,000 requests per 100 seconds
- Google Sheets: 100 requests per 100 seconds
- No custom rate limiting implementation

### File Size Limits
- Google Docs export: 10MB
- Google Sheets export: 5 million cells
- Binary file encoding: Memory dependent

### Concurrency
- Single-threaded Node.js process
- No worker threads implementation
- Async I/O for non-blocking operations