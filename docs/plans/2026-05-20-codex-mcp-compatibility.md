# Codex MCP Compatibility Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the gdrive MCP server work reliably from Codex over remote Streamable HTTP, with static bearer auth first and a clean path to standards-based OAuth metadata next.

**Architecture:** Keep the Google Workspace tool logic unchanged behind `src/server/factory.ts`. Add client compatibility at the transport/auth boundary: a Node HTTP `/mcp` transport for local Codex use, shared bearer/auth error helpers, explicit health/discovery endpoints, and docs/verification for Codex CLI. Treat Cloudflare Worker support as an existing deployment target, not the only HTTP surface.

**Tech Stack:** TypeScript ES modules, Node 22 HTTP server, `@modelcontextprotocol/sdk`, Google OAuth via existing `AuthManager`, Jest, Codex CLI MCP commands.

**References:**
- OpenAI Docs MCP shows Codex connecting to Streamable HTTP MCP servers with `codex mcp add <name> --url <url>`: https://developers.openai.com/learn/docs-mcp
- OpenAI MCP guide says remote MCP servers support Streamable HTTP or HTTP/SSE and may require OAuth authorization: https://developers.openai.com/api/docs/guides/tools-connectors-mcp
- ChatGPT Developer Mode supports SSE/streaming HTTP plus OAuth, no auth, and mixed auth; useful for the later Apps-compatible phase: https://developers.openai.com/api/docs/guides/developer-mode

---

## Scope

### In Scope

- Node-hosted Streamable HTTP transport at `POST /mcp`.
- Static bearer auth using `Authorization: Bearer <token>`.
- Optional unauthenticated `GET /healthz`, `GET /`, and `GET /.well-known/oauth-protected-resource`/metadata stubs that clearly state the current auth mode.
- MCP-shaped and HTTP-shaped errors that make Codex failures diagnosable.
- Codex CLI verification flow.
- Documentation for local Node HTTP and Cloudflare Worker HTTP paths.

### Out of Scope For First Slice

- Full OAuth authorization server.
- Dynamic client registration.
- Reworking Gmail/Drive/Sheets/etc. tool logic.
- Changing the v4 `search` + `execute` tool model.

---

## Current State

- `src/server/factory.ts` already centralizes MCP tool registration via `createConfiguredServer()`.
- `src/server/transports/stdio.ts` supports local stdio and browser OAuth token capture.
- `worker.ts` already handles Cloudflare Worker `POST /mcp` with `WebStandardStreamableHTTPServerTransport`.
- `worker.ts` already requires `MCP_BEARER_TOKEN`, but the auth helpers and error shape are Worker-local.
- `index.ts` only dispatches stdio by default plus `auth`, `health`, and token utility commands.
- Local `codex` command currently fails in this shell with `ENOENT` for its bundled executable, so final verification requires repairing/reinstalling Codex CLI first.

---

## Compatibility Targets

1. `node ./dist/index.js http --port 8788` starts a local Streamable HTTP MCP server.
2. `POST http://127.0.0.1:8788/mcp` is the only MCP endpoint.
3. Missing/invalid bearer token returns `401` with `WWW-Authenticate: Bearer` and a short JSON error.
4. Missing Google OAuth tokens returns a clear `401` or `503` explaining to run `node ./dist/index.js auth`.
5. `GET /healthz` returns operational state without exposing secrets.
6. Codex can add/list/connect to the server with configured bearer/env auth.
7. A fresh Codex session can list and call `search` and `execute`.

---

## Task 1: Extract Shared HTTP Auth Helpers

**Files:**
- Create: `src/server/http-auth.ts`
- Test: `src/__tests__/server/http-auth.test.ts`
- Modify: `worker.ts`

**Step 1: Write failing tests**

Create tests for:
- Missing required server token returns `500`.
- Missing client bearer returns `401`.
- Wrong bearer returns `401`.
- Correct bearer returns `null`.
- Disallowed origin returns `403`.
- `WWW-Authenticate: Bearer` is present for `401`.

**Step 2: Run the focused test**

Run:

```bash
npm test -- src/__tests__/server/http-auth.test.ts
```

Expected: FAIL because `src/server/http-auth.ts` does not exist.

