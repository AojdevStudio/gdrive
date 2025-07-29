# Google Drive MCP Server Architecture

## Overview

The Google Drive MCP Server is built using TypeScript and implements the Model Context Protocol (MCP) to provide standardized access to Google Workspace services. The architecture follows a modular design pattern with clear separation of concerns.

## System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    MCP Client (Claude)                   │
└─────────────────────────────────────────────────────────┘
                            │
                            │ stdio/json-rpc
                            ▼
┌─────────────────────────────────────────────────────────┐
│                    MCP Server Layer                      │
│  ┌─────────────────────────────────────────────────┐   │
│  │              StdioServerTransport                │   │
│  └─────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────┐   │
│  │                 Request Handlers                 │   │
│  │  • ListResourcesRequestSchema                    │   │
│  │  • ReadResourceRequestSchema                     │   │
│  │  • ListToolsRequestSchema                       │   │
│  │  • CallToolRequestSchema                        │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│                   Service Layer                          │
│  ┌─────────────────────────────────────────────────┐   │
│  │            Google API Clients                    │   │
│  │  • drive (v3)                                   │   │
│  │  • sheets (v4)                                  │   │
│  │  • docs (v1) - planned                         │   │
│  │  • forms (v1) - planned                        │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│                 Google Workspace APIs                    │
└─────────────────────────────────────────────────────────┘
```

## Core Components

### 1. MCP Server (`index.ts`)
The main server implementation that:
- Initializes the MCP server with metadata
- Registers request handlers for MCP protocol
- Manages authentication and credentials
- Handles stdio transport for communication

### 2. Authentication Layer
- Uses `@google-cloud/local-auth` for OAuth flow
- Stores credentials locally in JSON format
- Supports multiple OAuth scopes for different APIs
- Implements token refresh automatically

### 3. Request Handlers

#### ListResourcesRequestSchema Handler
- Lists Google Drive files with pagination
- Transforms file metadata to MCP resource format
- Supports cursor-based pagination

#### ReadResourceRequestSchema Handler
- Reads file contents based on URI
- Handles format conversion for Google Workspace files
- Returns appropriate MIME types

#### ListToolsRequestSchema Handler
- Returns available tool definitions
- Provides JSON schema for tool inputs
- Describes tool functionality

#### CallToolRequestSchema Handler
- Executes specific tool operations
- Validates input parameters
- Returns formatted responses

### 4. Tools Implementation

#### Search Tool
```typescript
interface SearchTool {
  query: string;
  // Returns formatted list of matching files
}
```

#### Read Tool
```typescript
interface ReadTool {
  fileId: string;
  // Returns file contents in appropriate format
}
```

#### ListSheets Tool
```typescript
interface ListSheetsTool {
  spreadsheetId: string;
  // Returns list of sheets with metadata
}
```

#### ReadSheet Tool
```typescript
interface ReadSheetTool {
  spreadsheetId: string;
  sheetName: string;
  range?: string;
  // Returns formatted sheet data
}
```

## Data Flow

### 1. Request Processing
```
Client Request → StdioTransport → Server → Handler → Service → Google API
                                                           ↓
Client Response ← StdioTransport ← Server ← Handler ← Response Processing
```

### 2. Authentication Flow
```
First Run:
User → auth command → OAuth Browser Flow → Google Auth → Save Credentials

Subsequent Runs:
Load Credentials → Set OAuth Client → API Requests
```

### 3. File Reading Pipeline
```
File Request → Check MIME Type → 
  If Google Workspace → Export to readable format
  If Text → Return as UTF-8
  If Binary → Return as Base64
```

## File Structure

```
gdrive/
├── index.ts              # Main server implementation
├── package.json          # Dependencies and scripts
├── tsconfig.json         # TypeScript configuration
├── shared/
│   └── types.ts         # Shared type definitions (planned)
├── docs/
│   ├── API.md           # API documentation
│   ├── ARCHITECTURE.md  # This file
│   └── SETUP.md         # Setup instructions (planned)
├── dist/                # Compiled output
│   └── index.js         # Compiled server
└── tests/               # Test files (planned)
    ├── unit/
    └── integration/
```

## Planned Architecture Enhancements

### 1. Service Layer Abstraction
```typescript
interface DriveService {
  search(query: string): Promise<File[]>;
  read(fileId: string): Promise<FileContent>;
  create(file: FileMetadata): Promise<File>;
  update(fileId: string, content: any): Promise<File>;
}
```

### 2. Caching Layer
- Redis for search result caching
- In-memory LRU cache for file metadata
- Configurable TTL for different resource types

### 3. Error Handling Strategy
```typescript
class MCPError extends Error {
  constructor(
    public code: string,
    public message: string,
    public details?: any
  ) {
    super(message);
  }
}
```

### 4. Event System
- File change notifications
- Response submissions (Forms)
- Real-time collaboration updates

### 5. Plugin Architecture
```typescript
interface MCPPlugin {
  name: string;
  initialize(): Promise<void>;
  registerTools(): Tool[];
  registerHandlers(): Handler[];
}
```

## Performance Considerations

### Current Optimizations
- Selective field retrieval from Google APIs
- Streaming for large file downloads
- Pagination for list operations

### Planned Optimizations
- Request batching for multiple operations
- Connection pooling for API clients
- Parallel processing for independent requests
- Smart caching with invalidation strategies

## Security Architecture

### Authentication
- OAuth 2.0 with offline access
- Secure credential storage
- Automatic token refresh

### Authorization
- Respects Google Drive permissions
- Scope-based access control
- No elevation of privileges

### Data Protection
- No persistent storage of file contents
- Encrypted credential storage (planned)
- Audit logging (planned)

## Deployment Architecture

### Docker Container
```dockerfile
FROM node:20-slim
WORKDIR /app
COPY . .
RUN npm ci --production
CMD ["node", "dist/index.js"]
```

### Environment Configuration
- Credential path configuration
- API client configuration
- Logging level configuration

### Health Checks
- Credential validity check
- API connectivity check
- Resource availability check

## Monitoring and Observability (Planned)

### Metrics
- Request count and latency
- API quota usage
- Cache hit rates
- Error rates

### Logging
- Structured JSON logging
- Request/response logging
- Error tracking
- Performance metrics

### Tracing
- Distributed tracing support
- Request correlation IDs
- Performance bottleneck identification

## Extension Points

The architecture is designed to be extensible:

1. **New Tools**: Add to tools array and implement handler
2. **New APIs**: Add client initialization and handlers
3. **New Formats**: Add export format mappings
4. **New Transports**: Implement transport interface

## Best Practices

1. **Separation of Concerns**: Keep MCP protocol handling separate from business logic
2. **Error Boundaries**: Catch and transform all errors to MCP format
3. **Type Safety**: Use TypeScript interfaces for all data structures
4. **Async/Await**: Use modern async patterns throughout
5. **Dependency Injection**: Pass clients and configs as parameters