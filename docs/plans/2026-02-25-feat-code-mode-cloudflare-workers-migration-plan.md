---
title: "Code Mode MCP + Cloudflare Workers Migration"
type: feat
status: active
date: 2026-02-25
origin: docs/brainstorms/2026-02-25-code-mode-streamable-http-brainstorm.md
---

# Code Mode MCP + Cloudflare Workers Migration

## Overview

Transform the gdrive MCP server (v3.3.0) from a local stdio-based tool server with 6 operation-based tools (47 operations) into a **Cloudflare Workers-native Code Mode MCP server** with 2 tools: `search()` and `execute()`. This achieves ~99.9% token reduction while enabling remote deployment via Streamable HTTP transport. Version bump to **v4.0.0** (semver-correct breaking change).

## Problem Statement / Motivation

### Current Pain Points

1. **Token bloat**: 6 tools with 47 operation schemas consume significant context window in AI agent workflows. Each tool registration sends full input schemas to the model.
2. **Local-only deployment**: stdio transport requires local process management (Docker or direct Node). No remote access from cloud-hosted agents.
3. **Node-specific lock-in**: Dependencies on `@google-cloud/local-auth`, `isolated-vm`, `fs`-based token storage, and Redis prevent cloud-native deployment.
4. **Operational overhead**: Docker compose, local credential files, Redis setup for caching.

### Why Code Mode Solves This

