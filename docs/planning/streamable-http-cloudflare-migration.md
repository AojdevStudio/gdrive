# Streamable HTTP + Cloudflare Migration Plan (Post-PR #35)

Date: February 25, 2026  
Scope: Add Streamable HTTP as a second transport with minimal code churn, then deprecate Docker/stdio.

## 1) Executive Answer

- PR #35 did **not** add HTTP transport. The server still boots with stdio only (`StdioServerTransport`) in `index.ts`.
- This repo can be extended to Streamable HTTP with **small, targeted** changes while keeping stdio temporarily.
- Fastest Cloudflare path with minimal churn is: keep Node server, expose Streamable HTTP, deploy on Cloudflare infra that runs containers/Node workloads.
- Cloudflare Workers-native runtime is possible, but **not minimal** for this codebase due Node-specific dependencies and local OAuth flow assumptions.

## 2) Research Findings (What Matters for This Repo)

### MCP transport requirements

- MCP Streamable HTTP replaces legacy HTTP+SSE transport and uses one MCP endpoint for `POST`/`GET`/`DELETE`.
- `POST` handles JSON-RPC; server may respond with JSON or SSE.
- `GET` supports standalone SSE stream.
- `DELETE` terminates session.
- Spec requires origin validation/auth hardening for remote deployment.

Source:
- https://spec.modelcontextprotocol.io/specification/2025-06-18/basic/transports/

### TypeScript SDK behavior that impacts implementation

- Installed SDK in this repo (`@modelcontextprotocol/sdk` `^1.25.1`) already includes:
  - `StreamableHTTPServerTransport` (Node wrapper)
  - `WebStandardStreamableHTTPServerTransport` (Workers/web-standard runtime)
- Critical SDK constraint:
  - In stateless mode (`sessionIdGenerator: undefined`), a transport instance **cannot be reused across requests**; create a fresh transport for each request.
- Legacy SSE transport is marked deprecated in SDK typings.
- SDK docs/examples include stateful, stateless, JSON-only, and backward compatibility modes.

Source:
- Context7: `/modelcontextprotocol/typescript-sdk`
- Local installed typings:
  - `node_modules/@modelcontextprotocol/sdk/dist/esm/server/streamableHttp.d.ts`
  - `node_modules/@modelcontextprotocol/sdk/dist/esm/server/webStandardStreamableHttp.d.ts`
  - `node_modules/@modelcontextprotocol/sdk/dist/esm/server/sse.d.ts`

### Cloudflare MCP server guidance

- Cloudflare provides MCP server helpers for Workers via `@cloudflare/agents` (`McpAgent`, `createMcpHandler`).
- It supports Streamable HTTP and configurable endpoint route (defaults to `/sse` in docs examples; can be changed via options).
- Docs show optional auth hooks (Bearer token check) and optional SQLite storage for state.

Source:
- https://developers.cloudflare.com/agents/api-reference/http-sse/
- https://developers.cloudflare.com/agents/model-context-protocol/
- Context7: `/cloudflare/workers-mcp`, `/websites/developers_cloudflare_workers`

## 3) Current-State Constraints in This Repo

1. Runtime/transport
- `index.ts` imports and uses only `StdioServerTransport`.
- CLI routes are stdio-first; no HTTP server bootstrap path.

2. Node and filesystem assumptions
- Uses `fs`, `path`, `@google-cloud/local-auth`, local credential/token file paths.
- Uses `isolated-vm` and Node Redis client.

3. Auth model
- Initial OAuth flow expects local browser + local credential files.
- Works well in local/docker; not Workers-native without redesign.

## 4) Minimal Dual-Transport Change Set (Recommended)

Goal: add Streamable HTTP with minimal disruption, keep stdio as fallback during migration.

### 4.1 Code changes (exact files)

1. `index.ts`
- Add HTTP runtime imports:
  - `import express from "express";`
  - `import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";`
- Introduce transport mode parsing:
  - CLI flag: `serve-http`
  - Env fallback: `MCP_TRANSPORT=stdio|http`
- Keep existing `auth`, `health`, `rotate-key`, `migrate-tokens`, `verify-keys` commands unchanged.

2. `index.ts` (new functions)
- Extract current bootstrap internals into reusable functions:
  - `initializeRuntime()`:
    - loads env checks
    - initializes `authManager`, `tokenManager`
    - sets `google.options({ auth })`
    - connects redis cache
  - `createConfiguredServer()`:
    - returns a new MCP `Server` instance with the current handlers registered.
  - `runStdioServer()`:
    - current behavior (`StdioServerTransport`).
  - `runHttpServer()`:
    - boot Express app and `/mcp` route(s).

3. `index.ts` (HTTP handler strategy, minimal + safe)
- Use **stateless JSON response mode** first:
  - `new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true })`
- For each incoming request on `/mcp`:
  - create fresh `Server` via `createConfiguredServer()`
  - create fresh transport (stateless reuse is forbidden by SDK)
  - `await server.connect(transport)`
  - `await transport.handleRequest(req, res, req.body)`
  - `await transport.close()`
- Add `app.all("/mcp", ...)` to allow `POST`, `GET`, `DELETE` (even if JSON mode is primary).

4. `package.json`
- Add script:
  - `"start:http": "node dist/index.js serve-http"`

