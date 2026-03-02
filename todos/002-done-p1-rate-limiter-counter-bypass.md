---
status: done
priority: p1
issue_id: "002"
tags: [bug, rate-limiter, sdk, concurrency]
dependencies: []
---

# Rate Limiter Counter Bypass Bug Allows Over-Quota Concurrent Calls

## Problem Statement

`src/sdk/rate-limiter.ts:57` — When `release()` wakes a queued waiter via `next()`, the dequeued caller never increments the service counter. After queueing begins, `counters` under-reports in-flight calls, allowing more than `maxRequests` concurrent operations. The rate limiter becomes progressively weaker the more requests are queued.

## Findings

- `rate-limiter.ts:57` — `release()` decrements counter and calls `next()`, but `next()` resolves the queued promise without incrementing the counter for the resumed caller
- Concurrency invariant broken: `counters[service]` no longer accurately reflects in-flight count once any request has been queued
- Subsequent `acquire()` calls compare against a smaller-than-real counter, admitting excess concurrent calls
- Sources: CodeRabbit (🔴 Critical) and Codex P2 (`rate-limiter.ts#55`) both flagged this

## Proposed Solutions

### Option 1: Increment Counter Before Calling next()

**Approach:** In `release()`, increment the counter before dequeuing the next waiter so the slot is "pre-occupied" before the waiter resumes.

**Pros:**
- Minimal change, preserves existing queue structure
- Fixes the invariant cleanly

**Cons:**
- Counter increment and `next()` call must be atomic (fine in single-threaded JS)

**Effort:** 30 minutes

**Risk:** Low

---

### Option 2: Have Queued Callers Re-acquire After Waking

**Approach:** Change queue resolution so the woken caller goes through `acquire()` logic again rather than being directly resolved.

**Pros:**
- Cleaner semantics — every in-flight slot goes through one path

**Cons:**
- More restructuring required

**Effort:** 1-2 hours

**Risk:** Medium

## Recommended Action

Completed on 2026-02-26: implemented and verified in this session.

## Technical Details

**Affected files:**
- `src/sdk/rate-limiter.ts:50-60` — `release()` method

## Resources

- **PR:** #40
- **Comment:** CodeRabbit `src/sdk/rate-limiter.ts#57`, Codex `src/sdk/rate-limiter.ts#55`

## Acceptance Criteria

- [x] Counter accurately reflects in-flight count even after queued callers are woken
- [x] Cannot exceed `maxRequests` concurrent calls under load
- [x] Unit test: queue 2× maxRequests calls, verify no more than maxRequests run concurrently
- [x] Existing rate limiter tests pass

## Work Log

### 2026-02-25 - Todo Created

**By:** Claude Code

**Actions:**
- Filed from CodeRabbit PR #40 review comment `src/sdk/rate-limiter.ts#57` (Critical) and Codex `#55` (P2)

**Learnings:**
- Both reviewers independently caught this — high confidence it's a real bug

### 2026-02-26 - Todo Completed

**By:** Codex

**Actions:**
- Implemented the fix in code
- Added/updated regression tests
- Verified with type-check, build, and test runs

**Outcome:**
- Todo resolved and validated
