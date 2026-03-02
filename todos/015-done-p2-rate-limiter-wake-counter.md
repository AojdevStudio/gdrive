---
status: done
priority: p2
issue_id: "015"
tags: [bug, rate-limiter, sdk, concurrency]
dependencies: ["002"]
---

# Rate Limiter Wake Counter Not Incremented When Dequeuing Waiters

## Problem Statement

`src/sdk/rate-limiter.ts:55` — When `release()` wakes a queued request by calling `next()`, the service counter is not incremented for the resumed caller. After queueing begins, the counter under-reports in-flight calls, weakening quota protection. This is closely related to todo #002 (which identified the same bug from a different review comment).

## Findings

- `rate-limiter.ts:55` — `next()` called in `release()` without incrementing `counters[service]`
- `next()` resolves the queued promise directly — the resolved caller holds a slot without the counter reflecting it
- `acquire()` may allow additional callers based on the under-counted `counters` value
- Source: Codex P2 (complements CodeRabbit Critical finding in todo #002)

## Proposed Solutions

### Option 1: Increment Counter in release() Before next()

**Approach:** Add `this.counters.set(service, current)` (keeping count the same — the slot transfers from the releasing caller to the woken caller) rather than decrement + increment. Or: don't decrement in `release()` when there's a queued waiter — just call `next()` and transfer the slot.

**Pros:**
- Slot transfer preserves invariant: count always reflects in-flight callers

**Cons:**
- Subtle logic change — must verify no double-counting

**Effort:** 30 minutes – 1 hour

**Risk:** Low

## Recommended Action

Completed on 2026-02-26: implemented and verified in this session. Coordinate with todo #002 — same root cause, resolve together.

## Technical Details

**Affected files:**
- `src/sdk/rate-limiter.ts:50-60` — `release()` method

**Dependencies:**
- Closely related to todo #002 (counter bypass). Resolve both in same PR.

## Resources

- **PR:** #40
- **Comment:** Codex `src/sdk/rate-limiter.ts#55`

## Acceptance Criteria

- [x] Service counter accurately reflects in-flight count throughout queue lifecycle
- [x] Woken waiter's slot is counted
- [x] Cannot exceed maxRequests concurrently (covered by todo #002 acceptance criteria)
- [x] Covered by same unit tests as todo #002

## Work Log

### 2026-02-25 - Todo Created

**By:** Claude Code

**Actions:**
- Filed from Codex PR #40 review comment `src/sdk/rate-limiter.ts#55`
- Marked as dependent on and related to todo #002

### 2026-02-26 - Todo Completed

**By:** Codex

**Actions:**
- Implemented the fix in code
- Added/updated regression tests
- Verified with type-check, build, and test runs

**Outcome:**
- Todo resolved and validated