**Step 3: Implement helper**

Implement exports:

```ts
export interface BearerAuthConfig {
  requiredToken?: string;
  allowedOrigins?: string;
  runtimeName: string;
}

export function jsonError(status: number, error: string, detail?: string): Response;

export function validateBearerRequest(
  request: Request,
  config: BearerAuthConfig
): Response | null;
```

Behavior:
- `requiredToken` missing: `500`, `"Server misconfiguration"`.
- Missing/wrong `Authorization`: `401`, `"Unauthorized"`, `WWW-Authenticate: Bearer`.
- Optional comma-separated `allowedOrigins`.
- No token logging.

**Step 4: Update Worker**

Replace `worker.ts` local `jsonError`, `parseAllowedOrigins`, and `validateWorkerRequestAuth` logic with shared helpers. Keep `validateWorkerRequestAuth()` as a thin exported wrapper if existing tests import it.

**Step 5: Run tests**

Run:

```bash
npm test -- src/__tests__/server/http-auth.test.ts src/__tests__/worker/worker-auth.test.ts
```

Expected: PASS.

**Step 6: Commit**

```bash
git add src/server/http-auth.ts src/__tests__/server/http-auth.test.ts src/__tests__/worker/worker-auth.test.ts worker.ts
git commit -m "fix: share HTTP bearer auth handling"
```

---

## Task 2: Add Node HTTP Transport

**Files:**
- Create: `src/server/transports/http.ts`
- Test: `src/__tests__/server/http-transport.test.ts`
- Modify: `index.ts`

**Step 1: Confirm SDK import**

After dependencies are installed, inspect the SDK package for the Node transport export:

```bash
rg -n "class StreamableHTTPServerTransport|StreamableHTTPServerTransport" node_modules/@modelcontextprotocol/sdk
```

Expected: find the correct import path, likely `@modelcontextprotocol/sdk/server/streamableHttp.js`. Use the actual installed SDK export.

**Step 2: Write failing tests**

Test:
- `GET /healthz` returns `{ ok: true, transport: "http" }`.
- `GET /` returns a short text banner pointing to `POST /mcp`.
- non-`POST /mcp` returns `404`.
- missing bearer on `POST /mcp` returns `401`.

Use Node `http` server test utilities and mock the MCP transport where needed so tests do not require Google API calls.

**Step 3: Run focused test**

```bash
npm test -- src/__tests__/server/http-transport.test.ts
```

Expected: FAIL because the transport does not exist.

**Step 4: Implement `runHttpServer()`**

Add:

```ts
export interface HttpServerOptions {
  host?: string;
  port?: number;
}

export async function runHttpServer(options?: HttpServerOptions): Promise<void>;
```

Implementation requirements:
- Reuse `createLogger`, `createCacheManager`, `createPerformanceMonitor`, `AuthManager`, `NodeSandbox`, and `createConfiguredServer`.
- Require `GDRIVE_TOKEN_ENCRYPTION_KEY`.
- Require `MCP_BEARER_TOKEN` for first slice.
- Load OAuth credentials exactly like stdio path.
- If unauthenticated, return startup failure with: `Authentication required. Run node ./dist/index.js auth first.`
- Start Node HTTP server on `127.0.0.1:8788` by default.
- Handle only `POST /mcp` as MCP traffic.
- Use a new server/transport per request unless SDK docs require session persistence.
- Keep logs on stderr/file, never stdout for MCP responses.

**Step 5: Add CLI dispatch**

In `index.ts`, support:

```bash
node ./dist/index.js http
node ./dist/index.js http --host 127.0.0.1 --port 8788
```

Use a small parser, not a new CLI framework.

**Step 6: Run tests**

```bash
npm test -- src/__tests__/server/http-transport.test.ts src/__tests__/server/stdio-oauth-path.test.ts
npm run type-check
```

Expected: PASS.

**Step 7: Commit**

```bash
git add index.ts src/server/transports/http.ts src/__tests__/server/http-transport.test.ts
git commit -m "feat: add Node streamable HTTP transport"
```

---

## Task 3: Add Discovery And Metadata Endpoints

