---
status: done
priority: p2
issue_id: "014"
tags: [caching, kv-store, workers, reliability]
dependencies: []
---

# KV Cache Invalidation Uses Expiry Hack Instead of Proper Delete

## Problem Statement

`src/storage/kv-store.ts:90` — The `invalidateCache()` method cannot delete KV entries by pattern (Cloudflare KV has no `KEYS`/`SCAN` equivalent), so it uses a workaround: `kv.put(pattern, JSON.stringify(null), { expirationTtl: 1 })` to overwrite with a null value that expires in 1 second. This is a best-effort hack that (a) only works when `pattern` is an exact key, (b) leaves a 1-second window where the null value is served as valid cache data, and (c) is semantically incorrect.

## Findings

- `kv-store.ts:90` — `kv.put(pattern, JSON.stringify(null), { expirationTtl: 1 })` in cache invalidation
- Cloudflare KV has no server-side key scanning — pattern-based invalidation is inherently limited
- The null value could be deserialized and returned as valid cache data within the 1-second TTL window
- Comment in code acknowledges "best-effort: only works when pattern equals an exact key"
- Source: CodeRabbit 🟠 Major

## Proposed Solutions

### Option 1: Use kv.delete() for Exact Key Invalidation

**Approach:** Replace the TTL hack with `kv.delete(pattern)` when `pattern` is an exact key. For pattern-based invalidation, document that it's not supported in CF KV.

**Pros:**
- Semantically correct — entry is actually deleted
- No 1-second window of serving null

**Cons:**
- Pattern-based invalidation still impossible in CF KV

**Effort:** 30 minutes

**Risk:** Low

---

### Option 2: Cache Key Registry with Tag-Based Invalidation

**Approach:** Maintain a separate KV key (`cache:registry:*`) that stores all cache keys for a given tag/prefix. On invalidation, read the registry and delete all listed keys.

**Pros:**
- Enables tag-based invalidation

**Cons:**
- Registry management adds complexity; race conditions possible

**Effort:** 4-6 hours

**Risk:** Medium

---

### Option 3: Short-Circuit Cache Reads for null Values

**Approach:** Keep current approach but add a guard: if cached value is `null`, treat as cache miss.

**Pros:**
- Quick fix that prevents null being served as valid data

**Cons:**
- Doesn't fix semantic incorrectness; still uses expiry hack

**Effort:** 15 minutes

**Risk:** Low

## Recommended Action

Completed on 2026-02-26: implemented and verified in this session.

## Technical Details

**Affected files:**
- `src/storage/kv-store.ts:85-98` — `invalidateCache()` method

## Resources

- **PR:** #40
- **Comment:** CodeRabbit `src/storage/kv-store.ts#90`

## Acceptance Criteria

- [x] Exact-key invalidation uses `kv.delete()` not TTL hack
- [x] Cache reads never return `null` as valid cached data
- [x] Pattern-based invalidation limitations documented in code comments
- [x] Existing cache behavior preserved (reads/writes unaffected)

## Work Log

### 2026-02-25 - Todo Created

**By:** Claude Code

**Actions:**
- Filed from CodeRabbit PR #40 review comment `src/storage/kv-store.ts#90`

### 2026-02-26 - Todo Completed

**By:** Codex

**Actions:**
- Implemented the fix in code
- Added/updated regression tests
- Verified with type-check, build, and test runs

**Outcome:**
- Todo resolved and validated
