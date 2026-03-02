---
status: done
priority: p2
issue_id: "011"
tags: [performance, redis, caching, bootstrap]
dependencies: []
---

# Redis KEYS Command Blocks Server During Cache Invalidation

## Problem Statement

`src/server/bootstrap.ts:199` — Cache invalidation uses `client.keys(pattern)` which is a blocking O(N) Redis command that iterates all keys. On production Redis with large key sets this blocks the entire server event loop for the duration of the scan, causing latency spikes or timeouts for concurrent requests. Redis documentation explicitly warns against using `KEYS` in production.

## Findings

- `bootstrap.ts:199` — `const keys = await this.client.keys(pattern)` in cache invalidation path
- `KEYS` is O(N) where N is total keys in the Redis keyspace — blocks all other Redis operations
- Redis documentation: "Don't use KEYS in production code. Use SCAN instead."
- `SCAN` is non-blocking and iterates in small batches
- Source: CodeRabbit 🟠 Major

## Proposed Solutions

### Option 1: Replace KEYS with SCAN Iterator

**Approach:** Use `client.scan()` in a loop (or `client.scanIterator()` if using `ioredis`) to iterate keys matching the pattern in batches without blocking.

**Pros:**
- Non-blocking, safe for production
- Direct drop-in semantic replacement

**Cons:**
- Slightly more complex implementation
- Invalidation takes multiple round-trips (acceptable)

**Effort:** 1-2 hours

**Risk:** Low

---

### Option 2: Prefix-Based Key Design for O(1) Invalidation

**Approach:** Structure cache keys with a namespace prefix and use `UNLINK` (async `DEL`) on known keys rather than pattern scanning.

**Pros:**
- Most efficient — no scanning at all

**Cons:**
- Requires cache key management rework

**Effort:** 3-4 hours

**Risk:** Medium

## Recommended Action

Completed on 2026-02-26: implemented and verified in this session.

## Technical Details

**Affected files:**
- `src/server/bootstrap.ts:195-205` — `invalidateCache()` method

## Resources

- **PR:** #40
- **Comment:** CodeRabbit `src/server/bootstrap.ts#199`
- **Redis docs:** https://redis.io/commands/keys/ (production warning)

## Acceptance Criteria

- [x] `KEYS` command removed from all production code paths
- [x] Cache invalidation uses non-blocking `SCAN` or structured key management
- [x] No Redis blocking during cache invalidation under load
- [x] Existing cache invalidation behavior preserved (correct keys are deleted)

## Work Log

### 2026-02-25 - Todo Created

**By:** Claude Code

**Actions:**
- Filed from CodeRabbit PR #40 review comment `src/server/bootstrap.ts#199`

### 2026-02-26 - Todo Completed

**By:** Codex

**Actions:**
- Implemented the fix in code
- Added/updated regression tests
- Verified with type-check, build, and test runs

**Outcome:**
- Todo resolved and validated
