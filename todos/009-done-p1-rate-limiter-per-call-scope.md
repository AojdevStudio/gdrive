---
status: done
priority: p1
issue_id: "009"
tags: [performance, rate-limiter, sdk, architecture]
dependencies: ["002"]
---

# Rate Limiter Recreated Per execute() Call — No Cross-Call Quota Protection

## Problem Statement

`src/sdk/runtime.ts:14` — `createSDKRuntime()` instantiates a new `RateLimiter` on every `execute()` invocation. Rate limiting within a single execute call works, but across multiple concurrent calls (the primary quota-exhaustion vector for Google APIs) the limiter provides no protection because each call has its own fresh counter starting at zero.

## Findings

- `runtime.ts:14` — `const limiter = new RateLimiter()` inside `createSDKRuntime()`
- `src/server/factory.ts:172-173` — `createSDKRuntime` called per `execute()` invocation
- Each call gets a fresh limiter — N concurrent calls = N independent limiters, each allowing `maxRequests`
- Effective concurrency limit: `N × maxRequests` instead of `maxRequests`
- This is the main Google API quota exhaustion path for high-traffic usage
- Source: CodeRabbit 🟠 Major

## Proposed Solutions

### Option 1: Hoist RateLimiter to Server/Factory Scope

**Approach:** Create `RateLimiter` once at server initialization time in `factory.ts` or `bootstrap.ts`, pass it down to `createSDKRuntime` as a dependency.

**Pros:**
- Single limiter shared across all execute calls — correct behavior
- Minimal change to runtime logic

**Cons:**
- Requires threading the limiter through factory/bootstrap code

**Effort:** 1-2 hours

**Risk:** Low

---

### Option 2: Module-Level Singleton

**Approach:** Export a module-level `RateLimiter` singleton from `rate-limiter.ts`. Import it in `runtime.ts`.

**Pros:**
- Simplest implementation

**Cons:**
- Harder to test (global state)
- Workers environment may not support module-level state correctly

**Effort:** 30 minutes

**Risk:** Medium

## Recommended Action

Completed on 2026-02-26: implemented and verified in this session.

## Technical Details

**Affected files:**
- `src/sdk/runtime.ts:14` — RateLimiter instantiation
- `src/server/factory.ts:172-173` — createSDKRuntime call site

**Dependencies:**
- Depends on todo #002 (counter bypass bug) — fix both together for correct rate limiting

## Resources

- **PR:** #40
- **Comment:** CodeRabbit `src/sdk/runtime.ts#14`

## Acceptance Criteria

- [x] Single `RateLimiter` instance shared across all `execute()` calls for the server lifetime
- [x] `maxRequests` limit enforced globally, not per-call
- [x] Load test: 10 concurrent execute() calls respect the global rate limit
- [x] Existing unit tests pass

## Work Log

### 2026-02-25 - Todo Created

**By:** Claude Code

**Actions:**
- Filed from CodeRabbit PR #40 review comment `src/sdk/runtime.ts#14`
- Marked as dependent on todo #002 (fix the counter bug first)

### 2026-02-26 - Todo Completed

**By:** Codex

**Actions:**
- Implemented the fix in code
- Added/updated regression tests
- Verified with type-check, build, and test runs

**Outcome:**
- Todo resolved and validated
