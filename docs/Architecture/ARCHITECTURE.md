# Google Drive MCP Server Architecture

## Table of Contents
1. [Overview](#overview)
2. [System Architecture](#system-architecture)
3. [Technology Stack](#technology-stack)
4. [Core Components](#core-components)
5. [Project Structure](#project-structure)
6. [Data Flow Architecture](#data-flow-architecture)
7. [Infrastructure Components](#infrastructure-components)
8. [Performance Architecture](#performance-architecture)
9. [Security Architecture](#security-architecture)
10. [Deployment Architecture](#deployment-architecture)
11. [Monitoring and Observability](#monitoring-and-observability)
12. [Extension Architecture](#extension-architecture)
13. [Development Best Practices](#development-best-practices)
14. [Coding Standards](#coding-standards)

---

## Overview

The Google Drive MCP Server is a production-ready TypeScript implementation of the Model Context Protocol (MCP) that provides comprehensive access to Google Workspace services. The architecture follows enterprise-grade patterns with robust authentication, caching, monitoring, and Docker support.

### Key Capabilities
- Full read/write access to Google Drive files and folders
- Resource access to Google Drive files via `gdrive:///<file_id>` URIs
- Comprehensive Google Sheets operations (read, update, append, format)
- Google Forms creation and management with question types
- Google Docs API integration (create, insert, replace, format)
- Batch file operations for efficient processing
- Redis caching infrastructure for high performance
- Performance monitoring and structured logging
- Docker support for containerized deployment

---

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
│  │  • ListToolsRequestSchema (5 tools)            │   │
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

---

## Technology Stack

### Core Technologies

#### Runtime & Language
- **Node.js**: v20+ (required for ES2022 support)
  - Using ES modules (`"type": "module"` in package.json)
  - Native async/await and modern JavaScript features
- **TypeScript**: v5.6.2
  - Target: ES2022
  - Strict mode enabled
  - ES module output with source maps

#### MCP Framework
- **@modelcontextprotocol/sdk**: v1.0.1
  - StdioServerTransport for JSON-RPC communication
  - Built-in request/response schemas
  - Error handling and validation

### Google API Integration

#### Google Cloud Libraries
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

#### OAuth Scopes
```javascript
const SCOPES = [
  "https://www.googleapis.com/auth/drive",
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/documents",
  "https://www.googleapis.com/auth/forms",
  "https://www.googleapis.com/auth/script.projects.readonly"
];
```

### Infrastructure Dependencies

#### Caching
- **Redis**: v5.6.1 (client library)
  - Redis Server: v7-alpine (Docker)
  - Connection: `redis://localhost:6379`
  - Default TTL: 5 minutes
  - Pattern-based invalidation

#### Logging
- **Winston**: v3.17.0
  - Structured JSON logging
  - Multiple transports (file, console)
  - Log rotation (5MB files, max 5)
  - Level-based filtering

### Development Dependencies

#### Build Tools
- **TypeScript**: v5.6.2 (compiler)
- **shx**: v0.3.4 (cross-platform shell commands)

#### Testing Framework
- **Jest**: v29.7.0
  - **ts-jest**: v29.1.2 (TypeScript support)
  - **@types/jest**: v29.5.12
  - **@jest/globals**: v29.7.0

#### Type Definitions
- **@types/node**: v22 (Node.js type definitions)

### Container & Deployment

#### Docker
- **Base Image**: node:20-slim
- **Multi-stage Build**: Yes
- **Health Checks**: Built-in
- **Volumes**:
  - `/credentials` (read-only)
  - `/data` (persistent)
  - `/app/logs` (log persistence)

#### Docker Compose
- **Version**: 3.8
- **Services**: gdrive-mcp (main server), redis (caching layer)
- **Networks**: Bridge network (mcp-network)
- **Restart Policy**: unless-stopped

### API Versions & Compatibility

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

---

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
- **Tool Registry**: 5 consolidated tools with detailed JSON schemas
- **Parameter Validation**: Complete input validation specifications
- **Documentation**: Rich descriptions and usage examples
- **Type Safety**: TypeScript interfaces for all tool parameters

#### CallToolRequestSchema Handler
- **Tool Execution**: Robust execution engine with comprehensive error handling
- **Input Validation**: Parameter validation before API calls
- **Performance Tracking**: Per-tool execution metrics
- **Cache Management**: Intelligent cache invalidation after write operations

### 5. Tool Architecture (Operation-Based Pattern)

**⚠️ ARCHITECTURE CHANGE (v2.0.0):** This server has migrated from individual tools to **operation-based tools** following HOW2MCP 2025 best practices. This architectural shift reduces tool count by 88% (41+ → 5 tools) while maintaining 100% functional compatibility.

#### Pattern Overview

The operation-based pattern consolidates related operations under a single tool with an `operation` parameter, rather than exposing each operation as a separate tool. This improves LLM tool selection performance and maintains cleaner tool namespace.

**Pattern Structure:**

Each consolidated tool implements:
1. **Zod Discriminated Union** - Type-safe operation routing with compile-time validation
2. **Operation Router** - Switch statement in handler for clean dispatch
3. **Centralized Logger** - Context-based logging passed to all operations
4. **Consistent Error Handling** - Uniform error patterns across operations

#### Consolidated Tools

| Tool | Operations | Description |
|------|-----------|-------------|
| `sheets` | 12 | All Google Sheets operations (list, read, create, update, format, conditional formatting, freeze, column width, append, delete, rename) |
| `drive` | 7 | All Google Drive file operations (search, enhancedSearch, read, create, update, createFolder, batch) |
| `forms` | 4 | All Google Forms operations (create, read, addQuestion, listResponses) |
| `docs` | 5 | All Google Docs operations (create, insertText, replaceText, applyTextStyle, insertTable) |
| `getAppScript` | 1 | Standalone tool for Apps Script project viewing (non-consolidated legacy tool) |

**Total: 5 tools, 29 operations** (down from 41+ individual tools in v1.x)

#### Example: Sheets Tool Implementation

**Schema (Zod Discriminated Union):**
```typescript
// src/sheets/sheets-schemas.ts
import { z } from 'zod';

export const SheetsToolSchema = z.discriminatedUnion('operation', [
  // List operation
  z.object({
    operation: z.literal('list'),
    spreadsheetId: z.string(),
  }),

  // Read operation
  z.object({
    operation: z.literal('read'),
    spreadsheetId: z.string(),
    range: z.string().optional(),
  }),

  // Create operation
  z.object({
    operation: z.literal('create'),
    spreadsheetId: z.string(),
    sheetName: z.string(),
    rowCount: z.number().optional(),
    columnCount: z.number().optional(),
  }),

  // ... 9 more operation schemas
]);

export type SheetsToolInput = z.infer<typeof SheetsToolSchema>;
```

**Handler (Operation Router):**
```typescript
// src/sheets/sheets-handler.ts
import { Logger } from 'winston';
import { SheetsToolInput } from './sheets-schemas';

export async function handleSheetsTool(
  args: SheetsToolInput,
  context: { logger: Logger; /* other dependencies */ }
) {
  const { logger } = context;

  switch (args.operation) {
    case 'list':
      logger.info('Executing sheets:list operation');
      return await handleListSheets(args, context);

    case 'read':
      logger.info('Executing sheets:read operation');
      return await handleReadSheet(args, context);

    case 'create':
      logger.info('Executing sheets:create operation');
      return await handleCreateSheet(args, context);

    // ... 9 more case handlers

    default:
      throw new Error(`Unknown sheets operation: ${(args as any).operation}`);
  }
}
```

**Registration (index.ts):**
```typescript
// index.ts - Tool registration in ListToolsRequestSchema handler
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'sheets',
        description: 'Perform operations on Google Sheets spreadsheets',
        inputSchema: zodToJsonSchema(SheetsToolSchema),
      },
      // ... other 4 tools
    ],
  };
});

// Tool execution in CallToolRequestSchema handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case 'sheets':
      return await handleSheetsTool(args, { logger, /* deps */ });
    // ... other 4 tool handlers
  }
});
```

#### Benefits

**LLM Efficiency:**
- 88% fewer tools to evaluate (41+ → 5)
- Faster tool selection with reduced namespace
- Clearer tool categorization by service

**Type Safety:**
- Zod discriminated unions ensure type correctness
- Compile-time validation of operation parameters
- IDE autocomplete for all operations

**Maintainability:**
- Centralized handlers reduce code duplication
- Consistent patterns across all services
- Easy to add new operations to existing tools

**Consistency:**
- Uniform error handling patterns
- Shared logging infrastructure
- Common validation approach

**Extensibility:**
- Adding new operations doesn't pollute tool namespace
- Service-level organization matches Google API structure
- Easy to version operations within tools

#### Migration from v1.x

Previous versions (< 2.0.0) exposed individual tools. v2.0.0 consolidates these into operation parameters:

```typescript
// Old (v1.x) - 12 separate tools
{ name: "listSheets", args: { spreadsheetId: "123" } }
{ name: "readSheet", args: { spreadsheetId: "123", range: "A1:B10" } }
{ name: "createSheet", args: { spreadsheetId: "123", sheetName: "New" } }
// ... 9 more tools

// New (v2.0.0) - 1 tool with operation parameter
{ name: "sheets", args: { operation: "list", spreadsheetId: "123" } }
{ name: "sheets", args: { operation: "read", spreadsheetId: "123", range: "A1:B10" } }
{ name: "sheets", args: { operation: "create", spreadsheetId: "123", sheetName: "New" } }
// ... 9 more operations
```

**Breaking Change:** v2.0.0 is a breaking change requiring client updates. See MIGRATION_V2.md and CHANGELOG.md for complete migration guide.

### 6. Tools Implementation (Operation Details)

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

---

## Project Structure

### Root Directory

```
gdrive/
├── index.ts                    # Main entry point - MCP server implementation
├── package.json                # Project metadata and dependencies
├── tsconfig.json              # TypeScript compiler configuration
├── jest.config.js             # Jest testing configuration (if exists)
├── .env.example               # Environment variable template
├── .gitignore                 # Git ignore patterns
├── Dockerfile                 # Container build instructions
├── docker-compose.yml         # Multi-service orchestration
├── README.md                  # Project documentation
├── CLAUDE.md                  # Claude Code guidance file
└── LICENSE                    # MIT license file
```

### Source Code (`/src`)

#### Authentication Module (`/src/auth`)
```
src/auth/
├── AuthManager.ts             # OAuth2 flow and token lifecycle management
│   ├── Class: AuthManager
│   ├── Methods: initialize(), refreshAccessToken(), monitorTokenExpiry()
│   └── State: oauth2Client, authState, refreshTimer
│
└── TokenManager.ts            # Encrypted token storage and retrieval
    ├── Class: TokenManager
    ├── Methods: saveTokens(), loadTokens(), deleteTokens()
    └── Encryption: AES-256-GCM
```

**Purpose**: Handles all authentication concerns including OAuth2 flow, token storage, refresh logic, and security.

#### Health Monitoring (`/src/health-check.ts`)
```
src/health-check.ts            # Standalone health check utility
├── Function: performHealthCheck()
├── Interfaces: HealthCheckResult, HealthStatus
└── Checks: Token validity, refresh capability, memory usage
```

**Purpose**: Provides health monitoring capabilities for Docker and external monitoring systems.

### Distribution (`/dist`)

```
dist/                          # Compiled JavaScript output
├── index.js                   # Compiled server entry point
├── index.d.ts                 # TypeScript declarations
├── index.js.map              # Source maps for debugging
└── src/                      # Compiled source modules
    ├── auth/
    │   ├── AuthManager.js
    │   ├── AuthManager.d.ts
    │   └── TokenManager.js
    └── health-check.js
```

**Purpose**: Contains transpiled JavaScript code ready for production execution.

### Credentials Directory

```
credentials/                   # OAuth and token storage (gitignored)
├── gcp-oauth.keys.json       # Google Cloud OAuth2 credentials
│   └── Structure: {client_id, client_secret, redirect_uris}
│
├── .gdrive-server-credentials.json  # Legacy token format
│   └── Deprecated: Migrated to new format
│
├── .gdrive-mcp-tokens.json   # Encrypted token storage
│   └── Structure: Encrypted {access_token, refresh_token, expiry}
│
└── gdrive-mcp-audit.log      # Token lifecycle audit trail
    └── Format: JSON lines with timestamp, event, metadata
```

**Security**: This directory is excluded from version control and mounted read-only in Docker.

### Data Directory

```
data/                         # Application data (Docker volume)
├── cache/                    # Local file cache (if implemented)
├── temp/                     # Temporary file storage
└── exports/                  # Exported file storage
```

**Purpose**: Persistent data storage for Docker deployments.

### Logs Directory

```
logs/                         # Application logs (Docker volume)
├── error.log                 # Error-level logs only
│   └── Format: JSON, rotated at 5MB
│
├── combined.log              # All application logs
│   └── Format: JSON, includes info/warn/error
│
└── gdrive-mcp-audit.log     # Duplicate of credentials audit log
    └── Purpose: Container-friendly log access
```

**Purpose**: Centralized logging with rotation and multiple severity levels.

### Documentation (`/docs`)

```
docs/
├── Architecture/             # System design documentation
│   └── ARCHITECTURE.md       # This file - comprehensive system design
│
├── Examples/                 # Usage examples
│   ├── basic-usage.md       # Getting started examples
│   ├── advanced-tools.md    # Complex tool usage
│   └── integration.md       # Integration patterns
│
├── Features/                 # Feature documentation
│   ├── authentication.md    # Auth system details
│   ├── caching.md          # Redis caching strategy
│   └── tools/              # Individual tool docs
│
├── Guides/                   # Setup and operation guides
│   ├── installation.md      # Setup instructions
│   ├── docker-setup.md      # Container deployment
│   └── troubleshooting.md   # Common issues
│
└── API.md                   # Legacy API reference
```

**Purpose**: Comprehensive documentation for developers and users.

### Scripts Directory

```
scripts/                      # Utility scripts
├── auth.sh                   # Host-based authentication helper
│   └── Purpose: Simplify OAuth setup process
│
├── health-check.sh          # Health monitoring script
│   └── Purpose: External health checks
│
└── changelog/               # Changelog management
    └── update-changelog.py  # Automated changelog generation
```

**Purpose**: Automation and utility scripts for common tasks.

### Test Structure

```
tests/                       # Test suites (planned)
├── unit/                    # Unit tests
│   ├── auth/               # Auth module tests
│   ├── tools/              # Individual tool tests
│   └── utils/              # Utility function tests
│
├── integration/             # Integration tests
│   ├── google-api/         # API integration tests
│   ├── redis/              # Cache integration tests
│   └── mcp/                # MCP protocol tests
│
└── e2e/                     # End-to-end tests
    ├── workflows/          # Complete workflow tests
    └── performance/        # Performance benchmarks
```

**Purpose**: Comprehensive testing coverage (currently not implemented).

### File Naming Conventions

#### Source Files
- **Classes**: PascalCase (e.g., `AuthManager.ts`)
- **Utilities**: kebab-case (e.g., `health-check.ts`)
- **Interfaces**: Prefix with 'I' for complex types
- **Tests**: `*.test.ts` or `*.spec.ts`

#### Configuration Files
- **Hidden files**: Prefixed with `.` (e.g., `.env`)
- **Config files**: Direct names (e.g., `tsconfig.json`)
- **Docker files**: Capitalized (e.g., `Dockerfile`)

### Module Dependencies

#### Dependency Graph
```
index.ts (Entry Point)
├── @modelcontextprotocol/sdk
├── googleapis
├── src/auth/AuthManager
│   ├── google-auth-library
│   └── src/auth/TokenManager
├── redis (CacheManager)
└── winston (Logger)
```

#### Import Hierarchy
1. **Core modules** (Node.js built-ins)
2. **External packages** (npm dependencies)
3. **Internal modules** (project code)
4. **Type imports** (TypeScript types)

---

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

---

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

---

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

---

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

---

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

---

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

---

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

---

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

---

## Coding Standards

### TypeScript Standards

#### General Principles
- **Type Safety First**: Always prefer explicit types over `any`
- **Strict Mode**: All TypeScript strict flags are enabled
- **ES2022 Features**: Use modern JavaScript features (async/await, optional chaining, nullish coalescing)
- **Functional Approach**: Prefer immutability and pure functions where practical

### Naming Conventions

#### Files and Directories
```typescript
// Files: PascalCase for classes/types, camelCase for utilities
AuthManager.ts       // Class file
TokenManager.ts      // Class file
health-check.ts      // Utility file
index.ts             // Entry points

// Directories: kebab-case
src/auth/            // Authentication module
src/health-check/    // Health monitoring
```

#### Variables and Functions
```typescript
// Constants: UPPER_SNAKE_CASE
const MAX_RETRIES = 3;
const TOKEN_REFRESH_INTERVAL = 1800000;

// Variables: camelCase
let authState: AuthState;
const refreshToken = await getRefreshToken();

// Functions: camelCase, verb-noun pattern
async function refreshAccessToken(): Promise<void> { }
function parseNaturalLanguageQuery(query: string): QueryResult { }

// Private methods: prefix with underscore
private _encryptTokens(tokens: TokenData): string { }
```

#### Classes and Interfaces
```typescript
// Classes: PascalCase
class AuthManager {
  private oauth2Client: OAuth2Client;
  constructor() { }
}

// Interfaces: PascalCase, prefix with 'I' for complex types
interface IHealthCheckResult {
  status: HealthStatus;
  timestamp: string;
}

// Type aliases: PascalCase
type AuthState = 'authenticated' | 'expired' | 'failed';

// Enums: PascalCase for name, UPPER_SNAKE_CASE for values
enum HealthStatus {
  HEALTHY = 'HEALTHY',
  DEGRADED = 'DEGRADED',
  UNHEALTHY = 'UNHEALTHY'
}
```

### Code Organization

#### Module Structure
```typescript
// 1. Imports (grouped and ordered)
import { OAuth2Client } from 'google-auth-library';
import { drive_v3 } from 'googleapis';
import * as fs from 'fs/promises';

// 2. Constants
const SCOPES = ['https://www.googleapis.com/auth/drive'];

// 3. Types/Interfaces
interface TokenData {
  access_token: string;
  refresh_token?: string;
}

// 4. Main class/function
export class AuthManager {
  // 5. Properties
  private oauth2Client: OAuth2Client;

  // 6. Constructor
  constructor(clientId: string) { }

  // 7. Public methods
  public async initialize(): Promise<void> { }

  // 8. Private methods
  private async _loadTokens(): Promise<void> { }
}

// 9. Helper functions
function validateTokens(tokens: TokenData): boolean { }

// 10. Exports
export { TokenData };
```

### Error Handling

#### Consistent Error Pattern
```typescript
// Always use try-catch with proper error typing
try {
  const result = await performOperation();
  return result;
} catch (error) {
  // Type guard for Error instances
  if (error instanceof Error) {
    logger.error('Operation failed', {
      error: error.message,
      stack: error.stack,
      context: { operation: 'performOperation' }
    });

    // Re-throw with context
    throw new Error(`Operation failed: ${error.message}`);
  }

  // Handle unknown errors
  logger.error('Unknown error occurred', { error });
  throw new Error('Operation failed: Unknown error');
}
```

#### Custom Error Classes
```typescript
// Define specific error types
export class AuthenticationError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

// Usage
throw new AuthenticationError('Invalid credentials', 'AUTH_INVALID');
```

### Async/Await Patterns

#### Proper Async Usage
```typescript
// Always use async/await over promises
// Good
async function fetchFile(fileId: string): Promise<FileData> {
  const file = await drive.files.get({ fileId });
  return file.data;
}

// Avoid
function fetchFile(fileId: string): Promise<FileData> {
  return drive.files.get({ fileId }).then(file => file.data);
}

// Parallel operations
const [file, metadata] = await Promise.all([
  drive.files.get({ fileId }),
  drive.files.get({ fileId, fields: 'metadata' })
]);
```

### Performance Patterns

#### Caching Implementation
```typescript
// Consistent caching pattern
async function getCachedData<T>(
  key: string,
  fetcher: () => Promise<T>
): Promise<T> {
  // 1. Check cache
  const cached = await cacheManager.get(key);
  if (cached) {
    performanceMonitor.recordCacheHit();
    return cached as T;
  }

  // 2. Fetch data
  performanceMonitor.recordCacheMiss();
  const data = await fetcher();

  // 3. Store in cache
  await cacheManager.set(key, data);

  return data;
}
```

#### Performance Tracking
```typescript
// Standard performance tracking wrapper
async function trackPerformance<T>(
  operation: string,
  fn: () => Promise<T>
): Promise<T> {
  const startTime = Date.now();

  try {
    const result = await fn();
    performanceMonitor.track(operation, Date.now() - startTime);
    return result;
  } catch (error) {
    performanceMonitor.track(operation, Date.now() - startTime, true);
    throw error;
  }
}
```

### Testing Standards

#### Test Organization
```typescript
// Test file naming: *.test.ts or *.spec.ts
AuthManager.test.ts

// Test structure
describe('AuthManager', () => {
  let authManager: AuthManager;

  beforeEach(() => {
    authManager = new AuthManager();
  });

  describe('initialize', () => {
    it('should load tokens successfully', async () => {
      // Arrange
      const mockTokens = { access_token: 'test' };

      // Act
      await authManager.initialize();

      // Assert
      expect(authManager.isAuthenticated()).toBe(true);
    });

    it('should handle missing tokens gracefully', async () => {
      // Test error cases
    });
  });
});
```

### Documentation Standards

#### JSDoc Comments
```typescript
/**
 * Manages OAuth2 authentication for Google APIs
 * @class AuthManager
 * @example
 * const auth = new AuthManager(clientId, clientSecret);
 * await auth.initialize();
 */
export class AuthManager {
  /**
   * Refreshes the access token using the stored refresh token
   * @returns {Promise<void>} Resolves when token is refreshed
   * @throws {AuthenticationError} When refresh token is invalid
   */
  async refreshAccessToken(): Promise<void> {
    // Implementation
  }
}
```

#### Inline Comments
```typescript
// Use comments to explain "why", not "what"
// Good: Explains business logic
// Google Sheets has a different export limit than other services
const MAX_SHEET_CELLS = 5_000_000;

// Avoid: States the obvious
// Set variable to 5
const retries = 5;
```

### MCP-Specific Standards

#### Tool Implementation Pattern
```typescript
// Standard tool implementation structure
case "toolName": {
  // 1. Input validation
  if (!args || !args.requiredParam) {
    throw new Error('requiredParam is required');
  }

  // 2. Performance tracking start
  const startTime = Date.now();

  try {
    // 3. Cache check
    const cacheKey = `tool:${JSON.stringify(args)}`;
    const cached = await cacheManager.get(cacheKey);
    if (cached) {
      performanceMonitor.track('toolName', Date.now() - startTime);
      return cached;
    }

    // 4. Main operation
    const result = await performToolOperation(args);

    // 5. Cache result
    await cacheManager.set(cacheKey, result);

    // 6. Return MCP-formatted response
    return {
      content: [{
        type: "text",
        text: JSON.stringify(result, null, 2)
      }]
    };
  } catch (error) {
    // 7. Error handling
    performanceMonitor.track('toolName', Date.now() - startTime, true);
    throw error;
  }
}
```

#### Response Formatting
```typescript
// Consistent MCP response format
interface MCPResponse {
  content: Array<{
    type: "text" | "image" | "resource";
    text?: string;
    data?: string;
    mimeType?: string;
  }>;
}

// Helper function for formatting
function formatMCPResponse(data: any, type: string = "text"): MCPResponse {
  return {
    content: [{
      type,
      text: typeof data === 'string' ? data : JSON.stringify(data, null, 2)
    }]
  };
}
```

### Logging Standards

#### Structured Logging
```typescript
// Use consistent log structure
logger.info('Operation completed', {
  operation: 'fetchFile',
  fileId: 'abc123',
  duration: 150,
  timestamp: new Date().toISOString()
});

// Error logging with context
logger.error('Operation failed', {
  operation: 'fetchFile',
  error: error.message,
  stack: error.stack,
  context: {
    fileId: 'abc123',
    userId: 'user456'
  }
});
```

### Security Standards

#### Token Handling
```typescript
// Never log sensitive data
// Bad
logger.info('Token refreshed', { token: accessToken });

// Good
logger.info('Token refreshed', {
  tokenType: 'access',
  expiresIn: 3600
});

// Always encrypt stored credentials
const encrypted = crypto.createCipher('aes-256-gcm', key);
```

#### Input Validation
```typescript
// Validate all external inputs
function validateFileId(fileId: string): void {
  if (!fileId || typeof fileId !== 'string') {
    throw new Error('Invalid file ID');
  }

  // Google Drive file ID pattern
  if (!/^[a-zA-Z0-9_-]+$/.test(fileId)) {
    throw new Error('Invalid file ID format');
  }
}
```

### Code Quality Rules

#### Complexity Limits
- Maximum function length: 50 lines
- Maximum file length: 500 lines
- Cyclomatic complexity: < 10
- Maximum parameters: 4 (use objects for more)

#### Import Organization
```typescript
// Order: External -> Internal -> Types
// 1. Node built-ins
import * as fs from 'fs';
import * as path from 'path';

// 2. External packages
import { OAuth2Client } from 'google-auth-library';
import { drive_v3 } from 'googleapis';

// 3. Internal modules
import { AuthManager } from './auth/AuthManager';
import { logger } from './utils/logger';

// 4. Types
import type { TokenData, AuthState } from './types';
```

### Git Commit Standards

#### Commit Message Format
```
<emoji> <type>: <description>

[optional body]

[optional footer]
```

#### Common Types
- ✨ feat: New feature
- 🐛 fix: Bug fix
- 📝 docs: Documentation
- 🎨 style: Code style
- ♻️ refactor: Code refactoring
- ✅ test: Testing
- 🔧 chore: Maintenance

### Review Checklist

Before submitting code:
- [ ] All tests pass
- [ ] No TypeScript errors
- [ ] Follows naming conventions
- [ ] Proper error handling
- [ ] Performance tracking added
- [ ] Logging implemented
- [ ] Documentation updated
- [ ] Security considerations addressed

---

## Configuration Management

### TypeScript Configuration
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

---

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

---

## Version Management

### Semantic Versioning
- Current Version: 0.6.2
- Following semver principles
- Breaking changes in major versions only

### Dependency Updates
- Regular security updates
- Compatibility testing before major updates
- Lock file maintained (package-lock.json)

---

*This architecture document is maintained as the single source of truth for the Google Drive MCP Server system design. Last updated: 2025-12-23*
