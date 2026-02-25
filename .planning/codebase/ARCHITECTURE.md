# Architecture

**Analysis Date:** 2026-02-25

## Pattern Overview

**Overall:** Operation-based modular dispatch behind a single MCP stdio server

**Key Characteristics:**
- Central request routing in `index.ts` using MCP request schemas
- Service-specific business logic isolated under `src/modules/{drive,sheets,forms,docs,gmail,calendar}/`
- Shared operational context (`logger`, API client, cache, perf monitor) passed into every module function

## Layers

**MCP Transport Layer:**
- Purpose: Expose resources and tools over stdio MCP transport
- Location: `index.ts`
- Contains: `Server` setup, `ListResources`, `ReadResource`, `ListTools`, `CallTool` handlers
- Depends on: `@modelcontextprotocol/sdk`
- Used by: Any MCP client process

**Dispatch and Orchestration Layer:**
- Purpose: Route `{tool, operation, params}` to module functions
- Location: `index.ts`
- Contains: Dynamic `import()` dispatch switches for all six service tools
- Depends on: `src/modules/*`, auth/cache/perf singletons
- Used by: MCP tool calls

**Domain Operations Layer:**
- Purpose: Implement concrete Google Workspace operations
- Location: `src/modules/*`
- Contains: Typed option/result interfaces and operation functions (for example `src/modules/drive/search.ts`, `src/modules/calendar/create.ts`)
- Depends on: Google API clients passed through context and shared `src/modules/types.ts`
- Used by: Dispatch layer

**Authentication and Token Lifecycle Layer:**
- Purpose: OAuth initialization, encrypted token persistence, proactive refresh, key rotation
- Location: `src/auth/AuthManager.ts`, `src/auth/TokenManager.ts`, `src/auth/KeyRotationManager.ts`, `src/auth/KeyDerivation.ts`
- Contains: Singleton managers and credential state machine
- Depends on: `google-auth-library`, Node crypto/fs APIs
- Used by: Server startup and auth CLI flows in `index.ts`

**Support Utilities Layer:**
- Purpose: Progressive tool discovery and health diagnostics
- Location: `src/tools/listTools.ts`, `src/health-check.ts`
- Contains: Static operation map resource and OAuth/token health checks
- Depends on: auth/token managers and runtime env config
- Used by: MCP resource reads and health CLI mode

## Data Flow

**Server Startup Flow:**
1. Parse CLI mode in `index.ts` (`auth`, `health`, `rotate-key`, `migrate-tokens`, `verify-keys`, default serve)
2. Load OAuth keys and initialize auth/token managers (`index.ts`, `src/auth/AuthManager.ts`)
3. Connect optional Redis cache in `CacheManager.connect()` (`index.ts`)
4. Start stdio transport with `server.connect(new StdioServerTransport())` (`index.ts`)

**Tool Execution Flow:**
1. MCP client calls one of six tools declared in `ListToolsRequestSchema` handler (`index.ts`)
2. Router extracts `operation` + `params` and builds execution context (`index.ts`)
3. Router dynamically imports module barrel (`src/modules/*/index.ts`)
4. Operation function executes API call, cache interaction, perf tracking, and returns typed result (`src/modules/*/*.ts`)
5. Router serializes result as text payload to MCP response (`index.ts`)

**State Management:**
- Authentication state: `AuthState` enum and OAuth2 client state in `src/auth/AuthManager.ts`
- Token persistence: encrypted local file storage in `src/auth/TokenManager.ts`
- Cache state: Redis-backed or disabled fallback in `index.ts`

## Key Abstractions

**Operation Context:**
- Purpose: Normalize dependencies for module operations
- Examples: `DriveContext`, `SheetsContext`, `GmailContext` in `src/modules/types.ts`
- Pattern: context-injected functional operations

**Operation Barrels:**
- Purpose: Group exports per domain for router consumption
- Examples: `src/modules/drive/index.ts`, `src/modules/sheets/index.ts`
- Pattern: barrel re-export with typed option/result contracts

## Entry Points

**Main MCP Server:**
- Location: `index.ts`
- Triggers: `node dist/index.js`
- Responsibilities: Startup/auth/cache/tool routing

**Health Check CLI:**
- Location: `src/health-check.ts`
- Triggers: `node dist/index.js health`
- Responsibilities: Token and refresh capability checks

**Operational CLI Commands:**
- Location: `index.ts`
- Triggers: `auth`, `rotate-key`, `migrate-tokens`, `verify-keys`
- Responsibilities: Credential bootstrap and security maintenance

## Error Handling

**Strategy:** Fail fast with explicit errors, log structured context, and propagate to MCP caller

**Patterns:**
- Throw `Error` on invalid params/unknown operations in `index.ts` and `src/modules/*`
- Serialize unknown errors through helper patterns (for example `toErrorMessage` in `src/modules/types.ts` and handler files)
- Record failure metrics via `performanceMonitor.track(..., true)` in `index.ts`

## Cross-Cutting Concerns

**Logging:** Winston structured logging in `index.ts`
**Validation:** Runtime guards in module operations plus schema-based handlers in `src/*/*-schemas.ts`
**Authentication:** OAuth2 + encrypted token lifecycle in `src/auth/*`

---

*Architecture analysis: 2026-02-25*
