---
status: done
priority: p2
issue_id: "013"
tags: [security, encryption, kv-store, validation]
dependencies: []
---

# KV Store Accepts Any Key Length Before crypto.subtle.importKey

## Problem Statement

`src/storage/kv-store.ts:22` — `importKey()` decodes the base64 key and passes it directly to `crypto.subtle.importKey` without validating that it's exactly 32 bytes. AES-256-GCM requires exactly 32 bytes (256 bits). While WebCrypto will reject shorter keys, it may silently accept longer ones truncated or padded in unexpected ways, leading to inconsistent encryption behavior or subtle security weaknesses.

## Findings

- `kv-store.ts:22` — `Uint8Array.from(atob(rawKey), ...)` then immediately calls `crypto.subtle.importKey`
- No `keyBytes.length === 32` check before import
- A misconfigured 24-byte key (AES-192) may be accepted by some WebCrypto implementations
- Mismatch with `GDRIVE_TOKEN_ENCRYPTION_KEY` documentation which states "32-byte base64 key"
- Source: CodeRabbit 🟠 Major

## Proposed Solutions

### Option 1: Assert Exactly 32 Bytes

**Approach:** Add `if (keyBytes.length !== 32) throw new Error(\`Encryption key must be 32 bytes, got \${keyBytes.length}\`)` before `importKey`.

**Pros:**
- Clear error message guides misconfiguration debugging
- Enforces documented contract

**Cons:**
- None

**Effort:** 15 minutes

**Risk:** Low

## Recommended Action

Completed on 2026-02-26: implemented and verified in this session.

## Technical Details

**Affected files:**
- `src/storage/kv-store.ts:20-25` — `importKey()` function

## Resources

- **PR:** #40
- **Comment:** CodeRabbit `src/storage/kv-store.ts#22`

## Acceptance Criteria

- [x] `importKey()` throws clear error if decoded key is not exactly 32 bytes
- [x] Error message includes actual byte length and expected 32
- [x] Test: pass 16-byte key, verify clear error. Pass 32-byte key, verify success.
- [x] `GDRIVE_TOKEN_ENCRYPTION_KEY` generation docs mention `openssl rand -base64 32` produces correct length

## Work Log

### 2026-02-25 - Todo Created

**By:** Claude Code

**Actions:**
- Filed from CodeRabbit PR #40 review comment `src/storage/kv-store.ts#22`

### 2026-02-26 - Todo Completed

**By:** Codex

**Actions:**
- Implemented the fix in code
- Added/updated regression tests
- Verified with type-check, build, and test runs

**Outcome:**
- Todo resolved and validated
