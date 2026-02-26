# Code Mode MCP + Cloudflare Workers Migration Brainstorm

Date: 2026-02-25
Status: Draft
Supersedes: docs/planning/streamable-http-cloudflare-migration.md (partial — auth/HTTP transport sections)

## What We're Building

Transform the gdrive MCP server from a local stdio-based tool server (6 tools, 47 operations) into a **Cloudflare Workers-native Code Mode MCP server** with two tools: `search()` and `execute()`.

**Code Mode MCP** (from Cloudflare's pattern) collapses the entire API surface into two tools:
- `search()` — agents write JavaScript to query a typed SDK spec, discovering available operations without loading the full schema into context
- `execute()` — agents write JavaScript against a typed SDK to call Google Workspace APIs within a V8 sandbox

This achieves ~99.9% token reduction (from potentially 100K+ tokens for 47 operation schemas down to ~1,000 tokens fixed) while providing full API access.

**Streamable HTTP** replaces the current stdio transport with MCP's HTTP-based protocol (`POST`/`GET`/`DELETE` on a single endpoint), enabling remote deployment on Cloudflare Workers.

## Why This Approach

### The Problem
- Current stdio transport requires local process management (Docker or direct Node)
- 6 tools with 47 operations consume significant context window in AI agent workflows
- Local filesystem dependency (credentials, tokens) prevents cloud-native deployment
- `isolated-vm` and `@google-cloud/local-auth` are Node-specific, Workers-incompatible

### The Solution
- **Code Mode** reduces tool surface from 47 operations to 2 tools, dramatically cutting token cost
- **Workers deployment** enables remote access from any MCP client without local Docker
- **Workers KV** replaces both Redis caching and local filesystem token storage
- **Native V8 isolates** (Workers runtime) replace `isolated-vm` for Code Mode sandboxing

### Why Not Incremental (Node HTTP First)
The original migration plan recommended adding HTTP transport on Node as a stepping stone. We're skipping this because:
1. Workers-native is the destination — intermediate Node HTTP is throwaway work
2. Code Mode's V8 sandbox is *native* to Workers — no need for `isolated-vm` bridge
3. Single user/admin deployment simplifies auth (no multi-tenant OAuth flows needed)

## Key Decisions

### 1. Migration Sequence: Code Mode First, Workers Second (Approach A)
**Decision:** Two-phase migration. Phase 1 validates Code Mode locally; Phase 2 deploys to Workers.
**Rationale:** Tests the novel architecture (Code Mode SDK, search/execute pattern) independently from infrastructure migration (Workers runtime, KV storage). Each phase is debuggable in isolation.
**Alternatives rejected:**
- Workers first (porting 47 operations to Workers is throwaway since Code Mode replaces them)
- Big bang (large blast radius, hard to isolate bugs)

### 2. Full Tool Replacement (No Legacy Fallback)
**Decision:** Only expose `search()` and `execute()`. Remove the 6 operation-based tools entirely.
**Rationale:** Clean break. The 47 operations become the internal typed SDK, not the external interface. Maximum token savings.
**Alternatives rejected:**
- Dual mode with deprecation (adds complexity for no clear user benefit — single admin)
- Legacy escape hatch (backward compatibility not needed for personal tool)

### 3. Workers-Native Dependency Redesign
**Decision:** Clean break from Node-specific dependencies rather than incremental migration.
**Replacements:**
| Current | Workers Replacement |
|---------|-------------------|
| `fs` (credential/token files) | Workers KV (encrypted values) |
| `@google-cloud/local-auth` | Refresh token as Workers secret + runtime refresh |
| `isolated-vm` | Workers' native V8 isolates |
| `redis` | Workers KV with TTL |
| Express (not yet added) | Workers' native `fetch` handler |
**Rationale:** Avoids maintaining two code paths. Single-user tool doesn't need migration shims.

### 4. Auth Model: Local OAuth + Workers Secret
**Decision:** Keep existing local `node dist/index.js auth` flow for initial OAuth. Export refresh token as a Workers secret. Workers handles token refresh at runtime via Google's token endpoint.
**Rationale:** Zero new auth UI needed. Existing flow already works. Workers only needs the refresh token to operate autonomously.

### 5. Storage: Workers KV
**Decision:** Workers KV for all persistent state (tokens, cache entries).
**Rationale:** Direct analog to current Redis caching. Simple key-value API, 25ms global reads, TTL support. Overkill alternatives (D1, Durable Objects) not warranted for single-user tool.

### 6. SDK Design: Auto-Generated Then Refined
**Decision:** Auto-generate typed SDK from existing 47 operation input/output schemas, then review and refine for agent-optimized discovery.
**Rationale:** Leverages existing schema investment. Refinement pass optimizes for how agents actually discover and use operations (grouping, naming, examples).

## Phase Structure

Each phase will have its own detailed planning document:

### Phase 1: Code Mode on Node (Local)
**Scope:** Implement `search()` + `execute()` tools on current Node runtime
**Document:** `docs/planning/phase-1-code-mode-local.md` (to be created)
**Key work:**
- Auto-generate typed SDK from existing operation schemas
- Implement `search()` tool (agent JavaScript runs against SDK spec object)
- Implement `execute()` tool (agent JavaScript runs in `isolated-vm` sandbox, calls existing operation handlers)
- Remove 6 legacy tools from server registration
- Test with MCP Inspector and actual AI agent workflows

### Phase 2: Cloudflare Workers Deployment
**Scope:** Migrate Code Mode server to Workers + Streamable HTTP
**Document:** `docs/planning/phase-2-workers-deployment.md` (to be created)
**Key work:**
- Replace `isolated-vm` with Workers' native V8 isolate execution
- Replace `fs` token/credential storage with Workers KV
- Replace Redis caching with Workers KV
- Implement Streamable HTTP transport via `WebStandardStreamableHTTPServerTransport` or Cloudflare's `McpAgent`
- Deploy auth refresh token as Workers secret
- Set up `wrangler.toml` and deploy

## Resolved Questions

### Q1: SDK Namespace Structure
**Decision:** Grouped by service — `sdk.drive.search()`, `sdk.sheets.read()`, `sdk.gmail.send()`.
**Rationale:** Mirrors Google API structure. Agents can explore one service at a time via `search()`, reducing cognitive load.

### Q2: Sandbox Permission Boundaries
**Decision:** Direct API calls in sandbox. Agent code calls `sdk.drive.search('query')` inside the sandbox and it makes real Google API calls.
**Rationale:** Matches Cloudflare's Code Mode pattern. Simpler for agents — no indirection layer.

### Q3: Versioning Strategy
**Decision:** v4.0.0 (semver-correct breaking change). Phase 1 = v4.0.0-alpha, Phase 2 = v4.0.0.
**Rationale:** Clear signal that the tool interface is fundamentally different (6 tools → 2 tools).

### Q5: Google API Rate Limits in Code Mode
**Decision:** SDK-level throttling. The typed SDK methods include built-in rate limiting (delays, queuing). Agent code calls `sdk.drive.search()` and the SDK handles pacing transparently.
**Rationale:** Invisible to agents, prevents accidental quota exhaustion from chained calls.

## Open Questions (Remaining)

### Q4: MCP Client Compatibility
Code Mode is a Cloudflare pattern, not an MCP spec feature. All MCP clients support calling `search()` and `execute()` tools — but do all AI models handle the "write code to call an API" pattern well?
- Claude: likely excellent (strong coding)
- GPT-4: likely good
- Smaller models: may struggle with code generation against typed SDK
- **Mitigation:** This is a personal tool for Ossie + his AI agents (primarily Claude). Not a public API compatibility concern.

## Source Material

- [Cloudflare Code Mode MCP Blog](https://blog.cloudflare.com/code-mode-mcp/)
- [MCP Streamable HTTP Spec](https://spec.modelcontextprotocol.io/specification/2025-06-18/basic/transports/)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk) — `StreamableHTTPServerTransport`, `WebStandardStreamableHTTPServerTransport`
- [Cloudflare Agents MCP](https://developers.cloudflare.com/agents/model-context-protocol/)
- Existing migration plan: `docs/planning/streamable-http-cloudflare-migration.md`
