---
status: done
priority: p1
issue_id: "003"
tags: [security, sdk, sandbox, async, timeout]
dependencies: []
---

# Sandbox runInContext Timeout Does Not Cover Async Execution

## Problem Statement

`src/sdk/sandbox-node.ts:73` — The `timeout` option passed to `script.runInContext()` only governs the synchronous portion of script execution (microseconds for an async IIFE). The actual awaited work in `await result` at line 69 has no time bound, allowing any long-running or infinite async loop to hang the host process indefinitely.

## Findings

- `sandbox-node.ts:73` — `script.runInContext(sandboxContext, { timeout: this.timeout })` returns a Promise in microseconds; the timeout is exhausted before real work begins
- `await result` (line ~69) has zero timeout coverage
- Attack vector: `while(true) { await Promise.resolve(); }` or any slow SDK call hangs the Worker process forever
- Source: CodeRabbit 🔴 Critical

## Proposed Solutions

### Option 1: Promise.race with AbortController / setTimeout

**Approach:** Wrap `await result` in a `Promise.race([result, timeoutPromise])` where `timeoutPromise` rejects after `this.timeout` ms.

**Pros:**
- Straightforward
- Works in Node.js and Workers environments

**Cons:**
- Does not actually terminate the VM context — runaway code continues running in background

**Effort:** 1 hour

**Risk:** Low (at minimum prevents hanging callers)

---

### Option 2: Worker Thread with Hard Kill

**Approach:** Run the sandbox in a Node.js `worker_thread`. Set a `setTimeout` that calls `worker.terminate()` after the timeout.

**Pros:**
- Actually kills the runaway code

**Cons:**
- Adds `worker_threads` dependency; more complex setup
- Not compatible with Cloudflare Workers environment

**Effort:** 3-4 hours

**Risk:** Medium

---

### Option 3: Cloudflare Workers `waitUntil` + CPU Time Limits

**Approach:** In Workers environment, rely on CF's built-in CPU time limits (50ms by default); for Node.js, use Option 1.

**Pros:**
- Leverages platform guarantees

**Cons:**
- Different behavior per environment

**Effort:** 1-2 hours

**Risk:** Low

## Recommended Action

Completed on 2026-02-26: implemented and verified in this session.

## Technical Details

**Affected files:**
- `src/sdk/sandbox-node.ts:69-75` — `runInContext` call and `await result`

## Resources

- **PR:** #40
- **Comment:** CodeRabbit `src/sdk/sandbox-node.ts#73`

## Acceptance Criteria

- [x] Async sandbox execution is bounded by configured timeout
- [x] Infinite async loops are terminated after timeout
- [x] Caller receives a timeout error, not a hung promise
- [x] Test: async infinite loop in sandbox is killed within timeout + 100ms buffer

## Work Log

### 2026-02-25 - Todo Created

**By:** Claude Code

**Actions:**
- Filed from CodeRabbit PR #40 review comment `src/sdk/sandbox-node.ts#73`

### 2026-02-26 - Todo Completed

**By:** Codex

**Actions:**
- Implemented the fix in code
- Added/updated regression tests
- Verified with type-check, build, and test runs

**Outcome:**
- Todo resolved and validated