**Files:**
- Modify: `src/server/transports/http.ts`
- Modify: `worker.ts`
- Test: `src/__tests__/server/http-transport.test.ts`
- Test: `src/__tests__/worker/worker-auth.test.ts`

**Step 1: Write failing tests**

Add tests for:
- `GET /.well-known/oauth-protected-resource` returns JSON with `resource`, `authorization_servers: []`, and a note that static bearer auth is currently required.
- `GET /.well-known/oauth-authorization-server` returns `404` or `501` with a clear `"OAuth authorization server is not implemented"` message.
- Worker returns equivalent metadata.

**Step 2: Run tests**

```bash
npm test -- src/__tests__/server/http-transport.test.ts src/__tests__/worker/worker-auth.test.ts
```

Expected: FAIL.

**Step 3: Implement metadata**

Keep this intentionally honest:
- Do not pretend full OAuth is implemented.
- Return metadata that helps Codex/ChatGPT/App clients distinguish "static bearer only" from "broken auth".
- Include `mcp_endpoint: "/mcp"`.

**Step 4: Run tests**

```bash
npm test -- src/__tests__/server/http-transport.test.ts src/__tests__/worker/worker-auth.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add src/server/transports/http.ts worker.ts src/__tests__/server/http-transport.test.ts src/__tests__/worker/worker-auth.test.ts
git commit -m "feat: expose MCP auth metadata"
```

---

## Task 4: Improve Tool Metadata For OpenAI Clients

**Files:**
- Modify: `src/server/factory.ts`
- Test: `src/__tests__/server/factory.test.ts`

**Step 1: Write failing tests**

Assert that:
- `search` has `annotations.readOnlyHint === true`.
- `execute` description clearly says it can read and write Google Workspace data.
- `execute` schema requires either structured `service + operation` or `code`, and parameter descriptions remain present.

**Step 2: Run test**

```bash
npm test -- src/__tests__/server/factory.test.ts
```

Expected: FAIL for missing read-only annotation and/or description requirements.

**Step 3: Implement metadata**

Add MCP annotations where supported:
- `search`: `readOnlyHint: true`.
- `execute`: omit read-only hint or set false, because Gmail send, Docs edit, Drive write, etc. are possible.

Update descriptions with action-oriented guidance:
- `search`: "Use this first to discover Google Workspace operations..."
- `execute`: "Use this to run a specific Google Workspace operation. Some operations modify or send data..."

**Step 4: Run tests**

```bash
npm test -- src/__tests__/server/factory.test.ts
npm run type-check
```

Expected: PASS.

**Step 5: Commit**

```bash
git add src/server/factory.ts src/__tests__/server/factory.test.ts
git commit -m "chore: clarify MCP tool metadata"
```

---

## Task 5: Document Codex Setup

**Files:**
- Create: `docs/Guides/08-codex-mcp.md`
- Modify: `docs/Guides/README.md`
- Modify: `CLAUDE.md`

**Step 1: Write the guide**

Include:
- Prereqs: Node 22, built project, `GDRIVE_TOKEN_ENCRYPTION_KEY`, Google OAuth keys, successful `node ./dist/index.js auth`, `MCP_BEARER_TOKEN`.
- Local server command:

```bash
GDRIVE_TOKEN_ENCRYPTION_KEY="$GDRIVE_TOKEN_ENCRYPTION_KEY" \
MCP_BEARER_TOKEN="$GDRIVE_MCP_TOKEN" \
node ./dist/index.js http --host 127.0.0.1 --port 8788
```

- Codex command shape:

```bash
codex mcp add google-workspace --url http://127.0.0.1:8788/mcp
codex mcp get google-workspace
```

- Header/auth configuration note: use the currently installed Codex CLI's supported bearer/env-header option. Verify with `codex mcp add --help` because CLI flags can change.
- Cloudflare Worker URL shape:

```bash
codex mcp add google-workspace --url https://<worker-host>/mcp
```

- Troubleshooting:
  - `Auth unsupported`: server metadata/auth mode mismatch.
  - `401 Unauthorized`: bearer mismatch or missing header.
  - `Authentication required`: run `node ./dist/index.js auth`.
  - tools missing: run `codex mcp get google-workspace`, restart Codex session.

**Step 2: Link docs**

