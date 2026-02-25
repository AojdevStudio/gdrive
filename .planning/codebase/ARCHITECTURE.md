# Architecture

**Analysis Date:** 2026-01-25

## Pattern Overview

**Overall:** MCP Server with Operation-Based Tool Architecture (v3.1.0+)

**Key Characteristics:**
- Operation-based dynamic dispatch (single tool per API service with operation parameter)
- Modular service-oriented architecture with independent API handlers
- Context injection pattern for cross-cutting concerns (logging, caching, performance monitoring)
- Progressive disclosure for tool discovery via resource-based API documentation
- Layered architecture: MCP transport layer → tool dispatch → modular service layer → Google APIs

## Layers

**MCP Server Layer:**
- Purpose: Handle MCP protocol requests and responses, authentication gating
- Location: `index.ts` (lines 385-833)
- Contains: Server initialization, request handlers (ListResources, ReadResource, ListTools, CallTool)
- Depends on: MCP SDK, Authentication layer
- Used by: Claude instances via stdio transport

**Tool Dispatch Layer:**
- Purpose: Route tool calls to appropriate modules based on operation parameter
- Location: `index.ts` (lines 581-833, `CallToolRequestSchema` handler)
- Contains: Operation-based switch statements for drive, sheets, forms, docs, gmail, calendar
- Depends on: Module layer
- Used by: MCP Server layer

**Module Layer (Service Abstraction):**
- Purpose: Provide domain-specific operations organized by Google Workspace API
- Location: `src/modules/{drive,sheets,forms,docs,gmail,calendar}/`
- Contains: CRUD operations, domain-specific logic, type definitions
- Depends on: Google APIs via context, Cache manager, Performance monitor
- Used by: Tool dispatch layer, or directly by code execution contexts

**Google API Layer:**
- Purpose: Provide direct access to Google APIs
- Location: `index.ts` (lines 89-94, googleapis client initialization)
- Contains: googleapis library instances (drive, sheets, forms, docs, gmail, calendar)
- Depends on: OAuth2 authentication
- Used by: Module layer operations

**Cross-Cutting Services Layer:**
- Purpose: Provide shared utilities for caching, logging, performance monitoring, authentication
- Location: `src/auth/` (AuthManager, TokenManager), `index.ts` (CacheManager, PerformanceMonitor, Logger)
- Contains: Authentication state management, token encryption/rotation, Redis caching, Winston logging
- Depends on: Environment configuration, filesystem (credentials)
- Used by: All layers

## Data Flow

**Discovery Flow:**
1. Agent calls `ListResources` → Returns `gdrive://tools` resource reference
2. Agent calls `ReadResource(gdrive://tools)` → Returns hardcoded tool structure from `src/tools/listTools.ts`
3. Agent reads JSON response containing all available modules and operations

**Operation Execution Flow:**

1. Agent calls `CallTool` with `{tool: "drive", operation: "search", params: {...}}`
2. Server `CallToolRequestSchema` handler (line 582):
   - Validates authentication state
   - Builds context object (logger, API clients, cache, monitor)
   - Dynamically imports module: `await import('./src/modules/drive/index.js')`
3. Switch statement routes to operation: `driveModule.search(params, context)`
4. Operation executes with injected context:
   - Checks cache via `context.cacheManager.get()`
   - Calls Google API via `context.drive.files.list()`
   - Stores result in cache via `context.cacheManager.set()`
   - Tracks performance via `context.performanceMonitor.track()`
5. Result serialized to JSON and returned to client

**Authentication Flow:**

1. On startup: `loadCredentialsAndRunServer()` (line 893)
2. Load OAuth keys from `gcp-oauth.keys.json`
3. Initialize `AuthManager.getInstance()` (singleton)
4. `authManager.initialize()` loads encrypted tokens from `TokenManager`
5. `authManager.startTokenMonitoring()` watches for expiration
6. `oauth2Client` set as global auth for all googleapis calls
7. Proactive refresh triggered before expiration via `authManager.handleTokenUpdate()`

## Key Abstractions

**Module Operations:**
- Purpose: Encapsulate domain logic for single API operations
- Examples: `src/modules/drive/search.ts`, `src/modules/sheets/update.ts`, `src/modules/calendar/create.ts`
- Pattern: Each operation function accepts typed options and context, returns typed result
- Signature: `async function operationName(options: OperationOptions, context: TypedContext): Promise<OperationResult>`

