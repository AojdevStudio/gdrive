---
status: done
priority: p1
issue_id: "007"
tags: [security, auth, workers, tokens, kv-store]
dependencies: ["006"]
---

# Workers Auth Path Cannot Handle Encrypted Token Format from TokenManager

## Problem Statement

`src/auth/workers-auth.ts:93` — `getValidAccessToken()` assumes the KV payload is plaintext `WorkersTokenData` with `access_token` and `expiry_date` fields. However, when users run the `auth` command, `authenticateAndSave()` stores tokens via `TokenManager.saveTokens()` which produces an encrypted versioned blob. If that encrypted blob is uploaded to KV, `tokens.access_token` and `tokens.expiry_date` are both `undefined`, causing all Google API calls to fail at runtime with an opaque auth error.

## Findings

- `workers-auth.ts:93` — `JSON.parse(raw) as WorkersTokenData` — treats any KV payload as plaintext
- `authenticateAndSave()` calls `tokenManager.saveTokens()` which writes `{ version, iv, data }` encrypted format
- No format detection or error on unexpected payload shape
- Results in `undefined` bearer token being passed to Google APIs — fails silently
- Source: Codex P1

## Proposed Solutions

### Option 1: Format Detection with Fallback

**Approach:** After parsing, check if the object has `version`/`iv`/`data` fields (encrypted format). If so, decrypt via `TokenManager.loadTokens()` before using.

**Pros:**
- Handles both formats during transition period

**Cons:**
- Mixed format support adds complexity

**Effort:** 2-3 hours

**Risk:** Medium

---

### Option 2: Standardize on Single Token Format

**Approach:** Pick one canonical format for KV. Either always encrypted (preferred — aligns with todo #006) or always plaintext. Update both write and read paths.

**Pros:**
- Eliminates ambiguity permanently

**Cons:**
- Requires coordinating with todo #006

**Effort:** 3-4 hours

**Risk:** Low (correct long-term approach)

---

### Option 3: Validate Payload Shape and Reject Early

**Approach:** After parsing, validate that required fields exist. If not, throw a clear error: "KV token payload is malformed — expected WorkersTokenData with access_token and expiry_date."

**Pros:**
- Immediate, clear failure instead of silent undefined
- Minimal code change

**Cons:**
- Doesn't fix root cause — user still needs to re-auth

**Effort:** 30 minutes

**Risk:** Low (quick improvement)

## Recommended Action

Completed on 2026-02-26: implemented and verified in this session.

## Technical Details

**Affected files:**
- `src/auth/workers-auth.ts:89-100` — `getValidAccessToken()` token parsing
- `src/auth/workers-auth.ts` — `authenticateAndSave()` write path

**Dependencies:**
- Closely related to todo #006 (KV plaintext storage). Best resolved together.

## Resources

- **PR:** #40
- **Comment:** Codex `src/auth/workers-auth.ts#93`

## Acceptance Criteria

- [x] `getValidAccessToken()` never returns `undefined` silently
- [x] Mismatched KV payload format produces a clear, actionable error
- [x] Both write and read paths use consistent token format
- [x] Auth flow tested with tokens written by `authenticateAndSave()`

## Work Log

### 2026-02-25 - Todo Created

**By:** Claude Code

**Actions:**
- Filed from Codex PR #40 review comment `src/auth/workers-auth.ts#93`
- Marked as dependent on todo #006

### 2026-02-26 - Todo Completed

**By:** Codex

**Actions:**
- Implemented the fix in code
- Added/updated regression tests
- Verified with type-check, build, and test runs

**Outcome:**
- Todo resolved and validated
