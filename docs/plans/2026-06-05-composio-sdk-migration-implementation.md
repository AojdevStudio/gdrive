# Composio SDK Migration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Move AOJ Workbench `search` and `execute` onto a Composio SDK-backed provider runtime across Drive, Sheets, Docs, Gmail, Forms, and Calendar.

**Architecture:** Keep AOJ Workbench as the single remote Cloudflare Workers MCP surface with exactly `search` and `execute`. Add a deep Composio provider runtime and operation registry that map stable AOJ Workbench `{ service, operation, args }` calls to Composio session execution. Remove direct Google execution from the `/mcp` path as provider replacement slices go green.

**Tech Stack:** TypeScript, Cloudflare Workers, `@modelcontextprotocol/sdk`, `@composio/core`, Jest, ESLint.

---

### Task 1: Provider Runtime Foundation

**Files:**
- Create: `src/provider/composio/runtime.ts`
- Create: `src/provider/composio/operation-registry.ts`
- Test: `src/__tests__/provider/composio-runtime.test.ts`

**Steps:**
1. Write tests for missing Composio configuration, session creation, toolkit auth status discovery, and safe error handling.
2. Add `@composio/core`.
3. Implement an injectable runtime that validates `COMPOSIO_API_KEY` and `AOJ_WORKBENCH_USER_ID`, creates/reuses a Composio session, disables Composio workbench, and enables only the Google toolkits AOJ Workbench wraps.
4. Run `npm run type-check` and the provider test.

### Task 2: Operation Registry

**Files:**
- Modify: `src/provider/composio/operation-registry.ts`
- Test: `src/__tests__/provider/composio-runtime.test.ts`

**Steps:**
1. Map Drive, Sheets, Docs, Gmail, Forms, and Calendar AOJ Workbench operations to internal Composio toolkit/tool identifiers.
2. Preserve AOJ Workbench service and operation names in discovery and execution.
3. Keep raw Composio slugs out of public `search` responses.
4. Add argument aliasing and result normalization for the first tracer bullet, `drive.search`.

### Task 3: MCP Server Routing

**Files:**
- Modify: `src/server/factory.ts`
- Test: `src/__tests__/server/factory.test.ts`

**Steps:**
1. Inject the Composio provider runtime into `createConfiguredServer`.
2. Route `search` discovery through the provider wrapper.
3. Route `execute` through the provider wrapper.
4. Preserve exactly `search` and `execute` as the registered public MCP tools.

### Task 4: Worker Boundary

**Files:**
- Modify: `worker.ts`
- Test: `src/__tests__/worker/worker-auth.test.ts`
- Test: `src/__tests__/worker/remote-worker-smoke.test.ts`

**Steps:**
1. Keep bearer-token MCP auth unchanged.
2. Validate Composio runtime secrets on `/mcp`.
3. Stop resolving direct Google OAuth before `/mcp`.
4. Keep legacy Google setup routes only as migration scaffolding until final removal.

### Task 5: Tracker and Verification

**Files:**
- GitHub issues `#108` through `#114`
- Linear `GDRIVE-*` items

**Steps:**
1. Create missing service child issues for Drive, Sheets, Docs, Gmail, Forms, Calendar, final legacy removal, and full remote smoke.
2. Link child issues to `#114` and corresponding Linear items.
3. Run relevant local checks.
4. Attempt remote Cloudflare Workers `/mcp` smoke only with live Composio and Worker credentials available.
5. Post redacted evidence and stop on credential/provider blockers.