Add the guide to `docs/Guides/README.md` and add a short compatibility note to `CLAUDE.md`.

**Step 3: Commit**

```bash
git add docs/Guides/08-codex-mcp.md docs/Guides/README.md CLAUDE.md
git commit -m "docs: add Codex MCP setup guide"
```

---

## Task 6: End-To-End Verification

**Files:**
- No source files expected.
- Record any doc correction if commands differ from current Codex CLI.

**Step 1: Build**

```bash
npm run build
```

Expected: PASS.

**Step 2: Verify auth is available**

```bash
node ./dist/index.js health
```

Expected: healthy token state, or actionable auth error.

**Step 3: Start local HTTP server**

```bash
GDRIVE_TOKEN_ENCRYPTION_KEY="$GDRIVE_TOKEN_ENCRYPTION_KEY" \
MCP_BEARER_TOKEN="$GDRIVE_MCP_TOKEN" \
node ./dist/index.js http --host 127.0.0.1 --port 8788
```

Expected: server listening message on stderr/logs.

**Step 4: Probe unauthenticated error**

```bash
curl -i http://127.0.0.1:8788/mcp
curl -i -X POST http://127.0.0.1:8788/mcp
```

Expected:
- `GET /mcp`: 404 or method guidance.
- unauthenticated `POST /mcp`: `401` with `WWW-Authenticate: Bearer`.

**Step 5: Probe MCP endpoint with bearer**

Use a minimal MCP initialize/list tools client or the SDK inspector. Expected: `search` and `execute` are listed.

**Step 6: Repair local Codex CLI if needed**

Current shell failure:

```text
Error: spawn .../@openai/codex-darwin-arm64/.../codex ENOENT
```

Fix before Codex verification by reinstalling/updating the Codex CLI through the user’s preferred package manager.

**Step 7: Verify with Codex**

Run:

```bash
codex mcp add google-workspace --url http://127.0.0.1:8788/mcp
codex mcp get google-workspace
```

Then configure bearer auth using the exact flag/config supported by the installed Codex CLI and start a fresh Codex session.

Expected:
- `codex mcp get google-workspace` shows configured server.
- Fresh session lists `search` and `execute`.
- Calling `search` with `{ "service": "drive" }` returns Drive operations.

**Step 8: Commit any verification doc correction**

```bash
git add docs/Guides/08-codex-mcp.md
git commit -m "docs: correct Codex MCP verification steps"
```

---

## Task 7: Metadata-Only External OAuth Compatibility

Static bearer auth remains the supported MCP client-to-server auth mode. This task adds only the metadata extension point for a future external authorization server.

**Files:**
- Modify: `src/server/http-metadata.ts`
- Modify: `src/server/transports/http.ts`
- Modify: `worker.ts`
- Modify: `src/__tests__/server/http-transport.test.ts`
- Modify: `src/__tests__/worker/worker-auth.test.ts`
- Create: `CONTEXT.md`
- Create: `docs/adr/0001-mcp-client-auth-boundary.md`

**Plan:**
- Do not make this repo an OAuth authorization server.
- Keep Google OAuth as server-to-Google authorization.
- Keep static bearer auth as MCP client-to-server authentication.
- Add `MCP_AUTHORIZATION_SERVER_URL` as metadata-only config.
- When configured, protected-resource metadata includes the external authorization server URL.
- Do not accept or validate external OAuth bearer tokens in this PR.
- Document that `codex mcp login google-workspace` requires a real external/dedicated authorization server.

**Non-negotiable:** Do not add fake OAuth metadata just to make clients stop saying `Auth unsupported`; that creates a worse failure mode. Advertising an external server and validating its tokens are separate commitments.

---

## Acceptance Criteria

- `npm test -- src/__tests__/server/http-auth.test.ts src/__tests__/server/http-transport.test.ts src/__tests__/server/factory.test.ts src/__tests__/worker/worker-auth.test.ts` passes.
- `npm run type-check` passes.
- `npm run build` passes.
- Local Node HTTP server responds on `POST /mcp`.
- Unauthenticated requests fail clearly.
- Authenticated Codex configuration can list `search` and `execute` in a fresh session.
- Docs explain both local Node HTTP and deployed Worker paths.
