---
status: done
priority: p1
issue_id: "006"
tags: [security, auth, kv-store, encryption, workers]
dependencies: []
---

# Workers Auth Stores OAuth Tokens in KV as Plaintext JSON

## Problem Statement

`src/auth/workers-auth.ts:113` — The Workers auth path reads and writes OAuth tokens (access + refresh) as raw plaintext JSON directly to Cloudflare KV. Unlike the Node.js path which uses `TokenManager.saveTokens()` with AES-GCM encryption, the Workers path bypasses encryption entirely, leaving sensitive credentials readable by anyone with KV namespace access.

## Findings

- `workers-auth.ts:89` — `JSON.parse(raw) as WorkersTokenData` reads plaintext directly
- `workers-auth.ts:109` — `kv.put(KV_TOKEN_KEY, JSON.stringify(updated))` writes plaintext directly
- Main Node.js token path uses `GDRIVE_TOKEN_ENCRYPTION_KEY` with AES-GCM via `src/storage/kv-store.ts`
- Workers path completely bypasses this encryption layer
- Cloudflare KV is a shared namespace — access controls are coarse-grained
- Source: CodeRabbit 🟠 Major

## Proposed Solutions

### Option 1: Use `src/storage/kv-store.ts` KVStore Class

**Approach:** Refactor `workers-auth.ts` to use the existing `KVStore` class (which implements AES-GCM encryption) instead of calling `kv.put`/`kv.get` directly.

**Pros:**
- Reuses existing encryption infrastructure
- Consistent with main token storage path

**Cons:**
- Requires `KVStore` to be Workers-compatible (needs verification)

**Effort:** 2-3 hours

**Risk:** Low-Medium

---

### Option 2: Inline AES-GCM Encryption in workers-auth.ts

**Approach:** Use the Web Crypto API (available in CF Workers) to encrypt/decrypt token JSON with the `GDRIVE_TOKEN_ENCRYPTION_KEY` env var.

**Pros:**
- No dependency on Node.js `KVStore` implementation
- Web Crypto is natively available in Workers

**Cons:**
- Code duplication vs shared `KVStore`

**Effort:** 2-3 hours

**Risk:** Low

## Recommended Action

Completed on 2026-02-26: implemented and verified in this session.

## Technical Details

**Affected files:**
- `src/auth/workers-auth.ts:89,109,113` — read/write token paths
- `src/storage/kv-store.ts` — existing encryption implementation (reference)

## Resources

- **PR:** #40
- **Comment:** CodeRabbit `src/auth/workers-auth.ts#113`

## Acceptance Criteria

- [x] OAuth tokens stored in KV are encrypted at rest
- [x] Encryption uses same key format as `GDRIVE_TOKEN_ENCRYPTION_KEY`
- [x] Token read path decrypts correctly before use
- [x] No plaintext token JSON visible in KV namespace
- [x] Auth flow tested end-to-end with encrypted KV tokens

## Work Log

### 2026-02-25 - Todo Created

**By:** Claude Code

**Actions:**
- Filed from CodeRabbit PR #40 review comment `src/auth/workers-auth.ts#113`

### 2026-02-26 - Todo Completed

**By:** Codex

**Actions:**
- Implemented the fix in code
- Added/updated regression tests
- Verified with type-check, build, and test runs

**Outcome:**
- Todo resolved and validated