Code Mode (Cloudflare's pattern) collapses the entire API surface into 2 tools:
- `search()` — agents write JavaScript to query a typed SDK spec, discovering available operations without loading the full schema into context (~1,000 tokens fixed vs 100K+ for 47 schemas)
- `execute()` — agents write JavaScript against a typed SDK to call Google Workspace APIs within a V8 sandbox

Combined with Cloudflare Workers deployment, this eliminates local infrastructure entirely.

## Proposed Solution

Two-phase migration (see brainstorm: `docs/brainstorms/2026-02-25-code-mode-streamable-http-brainstorm.md`):

- **Phase 1 (v4.0.0-alpha):** Implement Code Mode locally on Node runtime, validate the `search()`/`execute()` pattern with existing `isolated-vm` sandbox
- **Phase 2 (v4.0.0):** Deploy to Cloudflare Workers with native V8 isolates, Workers KV storage, and Streamable HTTP transport

### Why Not Incremental (Node HTTP First)

The original migration plan (`docs/planning/streamable-http-cloudflare-migration.md`) recommended adding HTTP transport on Node as a stepping stone. We skip this because (see brainstorm):
1. Workers-native is the destination — intermediate Node HTTP is throwaway work
2. Code Mode's V8 sandbox is native to Workers — no `isolated-vm` bridge needed
3. Single-user deployment simplifies auth (no multi-tenant OAuth flows)

## Technical Approach

### Architecture

#### Current Architecture (v3.3.0)

```
MCP Client (Claude Desktop, etc.)
    │ stdio (JSON-RPC)
    ▼
index.ts (37KB monolith)
    ├── ListToolsRequestSchema → 6 tools × {operation, params} schemas
    ├── CallToolRequestSchema → switch(name) → switch(operation) → module handler
    ├── AuthManager + TokenManager (filesystem)
    ├── Redis cache (optional)
    └── src/modules/{drive,sheets,forms,docs,gmail,calendar}/ (47 operations)
```

#### Target Architecture (v4.0.0)

```
MCP Client (any, remote)
    │ Streamable HTTP (POST/GET/DELETE on /mcp)
    ▼
Cloudflare Worker (fetch handler)
    ├── ListToolsRequestSchema → 2 tools: search(), execute()
    ├── CallToolRequestSchema → search: query SDK spec | execute: run in V8 isolate
    ├── Typed SDK (auto-generated from 47 operation schemas)
    │   ├── sdk.drive.search(), sdk.drive.read(), sdk.drive.createFile()...
    │   ├── sdk.sheets.readSheet(), sdk.sheets.updateCells()...
    │   ├── sdk.gmail.sendMessage(), sdk.gmail.searchMessages()...
    │   ├── sdk.forms.createForm(), sdk.forms.readForm()...
    │   ├── sdk.docs.createDocument(), sdk.docs.insertText()...
    │   └── sdk.calendar.createEvent(), sdk.calendar.listEvents()...
    ├── OAuth token refresh (refresh token as Worker secret)
    ├── Workers KV (token storage + cache, replaces Redis + fs)
    └── Bearer token + origin allowlist (security)
```

#### SDK Interaction Flow

```
Agent writes:  search("drive operations for searching files")
    → Returns: { drive: { search: { signature, description, example }, enhancedSearch: {...} } }

Agent writes:  execute(`
    const results = await sdk.drive.search({ query: "Q3 reports", pageSize: 5 });
    return results.files.map(f => f.name);
`)
    → V8 sandbox runs agent code against typed SDK
    → SDK method calls Google Drive API (with built-in rate limiting)
    → Returns: ["Q3 Report Final.docx", "Q3 Revenue.xlsx", ...]
```

### Implementation Phases

#### Phase 1: Code Mode on Node (Local) — v4.0.0-alpha

**Goal:** Validate the Code Mode pattern (search + execute) on the existing Node runtime before migrating infrastructure.

##### 1.1 Auto-Generate Typed SDK

> **Recommended Skills:**
> - `@Research` (quick mode) — Research `@cloudflare/codemode` SDK generation patterns and `zod-to-json-schema` best practices before writing the generator script
> - `@CreateCLI` — `scripts/generate-sdk.ts` is a CLI tool; use CreateCLI patterns for argument parsing and output formatting

- **Input:** Existing 47 operation function signatures and TypeScript types from `src/modules/`
- **Output:** A typed SDK spec object and runtime SDK for sandbox execution
- **Structure:** Namespace by service — `sdk.drive.*`, `sdk.sheets.*`, `sdk.gmail.*`, `sdk.forms.*`, `sdk.docs.*`, `sdk.calendar.*`

**SDK Spec Object** (for `search()` discovery):
```typescript
// src/sdk/spec.ts — static metadata, no execution code
export const SDK_SPEC = {
  drive: {
    search: {
      signature: "search(options: { query: string, pageSize?: number, pageToken?: string }): Promise<SearchResult>",
      description: "Search Google Drive for files matching query",
      example: 'await sdk.drive.search({ query: "Q3 reports", pageSize: 10 })',
      params: { query: "string (required)", pageSize: "number (optional, default 100)", pageToken: "string (optional)" },
      returns: "{ files: DriveFile[], nextPageToken?: string }"
    },
    // ... all 7 drive operations
  },
  sheets: { /* 12 operations */ },
  gmail: { /* 10 operations */ },
  forms: { /* 4 operations */ },
  docs: { /* 5 operations */ },
  calendar: { /* 9 operations */ },
};
```

**SDK Runtime** (for `execute()` sandbox):
```typescript
// src/sdk/runtime.ts — wraps existing module handlers with rate limiting
export function createSDKRuntime(context: FullContext): SDK {
  return {
    drive: {
      search: rateLimited((opts) => driveModule.search(opts, context)),
      read: rateLimited((opts) => driveModule.read(opts, context)),
      // ... all drive operations
    },
    // ... all services
  };
}
```

**Generation approach:** Script reads `src/modules/*/index.ts` exports and their TypeScript type definitions. Generates both the spec (static metadata) and runtime (executable wrappers). Manual review pass optimizes naming and descriptions for agent discovery.

**New files:**
- `src/sdk/spec.ts` — Static SDK spec object for search() tool
- `src/sdk/runtime.ts` — Executable SDK with rate-limited wrappers for execute() tool
- `src/sdk/types.ts` — SDK type definitions
- `src/sdk/rate-limiter.ts` — Per-service rate limiting (delays, queuing)
- `scripts/generate-sdk.ts` — SDK generation script

##### 1.2 Implement search() Tool

> **Recommended Skills:**
> - `@Evals` — Create evaluation cases to verify agent discovery quality (e.g., "can an agent find all sheets operations?"). Code-based grader checks completeness of returned spec data

Agent writes JavaScript that queries the SDK spec object to discover available operations.

```typescript
// Tool registration
{
  name: "search",
  description: "Discover available Google Workspace SDK operations. Write JavaScript to query the spec object.",
  inputSchema: {
    type: "object",
    properties: {
      code: {
        type: "string",
        description: "JavaScript code to search the SDK spec. Available: `spec` object with drive, sheets, gmail, forms, docs, calendar namespaces."
      }
    },
    required: ["code"]
  }
}
```

**Execution:** Agent code runs in `isolated-vm` with only the `SDK_SPEC` object available. No API calls, no side effects. Returns the query result.

**Example agent interactions:**
- `spec.drive` → lists all drive operations
- `Object.keys(spec)` → lists all service namespaces
- `spec.sheets.updateCells` → shows signature, description, params, example for updateCells

##### 1.3 Implement execute() Tool

> **Recommended Skills:**
> - `@systematic-debugging` — When isolated-vm sandbox integration breaks, use systematic-debugging to force root-cause analysis before patching
> - `@Evals` — Eval suite for execute() — test that agent-written JS correctly calls SDK methods, handles errors, and respects sandbox boundaries
> - `@PromptInjection` — Use when writing sandbox escape tests (e.g., `process.exit()`, `require('fs')`, `fetch()`) to verify isolation holds

Agent writes JavaScript that runs against the typed SDK to call Google Workspace APIs.

```typescript
// Tool registration
{
  name: "execute",
  description: "Execute JavaScript against the Google Workspace SDK. Write code using `sdk.{service}.{operation}()` methods.",
  inputSchema: {
    type: "object",
    properties: {
      code: {
        type: "string",
        description: "JavaScript code to execute. Available: `sdk` object with drive, sheets, gmail, forms, docs, calendar namespaces. All methods are async."
      }
    },
    required: ["code"]
  }
}
```

**Execution:** Agent code runs in `isolated-vm` with the full SDK runtime. SDK methods make real Google API calls through existing module handlers. Built-in rate limiting prevents quota exhaustion.

**Sandbox boundaries:**
- Agent code CAN: call any `sdk.*` method, use JavaScript built-ins, async/await
- Agent code CANNOT: access `fs`, `process`, `require`, network directly, or escape the V8 isolate
- SDK methods handle: auth, rate limiting, error formatting, caching (transparent to agent)

##### 1.4 Remove Legacy Tools

> **Recommended Skills:**
> - `@RepoArchitect` — Validate the new `src/server/{bootstrap,factory,transports/}` directory structure against framework archetypes and naming conventions
> - `@GitWorkflow` — Breaking change (v4.0.0-alpha) requires proper branching strategy, conventional commits, and changelog entries

- Remove the 6 tool registrations from `ListToolsRequestSchema` handler (`index.ts:460-578`)
- Remove the `CallToolRequestSchema` switch dispatch (`index.ts:582+`)
- Replace with search/execute handlers
- Keep `src/modules/` intact — they become the SDK's internal implementation
- Keep `gdrive://tools` resource as optional fallback discovery mechanism

##### 1.5 Bootstrap Refactor

Extract reusable functions from the `index.ts` monolith (pattern from existing migration plan):
- `initializeRuntime()` — env checks, auth manager, token manager, cache setup
- `createConfiguredServer()` — fresh MCP Server instance with search/execute tools registered
- `runStdioServer()` — current stdio transport (kept for Phase 1 local testing)

**Refactored files:**
- `src/server/bootstrap.ts` — initializeRuntime()
- `src/server/factory.ts` — createConfiguredServer()
- `src/server/transports/stdio.ts` — runStdioServer()
- `index.ts` — thin entry point calling the above

#### Phase 2: Cloudflare Workers Deployment — v4.0.0

**Goal:** Deploy the validated Code Mode server to Cloudflare Workers with Streamable HTTP.

##### 2.1 Replace isolated-vm with @cloudflare/codemode DynamicWorkerExecutor

> **Recommended Skills:**
> - `@Cloudflare` — Workers deployment workflows, wrangler config, and KV namespace setup
> - `@Research` (standard mode) — Research `@cloudflare/codemode` DynamicWorkerExecutor API, compatibility constraints, and `env.LOADER` patterns

The `@cloudflare/codemode` package (v0.1.0, Feb 2026) provides a purpose-built sandbox for Code Mode:

```typescript
import { DynamicWorkerExecutor } from "@cloudflare/codemode";
import { createCodeTool } from "@cloudflare/codemode/ai";

const executor = new DynamicWorkerExecutor({ loader: env.LOADER });
const codemode = createCodeTool({ tools: sdkMethods, executor });
```

**Properties:**
- `DynamicWorkerExecutor` runs agent code in a Dynamic Worker (V8 isolate)
- Configurable timeout (default 30s)
- Console capture (`console.log/warn/error` returned in `ExecuteResult.logs`)
- Network isolation (`globalOutbound: null` blocks fetch/connect)
- Implements the `Executor` interface — same interface can be implemented for Phase 1's `isolated-vm`

**Approach:**
- Define an `Executor` interface in Phase 1 with an `isolated-vm` implementation
- Phase 2 swaps to `DynamicWorkerExecutor` — same interface, different runtime
- `createCodeTool` generates the MCP tool definitions automatically

**Key files:**
- `src/sdk/executor.ts` — Executor interface (shared)
- `src/sdk/sandbox-node.ts` — Phase 1 isolated-vm implementation
- `src/sdk/sandbox-workers.ts` — Phase 2 DynamicWorkerExecutor wrapper

##### 2.2 Replace Filesystem Storage with Workers KV

> **Recommended Skills:**
> - `@Cloudflare` — KV namespace creation, binding configuration, and TTL patterns

| Current | Workers KV Key Pattern | TTL |
|---------|----------------------|-----|
| `credentials/.gdrive-server-credentials.json` | `tokens:credentials` | None (permanent) |
| `credentials/.gdrive-server-token.json` | `tokens:oauth` | None (refresh on expiry) |
| Redis cache entries | `cache:{service}:{operation}:{hash}` | 300s (configurable) |

**Encryption:** Tokens stored in KV are encrypted using a Worker secret (`TOKEN_ENCRYPTION_KEY`). Same encryption pattern as current `TokenManager` but using Web Crypto API instead of Node crypto.

**New files:**
- `src/storage/kv-store.ts` — Workers KV adapter implementing `TokenStore` and `CacheManager` interfaces

##### 2.3 Replace Redis with Workers KV

Workers KV replaces Redis for caching. Same interface (`CacheManagerLike` from `src/modules/types.ts`), different backend.

**KV characteristics:**
- 25ms global reads (comparable to Redis)
- TTL support via KV `expirationTtl` parameter
- Eventual consistency (acceptable for cache — same as Redis in distributed setup)
- No connection management (unlike Redis client)

##### 2.4 Auth: Refresh Token as Worker Secret

> **Recommended Skills:**
> - `@WebAssessment` — Security assessment of the token refresh flow: validate no token leakage in logs, KV encryption correctness, and bearer token implementation

**Setup flow (one-time, on developer machine):**
1. Run existing `node dist/index.js auth` locally → browser OAuth → refresh token saved
2. Extract refresh token from saved credentials
3. `wrangler secret put GOOGLE_REFRESH_TOKEN` → stored as Worker secret
4. `wrangler secret put GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`

**Runtime flow (on every Worker request):**
1. Worker reads refresh token from secret
2. Checks KV for cached access token → if valid, use it
3. If expired: POST to `https://oauth2.googleapis.com/token` with refresh token
4. Cache new access token in KV with TTL matching token lifespan (3600s)
5. Pass access token to googleapis calls

**New files:**
- `src/auth/workers-auth.ts` — Token refresh via Google's token endpoint, no local-auth dependency

##### 2.5 Streamable HTTP Transport

> **Recommended Skills:**
> - `@Browser` — Verify the Streamable HTTP endpoint by testing POST/GET/DELETE on /mcp with MCP Inspector. Screenshot-based verification
> - `@compound-engineering:agent-native-architecture` — The search()/execute() pattern is agent-native MCP architecture; use this skill for MCP tool design patterns for autonomous agents

Use `WebStandardStreamableHTTPServerTransport` from `@modelcontextprotocol/sdk` (already in dependencies).

**Worker fetch handler:**
```typescript
// worker.ts
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Bearer token validation
    if (env.MCP_BEARER_TOKEN) {
      const auth = request.headers.get("Authorization");
      if (auth !== `Bearer ${env.MCP_BEARER_TOKEN}`) {
        return new Response(JSON.stringify({
          jsonrpc: "2.0", error: { code: -32001, message: "Unauthorized" }, id: null
        }), { status: 401 });
      }
    }

    // Stateless: fresh server + transport per request (SDK constraint)
    const server = createConfiguredServer(env);
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });

    await server.connect(transport);
    return transport.handleRequest(request);
  }
};
```

**Recommended:** Use `createMcpHandler` from `@cloudflare/agents` (stateless, no Durable Objects):

```typescript
import { createMcpHandler } from "agents/mcp";

export default {
  fetch: createMcpHandler(server, {
    route: "/mcp",
    authContext: async (req) => validateBearerToken(req, env),
  }),
};
```

**Why `createMcpHandler` over `McpAgent`:**
- Stateless — cheaper, simpler, no Durable Object billing
- `WorkerTransport` handles Streamable HTTP automatically
- Optional `authContext` for bearer token validation
- This server's operations are inherently stateless per-request (cache via KV)
- `McpAgent` with Durable Objects is overkill for single-user tool

##### 2.6 Deployment Configuration

> **Recommended Skills:**
> - `@Cloudflare` — wrangler.toml configuration, secrets management, and deploy workflows

**`wrangler.toml`:**
```toml
name = "gdrive-mcp"
main = "dist/worker.js"
compatibility_date = "2026-02-01"

[[kv_namespaces]]
binding = "GDRIVE_KV"
id = "<kv-namespace-id>"

[vars]
LOG_LEVEL = "info"
```

**Secrets (via `wrangler secret put`):**
- `GOOGLE_REFRESH_TOKEN`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `TOKEN_ENCRYPTION_KEY`
- `MCP_BEARER_TOKEN`

**New files:**
- `wrangler.toml` — Worker configuration
- `worker.ts` — Worker entry point (fetch handler)
- `src/server/transports/streamable-http.ts` — Transport setup

##### 2.7 googleapis Compatibility

> **Recommended Skills:**
> - `@Science` — The googleapis compatibility question (option 1 vs 2 vs 3) is a hypothesis-test problem. Structure the experiment: try `nodejs_compat` first, measure, fall back if needed

The `googleapis` npm package (15MB+) has Node-specific transports that may fail on Workers.

**Three options (evaluate in order during implementation):**

1. **`nodejs_compat` flag + `gtoken` override (try first):**
   With `compatibility_date >= "2024-09-23"` and `nodejs_compat` flag, Workers support `node:crypto`. Community pattern overrides `gtoken` with a Web Crypto-compatible fork:
   ```json
   { "overrides": { "gtoken": "github:BjornTheProgrammer/node-gtoken" } }
   ```
   This may allow the full `googleapis` SDK to work. **Test thoroughly** — credential file loading via `node:fs` will still fail (pass credentials programmatically).

2. **Direct REST calls with Web Crypto auth (most robust):**
   Replace `googleapis` with direct `fetch()` calls to Google REST APIs. Use Web Crypto for JWT signing and token refresh. Zero Node dependencies.
   ```typescript
   const resp = await fetch(`https://www.googleapis.com/drive/v3/files?q=${query}`, {
     headers: { Authorization: `Bearer ${accessToken}` }
   });
   ```

3. **Hybrid:** Use `googleapis` for Phase 1 (Node), option 2 for Phase 2 (Workers). Create an adapter interface so module handlers work with either backend.

**Recommendation:** Try option 1 first (lowest effort). Fall back to option 2 if incompatibilities surface. The adapter interface (option 3) is good insurance regardless.

##### 2.8 SDK Generation Pipeline

Leverage existing Zod schemas in `src/drive/drive-schemas.ts`, `src/sheets/sheets-schemas.ts`, etc.:

```
Zod schemas (existing) → zod-to-json-schema → TypeScript declarations → SDK spec + runtime
```

Tools: `zod-to-json-schema`, `json-schema-to-typescript`, or `@asteasolutions/zod-to-openapi` for OpenAPI spec generation.

**Integration with `@cloudflare/codemode`:** If using `createCodeTool`, the SDK spec can be derived from an OpenAPI document. The `search()` tool queries the spec with pre-resolved `$ref`s.

## Open Design Decisions (from SpecFlow Analysis)

The following critical design questions were surfaced by flow analysis and must be resolved during implementation. Default assumptions are provided.

### OD-1: execute() Tool Contract (Critical — Blocks Implementation)

| Aspect | Decision |
|--------|----------|
| **Sandbox globals** | `sdk` (runtime), `console` (debug logging captured and returned), `JSON`, `Date`, `Math`, `Promise`. No `fetch`, `require`, `process`, `setTimeout`. |
| **Async support** | Full async/await. Agent code can chain multiple SDK calls in a single `execute()`. |
| **Timeout** | Phase 1: 10s (isolated-vm config). Phase 2: 30s (Workers CPU limit). |
| **Memory limit** | Phase 1: 128MB (isolated-vm config). Phase 2: Workers default (128MB). |
| **Return value** | Last expression auto-returned. `JSON.stringify()` serialization. Non-serializable values (circular refs) throw clear error. |
| **Error format** | Structured: `{ error: true, message: string, line?: number, stack?: string }`. Google API errors preserved verbatim (e.g., `{ code: 403, message: "..." }`). |
| **Context injection** | Factory pattern: `createSDKRuntime(context)` returns pre-bound methods. Agent code sees only `sdk.drive.search(opts)`, never the context parameter. |

### OD-2: search() Tool Contract (Critical — Blocks Implementation)

| Aspect | Decision |
|--------|----------|
| **Input** | Agent writes JavaScript executed in sandbox with `spec` global (SDK_SPEC object). |
| **Globals available** | `spec` (read-only SDK metadata), `JSON`, `Object`, `Array`. No `sdk` (no execution). |
| **Output** | JavaScript return value, serialized as JSON. |
| **Error handling** | Syntax errors and runtime errors return structured error with line number. |
| **Alternative** | If code-based search proves unreliable with models, add a structured query fallback: `{ module: "drive", operation: "search" }`. |

### OD-3: googleapis on Workers (Critical — Largest Phase 2 Risk)

`googleapis` is 15MB+ with Node-specific transports (`http`, `https`, `stream`). It will NOT work on Workers.

**Decision:** Phase 2 replaces `googleapis` with direct `fetch()` calls to Google REST APIs. This is the largest piece of Phase 2 work.

**Approach:**
1. Create a `src/google-api/` adapter layer with typed fetch wrappers for each Google API
2. Each wrapper takes the same `Options` types as current module handlers
3. Current module handlers are refactored to call the adapter layer (works on both Node and Workers)
4. On Node: adapter uses `googleapis` internally. On Workers: adapter uses `fetch()`.
5. **Or**: Skip the adapter and go directly to `fetch()` for all platforms (cleaner, more work upfront)

**Effort estimate:** ~2-4 days for all 47 operations if going direct `fetch()`.

### OD-4: Workers Logging Replacement

Winston is Node-specific (streams, transports). Workers uses `console.log` routed to Workers Logpush or `wrangler tail`.

**Decision:** Create a lightweight `Logger` interface adapter:
- Phase 1 (Node): Winston (existing)
- Phase 2 (Workers): `console.log` with structured JSON formatting

The `Logger` type from `src/modules/types.ts` remains the contract; implementation swaps at runtime.

### OD-5: Refresh Token Export CLI

The refresh token is AES-256-GCM encrypted in `~/.gdrive-mcp-tokens.json`. No CLI command exists to extract it.

**Decision:** Add `node dist/index.js export-refresh-token` command:
1. Reads encrypted token file
2. Decrypts using configured encryption key
3. Prints raw refresh token to stdout (for piping to `wrangler secret put`)
4. Warns: "This token grants full Google Workspace access. Keep it secret."

### OD-6: Contact Resolution on Workers

`src/modules/calendar/contacts.ts` reads from `PAI_CONTACTS_PATH` (filesystem).

**Decision:** Store contacts JSON in Workers KV under key `config:contacts`. Upload via a setup script or `wrangler kv:put`. The `resolveContact()` function gets a Workers-compatible adapter.

### OD-7: Binary Content in execute() Returns

Current `drive.read()` returns base64 strings for binary files (PNG, PDF). These can be large.

**Decision:** Pass through as base64 strings. Workers has a 25MB response body limit which is sufficient. Add a `maxResponseSize` option to `execute()` that truncates with a warning if exceeded.

### OD-8: Parallel Phase 1 / Phase 2 Operation

Both systems refreshing tokens against the same Google account could invalidate each other's access tokens.

**Decision:** Do NOT run both simultaneously in production. Phase 1 is local development/testing only. Phase 2 deployment replaces Phase 1. If both must coexist temporarily, use separate Google API projects (different client_id/client_secret).

## Alternative Approaches Considered

| Approach | Why Rejected | Reference |
|----------|-------------|-----------|
| **Node HTTP first, Workers later** | Intermediate HTTP on Node is throwaway; Workers-native is destination | (see brainstorm: Key Decision #1) |
| **Dual mode (legacy + Code Mode)** | Adds complexity with no user benefit for single-admin tool | (see brainstorm: Key Decision #2) |
| **Durable Objects instead of KV** | Overkill for single-user key-value storage; KV is simpler and sufficient | (see brainstorm: Key Decision #5) |
| **D1 (SQLite) for storage** | Unnecessary relational capabilities; KV maps directly to current Redis patterns | (see brainstorm: Key Decision #5) |
| **Keep isolated-vm on Workers** | Not compatible with Workers runtime; native V8 isolates are the correct replacement | (see brainstorm: Key Decision #3) |

## System-Wide Impact

### Interaction Graph

**Phase 1 (Code Mode on Node):**
- `search()` tool call → agent JS evaluated in isolated-vm → queries `SDK_SPEC` object → returns spec data
- `execute()` tool call → agent JS evaluated in isolated-vm → calls `sdk.drive.search()` → SDK wrapper calls `driveModule.search()` → Google API call → rate limiter → cache check → response
- Auth flow unchanged (local OAuth + filesystem tokens)
- Cache flow unchanged (Redis optional)

**Phase 2 (Workers):**
- HTTP request → Bearer auth check → origin allowlist → fresh Server + Transport → handle request → tool dispatch
- `execute()` → Workers V8 scope → `sdk.drive.search()` → SDK wrapper → direct Google API `fetch()` → KV cache check → response
- Token refresh: KV lookup → if expired, `fetch()` to Google token endpoint → KV store with TTL
- All filesystem operations eliminated

### Error Propagation

| Error Source | Phase 1 Handling | Phase 2 Handling |
|-------------|-----------------|-----------------|
| Agent code syntax error | isolated-vm throws → caught by execute() → MCP error response | Worker scope throws → caught → MCP error response |
| Google API 429 (rate limit) | SDK rate limiter queues/retries → transparent to agent | Same SDK rate limiter → transparent |
| Google API 401 (token expired) | TokenManager refreshes → retry | Workers auth refreshes via fetch → retry → KV update |
| Agent code timeout | isolated-vm timeout config | Workers CPU time limit (30s default, configurable) |
| KV read failure | N/A (filesystem) | Graceful degradation — skip cache, call API directly |
| Network failure | Node error → MCP error | Workers error → MCP error (Response object) |

### State Lifecycle Risks

- **Phase 1→2 token migration:** Refresh token must be extracted from local filesystem and stored as Worker secret. One-time manual step. If missed, Workers deployment has no auth.
- **KV eventual consistency:** Cached data may be stale by up to 60s globally. Acceptable for cache layer (same risk as distributed Redis).
- **Worker cold start:** First request may be slower (~5-50ms). Google API call latency dominates regardless.

### API Surface Parity

| Interface | v3.3.0 | v4.0.0 | Change |
|-----------|--------|--------|--------|
| MCP tools | 6 (drive, sheets, forms, docs, gmail, calendar) | 2 (search, execute) | Breaking: complete replacement |
| MCP resources | gdrive://tools, gdrive:///{file_id} | gdrive:///{file_id} (keep), gdrive://tools (optional) | gdrive://tools becomes secondary to search() |
| Transport | stdio only | Streamable HTTP (Phase 2) + stdio (Phase 1) | New transport |
| Auth setup | `node dist/index.js auth` | Same locally + `wrangler secret put` for cloud | Extended |

### Integration Test Scenarios

1. **Agent discovery flow:** Agent calls `search("what operations are available for Google Sheets")` → receives structured list of 12 sheet operations with signatures and examples → agent calls `execute()` with correct SDK call
2. **Multi-step workflow:** Agent reads spreadsheet via `execute(sdk.sheets.readSheet(...))` → processes data → creates document via `execute(sdk.docs.createDocument(...))` → all within single conversation
3. **Rate limit handling:** Agent fires 100 rapid `execute()` calls → SDK rate limiter queues requests → no 429 errors reach agent → all calls eventually complete
4. **Token refresh under load:** Access token expires mid-conversation → next `execute()` triggers transparent refresh → agent never sees auth error
5. **Sandbox isolation:** Agent `execute()` code attempts `process.exit()`, `require('fs')`, `fetch('https://evil.com')` → all blocked → clear error message returned

### Cross-Phase Skills

> **Recommended Skills (apply throughout):**
> - `@claude-md-improver` — CLAUDE.md must be updated with new v4.0.0 architecture, 2-tool surface, and commands
> - `@AwesomeReadme` — README rewrite for v4.0.0 with story-driven narrative for the Code Mode pattern
> - `@GitWorkflow` — Changelog entries for v4.0.0-alpha and v4.0.0, branch management across phases, release tagging
> - `@Evals` — Integration test scenarios (agent discovery flow, multi-step workflow, rate limit handling) map directly to eval cases

## Acceptance Criteria

### Phase 1: Code Mode on Node

- [ ] Typed SDK spec covers all 47 operations across 6 services with signatures, descriptions, and examples
- [ ] `search()` tool returns SDK spec data when agent queries with JavaScript
- [ ] `execute()` tool runs agent JavaScript in isolated-vm sandbox with SDK runtime available
- [ ] SDK methods call existing module handlers and return results to agent code
- [ ] Rate limiting prevents Google API quota exhaustion from rapid chained calls
- [ ] Legacy 6 tools are removed from server registration
- [ ] Server boots and responds via stdio transport with 2 tools only
- [ ] `npm test` passes with updated test suite covering search/execute patterns
- [ ] `npm run type-check` passes with no errors
- [ ] Version bumped to 4.0.0-alpha in package.json

### Phase 2: Cloudflare Workers Deployment

- [ ] Worker deploys via `wrangler deploy` with KV binding and secrets configured
- [ ] Streamable HTTP transport accepts POST/GET/DELETE on /mcp endpoint
- [ ] Bearer token authentication rejects unauthorized requests with 401
- [ ] Origin allowlist rejects disallowed origins with 403
- [ ] OAuth token refresh works via Google's token endpoint using Worker secret
- [ ] Workers KV stores and retrieves encrypted OAuth tokens
- [ ] Workers KV caching replaces Redis with TTL support
- [ ] Agent code runs in Workers' V8 scope without isolated-vm dependency
- [ ] Google API calls work from Workers (direct REST or googleapis compatibility)
- [ ] MCP Inspector can connect and call search()/execute() over HTTP
- [ ] Version bumped to 4.0.0 in package.json

### Cross-Phase

- [ ] Existing `node dist/index.js auth` flow still works for initial OAuth setup
- [ ] No credentials or tokens exposed in source code or logs
- [ ] CLAUDE.md updated with new architecture and commands
- [ ] README updated with v4.0.0 usage guide

## Success Metrics

| Metric | Current (v3.3.0) | Target (v4.0.0) | How Measured |
|--------|-----------------|-----------------|-------------|
| Tool context tokens | ~5,000+ (6 tool schemas) | ~1,000 (2 tool schemas) | Count tokens in ListTools response |
| Operation coverage | 47 operations | 47 operations (via SDK) | Verify all SDK methods map to existing operations |
| Transport | stdio only | Streamable HTTP + stdio | Test both transports |
| Infrastructure | Local Node + Docker + Redis | Cloudflare Worker + KV | Deployment verification |
| Cold start latency | N/A (local) | <100ms (Worker) | wrangler tail --format=pretty |

## Dependencies & Prerequisites

### Phase 1

| Dependency | Status | Notes |
|-----------|--------|-------|
| `isolated-vm` ^6.0.2 | Already in package.json | Used for Phase 1 sandbox; removed in Phase 2 |
| `@modelcontextprotocol/sdk` ^1.25.1 | Already in package.json | Includes Streamable HTTP transports |
| Node.js >=22 | Already required | Phase 1 runtime |
| Existing 47 operation handlers | Working in v3.3.0 | Become SDK internals |

### Phase 2

| Dependency | Status | Notes |
|-----------|--------|-------|
| Cloudflare Workers account | Required | Free tier sufficient for personal use |
| `wrangler` CLI | To install | Cloudflare's deployment tool |
| Workers KV namespace | To create | Via wrangler or dashboard |
| `@cloudflare/agents` | Evaluate | May simplify MCP transport setup |
| Google API REST endpoints | Documented | May replace `googleapis` if incompatible with Workers |

## Risk Analysis & Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| **googleapis incompatible with Workers** | **Confirmed** | High | Direct REST `fetch()` calls to Google APIs. REST base URLs documented for all 6 services. See OD-3. |
| **`eval()`/`new Function()` blocked in Workers** | **Confirmed** | High | Must use Dynamic Worker Loaders (`env.LOADER.get()`) for agent code execution. `@cloudflare/codemode`'s `DynamicWorkerExecutor` handles this. |
| **MCP SDK `.tool()` deprecated** | **Confirmed** | Low | Use `.registerTool()` instead (MCP SDK v1.27.1). |
| **Agent struggles with code generation** | Low | Medium | Primary user is Claude (strong coder). Add examples to SDK spec. |
| **isolated-vm sandbox escape** | Very Low | High | Phase 1 only; personal tool with trusted user. Phase 2 uses Workers isolation. |
| **Token refresh failure on Workers** | Low | High | KV-cached tokens with preemptive refresh (600s before expiry). Alert on failure. |
| **Workers KV write rate limit** | Low | Medium | Max 1 write/sec per key. Token refresh writes are infrequent. Cache writes use unique keys. |
| **Workers CPU time limit** | Low | Medium | Google API calls are I/O-bound, not CPU-bound. 30s limit is generous. |
| **Concurrent token refresh race condition** | Low | Low | Multiple requests may try to refresh simultaneously. Google tolerates this. Use KV `metadata.refreshedAt` to coordinate. |
| **Breaking change alienates users** | N/A | N/A | Personal tool — no external users to break. Clean semver v4.0.0. |

## Future Considerations

- **Multi-model support:** If sharing tool with other AI models that struggle with code generation, add a `natural_language` execution mode as alternative to raw JavaScript
- **MCP Sampling:** MCP spec includes sampling capabilities — could enable the server to ask the model for help during execution
- **Durable Objects:** If session state needed for long-running multi-step workflows, upgrade from stateless KV to Durable Objects
- **Scheduled token refresh:** Workers Cron Triggers could proactively refresh tokens before expiry
- **Observability:** Workers Analytics Engine for monitoring API usage, rate limiting events, and error rates

## Documentation Plan

| Document | Action | Phase |
|----------|--------|-------|
| `README.md` | Rewrite for v4.0.0 (Code Mode usage, Workers setup) | Phase 2 |
| `CLAUDE.md` | Update architecture section, commands, tool descriptions | Phase 1 |
| `CHANGELOG.md` | v4.0.0-alpha and v4.0.0 entries | Both |
| `docs/MIGRATION_V4.md` | Create migration guide from v3.x → v4.0 | Phase 2 |
| `package.json` | Version bump, dependency changes | Both |

## Sources & References

### Origin

- **Brainstorm document:** [docs/brainstorms/2026-02-25-code-mode-streamable-http-brainstorm.md](docs/brainstorms/2026-02-25-code-mode-streamable-http-brainstorm.md) — Key decisions carried forward: two-phase migration (Code Mode first, Workers second), full tool replacement (no legacy fallback), Workers-native dependency redesign

### Internal References

- Existing migration plan: `docs/planning/streamable-http-cloudflare-migration.md` (partially superseded — auth/HTTP transport sections still relevant)
- v2.0.0 migration reference: `docs/MIGRATION_V2.md` (41→5 tool consolidation pattern)
- OAuth research: `docs/Research/persistent-oauth-authentication-gdrive-mcp.md`
- Tool registration: `index.ts:460-578` (current 6-tool schema definitions)
- Operation dispatch: `index.ts:582+` (current switch-based handler routing)
- Module structure: `src/modules/{drive,sheets,forms,docs,gmail,calendar}/` (47 operation handlers)
- Shared types: `src/modules/types.ts` (BaseContext, CacheManagerLike, OperationResult)
- Auth system: `src/auth/{AuthManager,TokenManager,KeyRotationManager,KeyDerivation}.ts`
- Progressive discovery: `src/tools/listTools.ts` (existing gdrive://tools resource)

### External References

- [Cloudflare Code Mode MCP Blog](https://blog.cloudflare.com/code-mode-mcp/)
- [MCP Streamable HTTP Spec](https://spec.modelcontextprotocol.io/specification/2025-06-18/basic/transports/)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk) — `StreamableHTTPServerTransport`, `WebStandardStreamableHTTPServerTransport`
- [Cloudflare Agents MCP](https://developers.cloudflare.com/agents/model-context-protocol/)
- [HOW2MCP](https://github.com/Rixmerz/HOW2MCP.git) — MCP implementation patterns

### Related Work

- PR #35: Bug fix milestone with API, security, and DRY improvements (v3.3.0)
- PR #39: README rewrite for v3.3.0
