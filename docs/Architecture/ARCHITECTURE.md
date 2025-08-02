# Google Drive MCP Server Architecture

## Overview

The Google Drive MCP Server is a production-ready TypeScript implementation of the Model Context Protocol (MCP) that provides comprehensive access to Google Workspace services. The architecture follows enterprise-grade patterns with robust authentication, caching, monitoring, and Docker support.

## System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                 MCP Client (Claude)                     │
└─────────────────────────────────────────────────────────┘
                            │
                   stdio transport / JSON-RPC
                            ▼
┌─────────────────────────────────────────────────────────┐
│                    MCP Server Layer                      │
│  ┌─────────────────────────────────────────────────┐   │
│  │           StdioServerTransport                   │   │
│  │        • JSON-RPC message handling               │   │
│  │        • Request/response coordination           │   │
│  └─────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────┐   │
│  │              Request Handlers                    │   │
│  │  • ListResourcesRequestSchema (gdrive:///)      │   │
│  │  • ReadResourceRequestSchema (file content)     │   │
│  │  │  • ListToolsRequestSchema (22 tools)           │   │
│  │  • CallToolRequestSchema (tool execution)       │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│                 Infrastructure Layer                     │
│  ┌─────────────────┐ ┌─────────────────┐ ┌──────────┐  │
│  │  Redis Cache    │ │ Winston Logger  │ │ Health   │  │
│  │  • 5min TTL     │ │ • Structured    │ │ Monitor  │  │
│  │  • Auto expire  │ │ • File rotation │ │ • Status │  │
│  │  • Hit/miss     │ │ • Level config  │ │ • Metrics│  │
│  └─────────────────┘ └─────────────────┘ └──────────┘  │
│  ┌─────────────────────────────────────────────────┐   │
│  │            Performance Monitor                   │   │
│  │  • Operation timing • Memory tracking           │   │
│  │  • Cache metrics   • Error rates               │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│                Authentication Layer                      │
│  ┌─────────────────┐ ┌─────────────────────────────┐   │
│  │   AuthManager   │ │        TokenManager         │   │
│  │  • OAuth2 flow  │ │  • Encrypted storage        │   │
│  │  • State mgmt   │ │  • Auto-refresh             │   │
│  │  • Token mon.   │ │  • Expiry detection         │   │
│  └─────────────────┘ └─────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│                   Google API Layer                       │
│  ┌─────────────────────────────────────────────────┐   │
│  │            Google API Clients                    │   │
│  │  • drive (v3)    - Files, folders, search       │   │
│  │  • sheets (v4)   - Spreadsheet operations       │   │
│  │  • docs (v1)     - Document creation/editing    │   │
│  │  • forms (v1)    - Form creation/responses      │   │
│  │  • script (v1)   - Apps Script projects        │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│              Google Workspace APIs                       │
│  • OAuth 2.0 Authentication                             │
│  • RESTful API endpoints                                 │
│  • Rate limiting and quotas                              │
└─────────────────────────────────────────────────────────┘
```

## Core Components

### 1. MCP Server Core (`index.ts`)
The main server implementation featuring:
- **Server Initialization**: MCP SDK server with version 0.6.2 metadata
- **Transport Layer**: StdioServerTransport for JSON-RPC communication
- **Request Routing**: Four main MCP request handlers with comprehensive error handling
- **Performance Monitoring**: Real-time metrics collection and logging every 30 seconds
- **Natural Language Processing**: Enhanced search query parsing for intuitive file discovery

### 2. Authentication Architecture

#### AuthManager (`src/auth/AuthManager.ts`)
- **OAuth2 Management**: Complete OAuth 2.0 flow with Google Cloud integration
- **State Management**: Comprehensive auth states (authenticated, expired, failed, revoked)
- **Token Monitoring**: Proactive token refresh with configurable intervals (default: 30min)
- **Retry Logic**: Exponential backoff with rate limit handling
- **Error Recovery**: Graceful handling of invalid grants and token revocation

#### TokenManager (`src/auth/TokenManager.ts`)
- **Encrypted Storage**: AES-256-GCM token encryption with configurable keys
- **Automatic Refresh**: Preemptive token refresh (default: 10min before expiry)
- **Audit Logging**: Comprehensive token lifecycle logging
- **Validation**: Token integrity and expiry validation
- **Secure Cleanup**: Safe token deletion on authentication failures

### 3. Caching Infrastructure

#### Redis Cache Manager
- **High Performance**: Redis-based caching with 5-minute TTL
- **Intelligent Invalidation**: Automatic cache invalidation on write operations
- **Graceful Fallback**: Continues operation when Redis is unavailable
- **Hit/Miss Tracking**: Performance metrics for cache optimization
- **Connection Management**: Auto-reconnection with exponential backoff

### 4. Request Handlers

#### ListResourcesRequestSchema Handler
- **Resource Discovery**: Lists Google Drive files as `gdrive:///` URI resources
- **Metadata Enrichment**: File names, MIME types, and web view links
- **Caching Integration**: Cached resource lists for improved performance
- **Pagination Support**: Configurable page sizes with intelligent limits

#### ReadResourceRequestSchema Handler
- **Multi-format Support**: Automatic format conversion for Google Workspace files
  - Google Docs → Markdown export
  - Google Sheets → CSV export  
  - Google Presentations → Plain text
  - Google Drawings → PNG images
  - Text files → UTF-8 content
  - Binary files → Base64 encoding
- **Content Caching**: Intelligent caching of file contents
- **Error Resilience**: Graceful handling of read failures

#### ListToolsRequestSchema Handler
- **Tool Registry**: 22 comprehensive tools with detailed JSON schemas
- **Parameter Validation**: Complete input validation specifications
- **Documentation**: Rich descriptions and usage examples
- **Type Safety**: TypeScript interfaces for all tool parameters

#### CallToolRequestSchema Handler
- **Tool Execution**: Robust execution engine with comprehensive error handling
- **Input Validation**: Parameter validation before API calls
- **Performance Tracking**: Per-tool execution metrics
- **Cache Management**: Intelligent cache invalidation after write operations

### 5. Tools Implementation (22 Tools)

#### File Operations
```typescript
// Natural language search with advanced filtering
interface SearchTool {
  query: string; // "spreadsheets modified last 7 days"
  pageSize?: number;
}

// Enhanced search with structured filters
interface EnhancedSearchTool {
  query: string;
  filters: {
    mimeType?: string;
    modifiedAfter?: string;
    createdBefore?: string;
    sharedWithMe?: boolean;
    ownedByMe?: boolean;
    parents?: string;
    trashed?: boolean;
  };
  pageSize?: number;
  orderBy?: string;
}

// File content reading with format conversion
interface ReadTool {
  fileId: string;
}

// File and folder creation
interface CreateFileTool {
  name: string;
  content: string;
  mimeType?: string;
  parentId?: string;
}

interface CreateFolderTool {
  name: string;
  parentId?: string;
}

// File updates
interface UpdateFileTool {
  fileId: string;
  content: string;
}

// Batch operations for efficiency
interface BatchFileOperationsTool {
  operations: Array<{
    type: 'create' | 'update' | 'delete' | 'move';
    fileId?: string;
    name?: string;
    content?: string;
    mimeType?: string;
    parentId?: string;
  }>;
}
```

#### Google Sheets Operations
```typescript
interface ListSheetsTool {
  spreadsheetId: string;
}

interface ReadSheetTool {
  spreadsheetId: string;
  range?: string; // A1 notation, defaults to "Sheet1"
}

interface UpdateCellsTool {
  spreadsheetId: string;
  range: string; // A1 notation
  values: (string | number | boolean | null)[][];
}

interface AppendRowsTool {
  spreadsheetId: string;
  sheetName?: string;
  values: (string | number | boolean | null)[][];
}
```

#### Google Docs Operations
```typescript
interface CreateDocumentTool {
  title: string;
  content?: string;
  parentId?: string;
}

interface InsertTextTool {
  documentId: string;
  text: string;
  index?: number;
}

interface ReplaceTextTool {
  documentId: string;
  searchText: string;
  replaceText: string;
  matchCase?: boolean;
}

interface ApplyTextStyleTool {
  documentId: string;
  startIndex: number;
  endIndex: number;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  fontSize?: number;
  foregroundColor?: { red: number; green: number; blue: number };
}

interface InsertTableTool {
  documentId: string;
  rows: number;
  columns: number;
  index?: number;
}
```

#### Google Forms Operations
```typescript
interface CreateFormTool {
  title: string;
  description?: string;
}

interface GetFormTool {
  formId: string;
}

interface AddQuestionTool {
  formId: string;
  title: string;
  type: 'TEXT' | 'PARAGRAPH_TEXT' | 'MULTIPLE_CHOICE' | 'CHECKBOX' | 
        'DROPDOWN' | 'LINEAR_SCALE' | 'DATE' | 'TIME';
  required?: boolean;
  options?: string[];
  scaleMin?: number;
  scaleMax?: number;
  scaleMinLabel?: string;
  scaleMaxLabel?: string;
}

interface ListResponsesTool {
  formId: string;
}
```

#### Google Apps Script Operations
```typescript
interface GetAppScriptTool {
  scriptId: string;
}
```

## Data Flow Architecture

### 1. Request Processing Pipeline
```
MCP Client Request
       ↓
StdioServerTransport (JSON-RPC)
       ↓
Request Authentication Check
       ↓
Performance Timer Start
       ↓
Cache Lookup (Redis)
       ↓
   Cache Hit? ──Yes─→ Return Cached Result
       ↓ No
Request Handler Routing
       ↓
Parameter Validation
       ↓
Google API Client Call
       ↓
Response Processing & Formatting
       ↓
Cache Storage (if applicable)
       ↓
Performance Metrics Recording
       ↓
Structured Logging
       ↓
MCP Response (JSON-RPC)
       ↓
Client Receives Result
```

### 2. Authentication Flow
```
Initial Setup:
User runs: node dist/index.js auth
       ↓
OAuth Browser Flow Launch
       ↓
Google Authorization Server
       ↓
Consent & Authorization Code
       ↓
Token Exchange (access + refresh)
       ↓
TokenManager Encrypts & Stores Tokens
       ↓
Authentication Complete

Runtime Authentication:
Server Startup
       ↓
AuthManager.initialize()
       ↓
TokenManager.loadTokens()
       ↓
Token Validation & Expiry Check
       ↓
OAuth2Client.setCredentials()
       ↓
Proactive Token Monitoring (30min interval)
       ↓
Auto-refresh Before Expiry (10min buffer)
       ↓
Continuous API Access
```

### 3. File Processing Pipeline
```
File Read Request
       ↓
File ID Extraction
       ↓
Cache Check (Redis)
       ↓
   Cache Hit? ──Yes─→ Return Cached Content
       ↓ No
Google Drive API: files.get()
       ↓
MIME Type Detection
       ↓
┌─────────────────────────────────────┐
│        Format Conversion            │
├─────────────────────────────────────┤
│ Google Docs → Markdown Export       │
│ Google Sheets → CSV Export          │
│ Google Slides → Plain Text          │
│ Google Drawings → PNG Export        │
│ Text Files → Direct UTF-8           │
│ Binary Files → Base64 Encoding      │
└─────────────────────────────────────┘
       ↓
Content Processing & Validation
       ↓
Cache Storage (5min TTL)
       ↓
Formatted Response Return
```

### 4. Caching Strategy
```
Write Operation Trigger
       ↓
Cache Invalidation (Pattern-based)
       ↓
┌─────────────────────────────────────┐
│        Cache Patterns               │
├─────────────────────────────────────┤
│ resources:* → File list changes     │
│ search:* → Search result changes    │
│ read:{fileId} → File content changes│
│ sheet:{id}:* → Spreadsheet changes  │
│ script:{id} → Apps Script changes   │
└─────────────────────────────────────┘
       ↓
Redis Key Deletion
       ↓
Fresh Data on Next Request
```

### 5. Error Handling Flow
```
Error Occurrence
       ↓
Error Type Classification
       ↓
┌─────────────────────────────────────┐
│        Error Categories             │
├─────────────────────────────────────┤
│ Authentication → Token refresh      │
│ Rate Limiting → Exponential backoff │
│ Network → Connection retry          │
│ Validation → Parameter correction   │
│ API Errors → Graceful degradation   │
└─────────────────────────────────────┘
       ↓
Structured Error Logging
       ↓
Performance Metrics (Error Flag)
       ↓
MCP Error Response
       ↓
Client Error Handling
```

## Project Structure

```
gdrive/
├── index.ts                    # Main server implementation
├── package.json                # Dependencies and build configuration
├── tsconfig.json              # TypeScript compilation settings
├── Dockerfile                 # Multi-stage Docker build
├── docker-compose.yml         # Redis + MCP server orchestration
├── .env.example              # Environment variable template
│
├── src/                      # Source code modules
│   ├── auth/                 # Authentication system
│   │   ├── AuthManager.ts    # OAuth state & token management
│   │   └── TokenManager.ts   # Encrypted token storage
│   └── health-check.ts       # Health monitoring system
│
├── credentials/              # OAuth keys and tokens (gitignored)
│   ├── gcp-oauth.keys.json  # Google Cloud OAuth credentials
│   ├── .gdrive-server-credentials.json  # Legacy credentials
│   ├── .gdrive-mcp-tokens.json         # Encrypted token storage
│   └── gdrive-mcp-audit.log            # Token lifecycle audit log
│
├── data/                     # Application data (Docker volume)
├── logs/                     # Application logs (Docker volume)
│   ├── error.log            # Error-level logs only
│   ├── combined.log         # All application logs
│   └── gdrive-mcp-audit.log # Token audit trail
│
├── docs/                     # Documentation
│   ├── Architecture/
│   │   └── ARCHITECTURE.md   # This file - system design
│   ├── Examples/             # Usage examples and use cases
│   ├── Features/             # Feature documentation
│   ├── Guides/              # Installation and setup guides
│   └── API.md               # API reference (legacy)
│
├── scripts/                  # Utility scripts
│   ├── auth.sh              # Host-based authentication script
│   └── health-check.sh      # Health monitoring script
│
├── dist/                     # Compiled TypeScript output
│   ├── index.js             # Main server executable
│   ├── src/                 # Compiled modules
│   └── health-check.js      # Health check executable
│
└── tests/                    # Test suites (configured)
    ├── unit/                # Unit tests
    ├── integration/         # Integration tests
    └── e2e/                 # End-to-end tests
```

## Infrastructure Components

### 1. Performance Monitoring System
```typescript
class PerformanceMonitor {
  // Real-time operation metrics
  private metrics: Map<string, {
    count: number;
    totalTime: number;
    errors: number;
  }>;
  
  // Cache performance tracking
  private cacheHits: number;
  private cacheMisses: number;
  
  // Methods
  track(operation: string, duration: number, error?: boolean): void;
  recordCacheHit(): void;
  recordCacheMiss(): void;
  getStats(): PerformanceStats;
}
```

### 2. Winston Logging System
```typescript
// Structured logging configuration
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ 
      filename: 'logs/error.log', 
      level: 'error',
      maxsize: 5242880, // 5MB rotation
      maxFiles: 5
    }),
    new winston.transports.File({ 
      filename: 'logs/combined.log',
      maxsize: 5242880,
      maxFiles: 5
    }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp(),
        winston.format.printf((info) => {
          return `${info.timestamp} [${info.level}]: ${info.message} ${Object.keys(info.meta || {}).length ? JSON.stringify(info.meta) : ''}`;
        })
      )
    })
  ]
});
```

### 3. Health Check System
```typescript
export interface HealthCheckResult {
  status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY';
  timestamp: string;
  checks: {
    tokenStatus: {
      status: 'pass' | 'fail' | 'warn';
      message: string;
      metadata?: {
        expiresIn?: number;
        state?: AuthState;
        lastRefresh?: string;
      };
    };
    refreshCapability: {
      status: 'pass' | 'fail';
      message: string;
    };
  };
  metrics?: {
    uptime: number;
    memoryUsage: NodeJS.MemoryUsage;
    executionTimeMs?: number;
  };
}
```

### 4. Natural Language Query Parser
```typescript
function parseNaturalLanguageQuery(query: string): {
  searchTerms: string;
  filters: {
    mimeType?: string;
    modifiedTime?: string;
    createdTime?: string;
    sharedWithMe?: boolean;
    ownedByMe?: boolean;
  };
} {
  // Parses queries like:
  // "spreadsheets modified last 7 days"
  // "documents shared with me created yesterday"
  // "presentations owned by me modified today"
}
```

### 5. Docker & Container Architecture
```yaml
# Multi-service deployment
services:
  gdrive-mcp:
    build: .
    container_name: gdrive-mcp-server
    volumes:
      - ./credentials:/credentials:ro
      - ./data:/data
      - ./logs:/app/logs
    environment:
      - NODE_ENV=production
      - REDIS_URL=redis://redis:6379
      - GDRIVE_TOKEN_ENCRYPTION_KEY=${GDRIVE_TOKEN_ENCRYPTION_KEY}
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "node", "dist/index.js", "health"]
      interval: 5m
      timeout: 10s
      retries: 3
    depends_on:
      - redis

  redis:
    image: redis:7-alpine
    container_name: gdrive-mcp-redis
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 30s
      timeout: 3s
      retries: 3
```

## Performance Architecture

### Current Optimizations
- **Redis Caching**: 5-minute TTL with intelligent invalidation
- **Selective API Fields**: Minimal data retrieval from Google APIs
- **Performance Monitoring**: Real-time metrics collection every 30 seconds
- **Connection Reuse**: OAuth2Client reuse across requests
- **Pagination Support**: Configurable page sizes (max 100)
- **Batch Operations**: Single API call for multiple file operations
- **Natural Language Processing**: Optimized query parsing
- **Streaming Support**: Large file handling with appropriate formats

### Performance Metrics
```typescript
interface PerformanceStats {
  uptime: number;
  operations: Record<string, {
    count: number;
    avgTime: number;
    errorRate: number;
  }>;
  cache: {
    hits: number;
    misses: number;
    hitRate: number;
  };
  memory: NodeJS.MemoryUsage;
}
```

### Caching Strategy
- **Resource Lists**: 5-minute cache for drive file listings
- **File Content**: 5-minute cache for file reads with format conversion
- **Search Results**: Cached by query string and parameters
- **Sheet Data**: Cached per spreadsheet and range
- **Apps Script**: Cached project content
- **Cache Invalidation**: Pattern-based invalidation on write operations

### Resource Management
- **Memory Monitoring**: Process memory usage tracking
- **Connection Pooling**: Reused OAuth2 clients
- **Error Rate Tracking**: Per-operation error monitoring
- **Token Refresh Optimization**: Preemptive refresh (10-minute buffer)
- **Redis Fallback**: Graceful degradation when cache unavailable

## Security Architecture

### Authentication Security
- **OAuth 2.0 Flow**: Industry-standard authorization with offline access
- **Multi-Scope Support**: Granular permissions for Drive, Sheets, Docs, Forms, Script
- **Token Lifecycle Management**: Secure token storage, refresh, and revocation handling
- **Proactive Monitoring**: Continuous token validity checks with 30-minute intervals
- **Retry Logic**: Exponential backoff with rate limiting protection

### Token Security
```typescript
// AES-256-GCM encryption for token storage
class TokenManager {
  private encryptTokens(tokens: TokenData): string {
    const cipher = crypto.createCipher('aes-256-gcm', this.encryptionKey);
    // Secure encryption implementation
  }
  
  private decryptTokens(encryptedData: string): TokenData {
    const decipher = crypto.createDecipher('aes-256-gcm', this.encryptionKey);
    // Secure decryption implementation
  }
}
```

### Authorization Model
- **Principle of Least Privilege**: Only requested scopes are authorized
- **Google Workspace Permissions**: Respects existing Drive sharing and permissions
- **No Privilege Escalation**: Cannot access files beyond user's permissions
- **Scope Validation**: Runtime validation of required permissions

### Data Protection
- **No Persistent Storage**: File contents never stored locally (except temporary cache)
- **Encrypted Credentials**: AES-256-GCM encryption for all stored tokens
- **Audit Trail**: Comprehensive logging of all token lifecycle events
- **Cache Security**: Redis cache with TTL ensures no long-term data retention
- **Secure Defaults**: Production-ready security configurations

### Environment Security
- **Docker Isolation**: Containerized deployment with restricted permissions
- **Volume Security**: Read-only credential mounts where applicable
- **Environment Variables**: Secure configuration through environment variables
- **Health Monitoring**: Security-aware health checks for token validity

### Network Security
- **HTTPS Only**: All Google API communications over HTTPS
- **Token Transmission**: Secure token handling in memory only
- **Rate Limiting**: Built-in protection against API abuse
- **Error Handling**: Secure error messages without credential exposure

## Deployment Architecture

### Docker Multi-Stage Build
```dockerfile
FROM node:20-slim

# Install system dependencies for native modules
RUN apt-get update && apt-get install -y \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Layer caching optimization
COPY package*.json tsconfig.json ./
RUN npm ci --ignore-scripts

# Build application
COPY . .
RUN npm run build

# Security hardening
RUN mkdir -p /credentials /app/logs && \
    chmod 700 /credentials && \
    chmod 755 /app/logs

# Health check integration
HEALTHCHECK --interval=5m --timeout=10s --start-period=30s --retries=3 \
  CMD ["node", "dist/health-check.js"]

CMD ["node", "dist/index.js"]
```

### Container Orchestration
```yaml
# Production-ready Docker Compose
version: '3.8'
services:
  gdrive-mcp:
    build: .
    container_name: gdrive-mcp-server
    volumes:
      - ./credentials:/credentials:ro  # Read-only credentials
      - ./data:/data                   # Persistent data
      - ./logs:/app/logs              # Log persistence
    environment:
      - NODE_ENV=production
      - LOG_LEVEL=silent             # Production logging
      - REDIS_URL=redis://redis:6379
      - GDRIVE_TOKEN_ENCRYPTION_KEY=${GDRIVE_TOKEN_ENCRYPTION_KEY}
      - GDRIVE_TOKEN_REFRESH_INTERVAL=1800000  # 30 minutes
      - GDRIVE_TOKEN_PREEMPTIVE_REFRESH=600000 # 10 minutes
    restart: unless-stopped
    stdin_open: true    # Required for MCP stdio transport
    tty: true          # Required for MCP stdio transport
    depends_on:
      - redis
    networks:
      - mcp-network
    healthcheck:
      test: ["CMD", "node", "dist/index.js", "health"]
      interval: 5m
      timeout: 10s
      retries: 3
      start_period: 30s

  redis:
    image: redis:7-alpine
    container_name: gdrive-mcp-redis
    volumes:
      - redis_data:/data
    networks:
      - mcp-network
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 30s
      timeout: 3s
      retries: 3

volumes:
  redis_data:

networks:
  mcp-network:
    driver: bridge
```

### Environment Configuration
```bash
# Authentication
GDRIVE_CREDENTIALS_PATH=/credentials/.gdrive-server-credentials.json
GDRIVE_OAUTH_PATH=/credentials/gcp-oauth.keys.json
GDRIVE_TOKEN_STORAGE_PATH=/credentials/.gdrive-mcp-tokens.json
GDRIVE_TOKEN_ENCRYPTION_KEY=<base64-encoded-32-byte-key>

# Performance
REDIS_URL=redis://localhost:6379
GDRIVE_TOKEN_REFRESH_INTERVAL=1800000      # 30 minutes
GDRIVE_TOKEN_PREEMPTIVE_REFRESH=600000    # 10 minutes
GDRIVE_TOKEN_MAX_RETRIES=3
GDRIVE_TOKEN_RETRY_DELAY=1000

# Logging
LOG_LEVEL=info
NODE_ENV=production
GDRIVE_TOKEN_AUDIT_LOG_PATH=/app/logs/gdrive-mcp-audit.log

# Health Monitoring
GDRIVE_TOKEN_HEALTH_CHECK=true
```

### Health Check System
```typescript
export enum HealthStatus {
  HEALTHY = 'HEALTHY',     // All systems operational
  DEGRADED = 'DEGRADED',   // Minor issues, token expiring soon
  UNHEALTHY = 'UNHEALTHY', // Critical issues, requires attention
}

// Comprehensive health monitoring
const healthChecks = {
  tokenStatus: 'Token validity and expiration',
  refreshCapability: 'Token refresh functionality',
  memoryUsage: 'Process memory consumption',
  uptime: 'Service availability time',
  executionTime: 'Health check performance'
};
```

### Claude Desktop Integration
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

### Production Deployment Considerations
- **Authentication Prerequisites**: OAuth setup must be completed on host before containerization
- **Volume Management**: Persistent storage for credentials, data, and logs
- **Network Security**: Isolated Docker network for service communication
- **Resource Limits**: Memory and CPU limits for production environments
- **Monitoring Integration**: Health check endpoints for external monitoring
- **Log Management**: Structured logging with rotation and external aggregation support

## Monitoring and Observability

### Performance Metrics (Active)
```typescript
// Real-time metrics collection
interface PerformanceStats {
  uptime: number;                    // Service uptime in milliseconds
  operations: Record<string, {       // Per-operation metrics
    count: number;                   // Total operation count
    avgTime: number;                 // Average execution time
    errorRate: number;               // Error percentage
  }>;
  cache: {                          // Cache performance
    hits: number;                    // Cache hit count
    misses: number;                  // Cache miss count
    hitRate: number;                 // Hit rate percentage
  };
  memory: NodeJS.MemoryUsage;       // Process memory usage
}

// Metrics logged every 30 seconds
setInterval(() => {
  logger.info('Performance stats', performanceMonitor.getStats());
}, 30000);
```

### Structured Logging (Active)
```typescript
// Winston-based logging with multiple transports
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()  // Structured JSON for parsing
  ),
  defaultMeta: { service: 'gdrive-mcp-server' },
  transports: [
    // Error-only log file
    new winston.transports.File({ 
      filename: 'logs/error.log', 
      level: 'error',
      maxsize: 5242880,  // 5MB rotation
      maxFiles: 5
    }),
    // Combined log file
    new winston.transports.File({ 
      filename: 'logs/combined.log',
      maxsize: 5242880,
      maxFiles: 5
    }),
    // Console output with colors
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp(),
        winston.format.printf(formatter)
      )
    })
  ]
});
```

### Audit Trail (Active)
```typescript
// Token lifecycle audit logging
class TokenManager {
  private auditLog(event: string, metadata?: any): void {
    const auditEntry = {
      timestamp: new Date().toISOString(),
      event,
      metadata,
      userId: 'system',
      sessionId: process.pid
    };
    
    // Append to audit log file
    fs.appendFileSync(
      process.env.GDRIVE_TOKEN_AUDIT_LOG_PATH || './gdrive-mcp-audit.log',
      JSON.stringify(auditEntry) + '\n'
    );
  }
}
```

### Health Monitoring (Active)
```typescript
// Comprehensive health check endpoint
export async function performHealthCheck(): Promise<HealthCheckResult> {
  const startTime = Date.now();
  
  const checks = {
    tokenStatus: await checkTokenHealth(),
    refreshCapability: await checkRefreshCapability(),
    redisConnection: await checkRedisHealth(),
    memoryUsage: process.memoryUsage(),
    uptime: process.uptime()
  };
  
  return {
    status: determineOverallHealth(checks),
    timestamp: new Date().toISOString(),
    checks,
    metrics: {
      executionTimeMs: Date.now() - startTime
    }
  };
}
```

### Error Tracking (Active)
```typescript
// Comprehensive error handling with context
try {
  // API operation
} catch (error) {
  // Performance tracking with error flag
  performanceMonitor.track(operationName, duration, true);
  
  // Structured error logging
  logger.error('Operation failed', {
    operation: operationName,
    error: error instanceof Error ? error.message : 'Unknown error',
    stack: error instanceof Error ? error.stack : undefined,
    context: {
      userId: 'current-user',
      requestId: generateRequestId(),
      timestamp: new Date().toISOString()
    }
  });
  
  throw error;
}
```

### Docker Health Checks (Active)
```yaml
# Container-level health monitoring
healthcheck:
  test: ["CMD", "node", "dist/index.js", "health"]
  interval: 5m      # Check every 5 minutes
  timeout: 10s      # 10-second timeout
  retries: 3        # 3 retries before unhealthy
  start_period: 30s # Grace period on startup
```

### Monitoring Integration Points
- **Prometheus Metrics**: Ready for Prometheus scraping with custom metrics
- **Log Aggregation**: Structured JSON logs compatible with ELK stack, Splunk
- **APM Integration**: Ready for New Relic, DataDog, or custom APM tools
- **Alert Triggers**: Health check status changes, error rate thresholds
- **Performance Baselines**: Historical performance data for anomaly detection

## Extension Architecture

The system is designed for extensibility with clear interfaces and patterns:

### 1. Adding New Tools
```typescript
// Add to tools array in ListToolsRequestSchema handler
{
  name: "newTool",
  description: "Description of the new tool",
  inputSchema: {
    type: "object",
    properties: {
      // Tool parameters
    },
    required: ["requiredParam"]
  }
}

// Implement in CallToolRequestSchema handler
case "newTool": {
  // Input validation
  if (!args || typeof args.requiredParam !== 'string') {
    throw new Error('requiredParam is required');
  }
  
  // Cache check
  const cacheKey = `newTool:${args.requiredParam}`;
  const cached = await cacheManager.get(cacheKey);
  if (cached) {
    performanceMonitor.track('newTool', Date.now() - startTime);
    return cached;
  }
  
  // Implementation logic
  const result = await performNewToolOperation(args);
  
  // Cache result
  await cacheManager.set(cacheKey, result);
  
  // Performance tracking
  performanceMonitor.track('newTool', Date.now() - startTime);
  logger.info('New tool executed', { args });
  
  return result;
}
```

### 2. Adding New Google APIs
```typescript
// Initialize new API client
const newApi = google.newservice('v1');

// Add authentication scope
const scopes = [
  "https://www.googleapis.com/auth/drive",
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/documents",
  "https://www.googleapis.com/auth/forms",
  "https://www.googleapis.com/auth/script.projects.readonly",
  "https://www.googleapis.com/auth/newservice"  // Add new scope
];

// Implement API-specific tools with consistent patterns
case "newApiTool": {
  const response = await newApi.resource.method({
    // API parameters
  });
  
  return {
    content: [{
      type: "text",
      text: JSON.stringify(response.data, null, 2)
    }]
  };
}
```

### 3. Adding New File Formats
```typescript
// Extend file reading pipeline
if (file.data.mimeType?.startsWith("application/vnd.google-apps.")) {
  let exportMimeType = "text/plain";
  
  if (file.data.mimeType === "application/vnd.google-apps.document") {
    exportMimeType = "text/markdown";
  } else if (file.data.mimeType === "application/vnd.google-apps.spreadsheet") {
    exportMimeType = "text/csv";
  } else if (file.data.mimeType === "application/vnd.google-apps.presentation") {
    exportMimeType = "text/plain";
  } else if (file.data.mimeType === "application/vnd.google-apps.drawing") {
    exportMimeType = "image/png";
    // Handle binary export
  } else if (file.data.mimeType === "application/vnd.google-apps.newformat") {
    exportMimeType = "application/json";  // New format
  }
  
  const response = await drive.files.export({
    fileId,
    mimeType: exportMimeType,
  });
}
```

### 4. Extending Authentication
```typescript
// Additional OAuth providers or authentication methods
class AuthManager {
  // Add support for service accounts
  async initializeServiceAccount(keyPath: string): Promise<void> {
    // Service account initialization
  }
  
  // Add support for additional token types
  async handleCustomTokens(tokens: CustomTokens): Promise<void> {
    // Custom token handling
  }
}
```

### 5. Custom Cache Strategies
```typescript
// Extend CacheManager for custom caching logic
class CacheManager {
  async setWithCustomTTL(key: string, value: any, ttl: number): Promise<void> {
    if (!this.connected) return;
    
    try {
      await this.client.setEx(key, ttl, JSON.stringify(value));
    } catch (error) {
      logger.error('Custom cache set error', { error, key, ttl });
    }
  }
  
  async invalidatePattern(pattern: string): Promise<void> {
    // Custom invalidation logic
  }
}
```

## Development Best Practices

### 1. Code Organization
- **Modular Structure**: Separate authentication, caching, and API logic
- **Type Safety**: Comprehensive TypeScript interfaces for all data structures
- **Error Boundaries**: Consistent error handling and transformation to MCP format
- **Dependency Injection**: Pass clients and configurations as parameters
- **Single Responsibility**: Each module has one clear purpose

### 2. Performance Optimization
```typescript
// Always implement performance tracking
const startTime = Date.now();
try {
  // Operation implementation
  const result = await performOperation();
  performanceMonitor.track('operationName', Date.now() - startTime);
  return result;
} catch (error) {
  performanceMonitor.track('operationName', Date.now() - startTime, true);
  throw error;
}
```

### 3. Caching Strategy
```typescript
// Implement consistent caching pattern
const cacheKey = `operation:${JSON.stringify(params)}`;
const cached = await cacheManager.get(cacheKey);
if (cached) {
  return cached;
}

const result = await performOperation(params);
await cacheManager.set(cacheKey, result);
return result;
```

### 4. Error Handling
```typescript
// Comprehensive error handling with context
try {
  // Implementation
} catch (error) {
  logger.error('Operation failed', {
    operation: 'operationName',
    error: error instanceof Error ? error.message : 'Unknown error',
    context: { params, timestamp: new Date().toISOString() }
  });
  
  // Transform to MCP-compatible error
  throw new Error(`Operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
}
```

### 5. Testing Strategy
```typescript
// Unit tests for individual components
describe('AuthManager', () => {
  it('should refresh tokens before expiry', async () => {
    // Test implementation
  });
});

// Integration tests for API interactions
describe('Google Drive Integration', () => {
  it('should search files with natural language', async () => {
    // Test implementation
  });
});

// End-to-end tests for complete workflows
describe('MCP Protocol', () => {
  it('should handle complete request-response cycle', async () => {
    // Test implementation
  });
});
```

### 6. Documentation Standards
- **API Documentation**: Complete JSDoc comments for all public methods
- **Architecture Documentation**: Keep this document updated with changes
- **Usage Examples**: Provide practical examples for all tools
- **Setup Guides**: Maintain clear installation and configuration instructions
- **Troubleshooting**: Document common issues and solutions