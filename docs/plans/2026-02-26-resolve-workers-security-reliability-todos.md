# Resolve Workers Security & Reliability Todos Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Resolve all pending `todos/` items sequentially (001 → 011) with code fixes and regression tests.

**Architecture:** Keep the existing v4 server shape, then harden Worker request ingress, token handling, runtime guards, and infrastructure helpers. Prefer focused, backwards-compatible fixes with explicit validation and shared helpers where possible.

**Tech Stack:** TypeScript, Cloudflare Workers, @modelcontextprotocol/sdk, Jest, Redis, Node vm

---

### Task 1: Add Worker Bearer Auth + Optional Origin Allowlist (Todo 001)

**Files:**
- Modify: `worker.ts`
- Test: `src/__tests__/worker/worker-auth.test.ts` (new)

**Step 1: Write failing tests**
- Missing `Authorization` returns `401`.
- Invalid bearer token returns `401`.
- Valid bearer token allows request flow to continue.
- If allowlist is configured, disallowed `Origin` returns `403`.

**Step 2: Implement minimal fix**
- Add `MCP_BEARER_TOKEN` and optional `MCP_ALLOWED_ORIGINS` to Worker env.
- Validate `Authorization: Bearer <token>` before auth/token resolution.
- Parse optional comma-separated origin allowlist and reject non-matching origins.

**Step 3: Verify tests pass**
- Run targeted test file.

### Task 2: Fix RateLimiter counter bypass bug (Todo 002)

**Files:**
- Modify: `src/sdk/rate-limiter.ts`
- Test: `src/__tests__/sdk/rate-limiter.test.ts` (new)

**Step 1: Write failing concurrency test**
- Queue more than `maxRequests` calls and assert active calls never exceed max.

**Step 2: Implement minimal fix**
- In `release`, when dequeuing waiter, pre-occupy released slot by incrementing counter before waking waiter.

**Step 3: Verify tests pass**
- Run new rate limiter tests.

### Task 3: Add async timeout guard in Node sandbox (Todo 003)

**Files:**
- Modify: `src/sdk/sandbox-node.ts`
- Test: `src/__tests__/sdk/sandbox-node-timeout.test.ts` (new)

**Step 1: Write failing test**
- Async never-resolving code should return timeout error within bounded time.

**Step 2: Implement minimal fix**
- Wrap `runInContext` promise in `Promise.race` with timer rejection.
- Keep existing sync `timeout` option and add explicit async timeout message.

**Step 3: Verify tests pass**
- Run sandbox timeout tests.

### Task 4: Restrict Worker tsconfig scope (Todo 004)

**Files:**
- Modify: `tsconfig.worker.json`

**Step 1: Implement fix**
- Remove broad `src/modules/**/*.ts` include.
- Keep only Worker-required files and dependencies.

**Step 2: Verify**
- Run Worker type-check/build to confirm compile.

### Task 5: Remove `as any` transport construction in Worker (Todo 005)

**Files:**
- Modify: `worker.ts`

**Step 1: Implement fix**
- Construct `WebStandardStreamableHTTPServerTransport` with properly typed options.
- Avoid `as any` cast.

**Step 2: Verify**
- Run TypeScript checks.

### Task 6: Encrypt Worker KV token storage (Todo 006)

**Files:**
- Modify: `src/auth/workers-auth.ts`
- Potential helper reuse: `src/storage/kv-store.ts`
- Test: `src/__tests__/auth/workers-auth.test.ts` (new)

**Step 1: Write failing tests**
- Persisted KV payload is encrypted, not plaintext token JSON.
- Read path decrypts payload correctly with configured key.

**Step 2: Implement fix**
- Add encryption/decryption to Worker token read/write path using Web Crypto helpers.
- Require `GDRIVE_TOKEN_ENCRYPTION_KEY` in Worker env for token operations.

**Step 3: Verify tests pass**
- Run targeted auth tests.

### Task 7: Handle encrypted/plain token format mismatch explicitly (Todo 007)

**Files:**
- Modify: `src/auth/workers-auth.ts`
- Test: `src/__tests__/auth/workers-auth.test.ts`

**Step 1: Write failing tests**
- Malformed/unknown payload shape throws actionable error.
- Legacy plaintext still readable during transition (if supported) or rejected clearly.

**Step 2: Implement fix**
- Add shape validation and format detection.
- Never allow `undefined` access token to propagate silently.

**Step 3: Verify**
- Run auth tests.

### Task 8: Fix rotate-key target version usage (Todo 008)

**Files:**
- Modify: `scripts/rotate-key.ts`
- Test: `src/__tests__/cli/rotate-key.test.ts` (new)

**Step 1: Write failing test**
- Rotation re-encrypts under intended new version.

**Step 2: Implement fix**
- Set active key version to `newVersion` before `saveTokens` and restore/log safely.

**Step 3: Verify**
- Run rotate-key tests.

### Task 9: Share RateLimiter across execute calls (Todo 009)

**Files:**
- Modify: `src/sdk/runtime.ts`
- Modify: `src/server/factory.ts`
- Test: `src/__tests__/sdk/runtime-rate-limiter-scope.test.ts` (new)

**Step 1: Write failing test**
- Multiple `createSDKRuntime` calls with shared limiter enforce global cap.

**Step 2: Implement fix**
- Hoist limiter creation to server scope and inject into runtime factory.

**Step 3: Verify**
- Run runtime limiter tests.

### Task 10: Add cycle-safe error serializer (Todo 010)

**Files:**
- Modify: `src/server/bootstrap.ts`
- Test: `src/__tests__/server/bootstrap-error-serializer.test.ts` (new)

**Step 1: Write failing test**
- Circular error metadata serializes without stack overflow and includes `[Circular]`.

**Step 2: Implement fix**
- Add `WeakSet`-based cycle detection in recursive serializer.

**Step 3: Verify**
- Run bootstrap serializer test.

### Task 11: Replace Redis `KEYS` with `SCAN` invalidation (Todo 011)

**Files:**
- Modify: `src/server/bootstrap.ts`
- Test: `src/__tests__/server/cache-invalidate-scan.test.ts` (new)

**Step 1: Write failing test**
- Invalidation uses scan loop and deletes matched keys in batches.

**Step 2: Implement fix**
- Use cursor-based `SCAN` (`MATCH` + `COUNT`) until cursor returns `0`.
- Preserve existing invalidate semantics.

**Step 3: Verify**
- Run cache invalidation test.

### Final Verification

**Commands:**
- `npm run type-check`
- `npm test -- --runInBand`
- `npm run build`

Expected:
- All targeted tests pass.
- No new TypeScript errors.
- Worker and Node builds complete.