**Context Objects:**
- Purpose: Inject dependencies without function signature bloat
- Examples: `DriveContext`, `SheetsContext`, `CalendarContext` from `src/modules/types.ts`
- Pattern: Extends `BaseContext` with specific API client (drive, sheets, gmail, etc.)
- Contains: `logger`, `drive/sheets/forms/docs/gmail/calendar` API client, `cacheManager`, `performanceMonitor`, `startTime`

**Cache Manager:**
- Purpose: Abstract Redis caching layer with graceful fallback
- Pattern: Get/Set/Invalidate interface, JSON serialization, TTL support (5 minutes default)
- Location: `index.ts` lines 282-377
- Feature: Automatic fallback if Redis unavailable (continues without cache)

**Performance Monitor:**
- Purpose: Track operation metrics for observability
- Pattern: Track operation name, duration, error status; aggregate statistics
- Location: `index.ts` lines 233-273
- Output: Logs performance stats every 30 seconds to Winston logger

**Token Manager:**
- Purpose: Secure token storage with encryption and key rotation
- Location: `src/auth/TokenManager.ts`
- Pattern: Singleton, AES-256 encryption, support for multiple key versions
- Features: Automatic key rotation, migration from legacy formats, token expiry validation

**Auth Manager:**
- Purpose: OAuth2 lifecycle management and token refresh
- Location: `src/auth/AuthManager.ts`
- Pattern: Singleton, state machine (UNAUTHENTICATED → AUTHENTICATED → TOKEN_EXPIRED)
- Features: Proactive token refresh, token event listener, automatic credential updates

## Entry Points

**Main Server:**
- Location: `index.ts`
- Triggers: `node dist/index.js` (default mode)
- Responsibilities: Initialize auth, connect Redis, start MCP server on stdio

**Authentication:**
- Location: `index.ts`
- Triggers: `node dist/index.js auth`
- Responsibilities: Launch browser OAuth flow, save encrypted credentials

**Health Check:**
- Location: `index.ts`
- Triggers: `node dist/index.js health`
- Responsibilities: Verify token validity, check refresh capability, return JSON status

**Key Management:**
- Location: `index.ts`
- Triggers: `node dist/index.js rotate-key`, `migrate-tokens`, `verify-keys`
- Responsibilities: Rotate encryption keys, migrate legacy formats, validate stored tokens

## Error Handling

**Strategy:** Defensive with detailed logging

**Patterns:**
- Authentication gating on all tool operations (line 586: check `authManager.getState() === AuthState.AUTHENTICATED`)
- Try-catch in all handlers with error serialization via Winston (lines 123-168)
- Operation-level error handling: operations catch Google API errors and return structured results
- Graceful degradation: Redis failures don't block operations (line 315-317)
- Exit on critical failures: Missing OAuth keys, encryption keys, token decrypt failures

## Cross-Cutting Concerns

**Logging:**
- Winston logger with file rotation (error.log, combined.log) and console output
- Configured via `LOG_LEVEL` environment variable (default: info)
- All errors serialized with stack traces and context metadata
- Metrics logged every 30 seconds

**Validation:**
- No centralized validator; per-operation parameter validation in module files
- AuthState validation on every tool call (line 586-588)
- Token expiry validation in TokenManager (isTokenExpired())
- OAuth key format validation on startup (line 913-915)

**Authentication:**
- OAuth2 client initialized once per process (line 932: `google.options({ auth: oauth2Client })`)
- All googleapis calls inherit auth automatically
- Token refresh handled transparently via OAuth2Client event listener (lines 56-66)
- Encrypted storage with GDRIVE_TOKEN_ENCRYPTION_KEY environment variable

**Caching:**
- Redis connection attempted on startup (line 938: `cacheManager.connect()`)
- Operations check cache before API calls (see search.ts line 54-59)
- Cache invalidated on write operations (batch operations line 635)
- Pattern: `cache_key = "${operation}:${unique_params}"`

**Performance Monitoring:**
- Operation-level timing tracked (lines 239-272)
- Metrics: count, totalTime, error rate per operation
- Cache hits/misses tracked separately
- Statistics logged every 30 seconds with memory usage

---

*Architecture analysis: 2026-01-25*