5. `.env.example`
- Add HTTP env vars:
  - `MCP_TRANSPORT=stdio`
  - `MCP_HTTP_HOST=127.0.0.1`
  - `MCP_HTTP_PORT=8788`
  - `MCP_HTTP_PATH=/mcp`
  - `MCP_ALLOWED_ORIGINS=` (comma-separated)
  - `MCP_BEARER_TOKEN=` (optional, but recommended for remote)

6. `README.md` + `docs/Deployment/*`
- Add Streamable HTTP startup and client examples.
- Mark stdio/docker as legacy transport path (initially soft deprecation).

### 4.2 Minimal HTTP route skeleton

```ts
app.use(express.json({ limit: "1mb" }));

app.all(httpPath, async (req, res) => {
  // Optional bearer auth gate
  if (bearerToken && req.headers.authorization !== `Bearer ${bearerToken}`) {
    res.status(401).json({ jsonrpc: "2.0", error: { code: -32001, message: "Unauthorized" }, id: null });
    return;
  }

  // Optional origin allowlist for remote deployments
  if (allowedOrigins.size > 0) {
    const origin = req.headers.origin;
    if (!origin || !allowedOrigins.has(origin)) {
      res.status(403).json({ jsonrpc: "2.0", error: { code: -32000, message: "Forbidden origin" }, id: null });
      return;
    }
  }

  const requestServer = createConfiguredServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  await requestServer.connect(transport);
  await transport.handleRequest(req, res, req.body);
  await transport.close();
});
```

Why this pattern:
- Aligns with SDK stateless constraint.
- Avoids session map complexity for first release.
- Simplifies horizontal scaling behind Cloudflare.

## 5) Cloudflare Deployment Path

## 5.1 Lowest-churn path (recommended first)

Deploy the Node HTTP server (from section 4) on Cloudflare infrastructure that can run a containerized Node process; route traffic through Cloudflare edge.

Benefits:
- No rewrite of auth/token/file handling.
- Keeps current Google OAuth + token storage model.
- Gets remote Streamable HTTP endpoint quickly.

## 5.2 Workers-native path (not minimal)

If the target is pure Cloudflare Workers + `McpAgent`/`createMcpHandler`, plan a separate project phase:

Required redesign items:
1. Replace local filesystem credential/token reads/writes with Workers-native storage/bindings.
2. Replace local browser OAuth bootstrap (`@google-cloud/local-auth`) with remote auth callback flow.
3. Replace Node-specific modules that are not Workers-compatible (`isolated-vm`, parts of Redis client usage).
4. Move to `WebStandardStreamableHTTPServerTransport` or Cloudflare MCP handler abstractions.

Recommendation: do not combine this rewrite with initial Streamable HTTP enablement.

## 6) Docker/stdio Deprecation Plan

### Phase A (v3.4.x): Dual transport, soft deprecation

- Add Streamable HTTP transport.
- Keep stdio default for compatibility.
- Add startup warning when stdio is used:
  - `"stdio transport is deprecated and will be removed in v5.0; use serve-http"`
- Update docs and examples to prioritize HTTP first.

### Phase B (v4.0.0): Default switch

- Make HTTP default transport.
- Keep explicit stdio flag (`serve-stdio`) only for local/dev compatibility.
- Mark Docker compose as "legacy local wrapper", not primary deployment.

### Phase C (v5.0.0): Removal

- Remove stdio bootstrap path from main runtime.
- Keep a compatibility branch or separate package if needed for old desktop clients.

## 7) Verification Checklist (Definition of Done)

1. Transport behavior
- `node dist/index.js` still works in stdio mode during Phase A.
- `node dist/index.js serve-http` exposes `/mcp`.
- HTTP `POST` initialize + tool call works with MCP Inspector/client.

2. Security
- Unauthorized request returns 401 when bearer auth configured.
- Disallowed origins are rejected (403).
- No logs leak token values.

3. Operational
- Health command still works unchanged.
- Redis optional behavior unchanged.
- Graceful shutdown closes HTTP server and cache manager.

4. Docs
- README includes HTTP-first quickstart.
- Docker guide marked deprecated timeline.
- migration/deprecation dates documented.

## 8) Proposed Task Breakdown (Minimal Implementation)

1. Bootstrap refactor (`initializeRuntime`, `createConfiguredServer`) in `index.ts`.
2. Add HTTP server path with stateless Streamable transport in `index.ts`.
3. Add env vars + npm script updates (`.env.example`, `package.json`).
4. Docs update (`README.md`, deployment guides, deprecation note).
5. Run tests/type-check and verify HTTP endpoint manually with MCP Inspector.

Estimated effort: 1-2 focused days for dual-transport merge, plus docs.

## 9) Source Links

- MCP Transport Spec (Streamable HTTP):  
  https://spec.modelcontextprotocol.io/specification/2025-06-18/basic/transports/
- MCP TypeScript SDK (official):  
  https://github.com/modelcontextprotocol/typescript-sdk
- Cloudflare Agents MCP API reference (`McpAgent`, `createMcpHandler`):  
  https://developers.cloudflare.com/agents/api-reference/http-sse/
- Cloudflare MCP overview:  
  https://developers.cloudflare.com/agents/model-context-protocol/
