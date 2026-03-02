---
status: done
priority: p1
issue_id: "008"
tags: [security, key-rotation, tokens, encryption]
dependencies: []
---

# Key Rotation Saves Tokens Under Old Key Version Instead of New

## Problem Statement

`scripts/rotate-key.ts:50` — `rotateKey()` calculates `newVersion`, verifies the new env key exists, but immediately calls `tokenManager.saveTokens(tokens)` without first switching the active key version. Since `TokenManager.saveTokens` encrypts with the _current_ key version (not the new one), the rotation command reports success while tokens remain encrypted under the old key. After operators update `GDRIVE_TOKEN_CURRENT_KEY_VERSION` and retire the old key, token decryption will fail.

## Findings

- `rotate-key.ts:50` — `saveTokens(tokens)` called before active key version is updated
- `TokenManager.saveTokens()` reads `GDRIVE_TOKEN_CURRENT_KEY_VERSION` from env to select encryption key
- Rotation sequence is: load tokens → verify new key → **save (still using old key)** → report success
- The bug is silent — no error, rotation "succeeds", but tokens are encrypted with wrong key
- Manifests only after operator retires old key, causing auth failures
- Source: Codex P1

## Proposed Solutions

### Option 1: Switch Active Key Version Before Saving

**Approach:** Before calling `saveTokens(tokens)`, set the active key version in the `TokenManager` instance (or update `process.env.GDRIVE_TOKEN_CURRENT_KEY_VERSION`) to `newVersion`.

**Pros:**
- Correct fix — tokens are encrypted with new key before old key is retired
- Minimal change to existing flow

**Cons:**
- Must ensure env var mutation doesn't have side effects

**Effort:** 1-2 hours

**Risk:** Low

---

### Option 2: Accept Target Version as Parameter to saveTokens

**Approach:** Modify `TokenManager.saveTokens(tokens, targetVersion?)` to accept an optional explicit version, bypassing the env var.

**Pros:**
- More explicit API, no env mutation needed

**Cons:**
- Larger interface change

**Effort:** 2-3 hours

**Risk:** Low-Medium

## Recommended Action

Completed on 2026-02-26: implemented and verified in this session.

## Technical Details

**Affected files:**
- `scripts/rotate-key.ts:40-60` — `rotateKey()` function
- `src/auth/token-manager.ts` — `saveTokens()` key version selection

## Resources

- **PR:** #40
- **Comment:** Codex `scripts/rotate-key.ts#50`

## Acceptance Criteria

- [x] After `rotate-key.ts` runs, tokens are encrypted with the new target key version
- [x] `GDRIVE_TOKEN_CURRENT_KEY_VERSION` can be safely updated without decryption failure
- [x] Old key can be retired after successful rotation without breaking auth
- [x] Integration test: rotate key, verify tokens decrypt with new key, verify old key no longer needed

## Work Log

### 2026-02-25 - Todo Created

**By:** Claude Code

**Actions:**
- Filed from Codex PR #40 review comment `scripts/rotate-key.ts#50`

### 2026-02-26 - Todo Completed

**By:** Codex

**Actions:**
- Implemented the fix in code
- Added/updated regression tests
- Verified with type-check, build, and test runs

**Outcome:**
- Todo resolved and validated
