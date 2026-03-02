---
status: done
priority: p2
issue_id: "012"
tags: [reliability, auth, file-paths, stdio]
dependencies: []
---

# OAuth Key File Fallback Path Tightly Coupled to Build Directory Structure

## Problem Statement

`src/server/transports/stdio.ts:36` — The default OAuth key file path is resolved using `../../../../credentials/gcp-oauth.keys.json` relative to the compiled output location of the file. This is tightly coupled to the current `outDir` in `tsconfig.json`. If the output layout changes (flatter emit, different `outDir`, Docker volume mounts), this path silently breaks and auth fails.

## Findings

- `stdio.ts:36` — `path.join(path.dirname(new URL(import.meta.url).pathname), '../../../../credentials/...')`
- `../../../../` assumes compiled file is at `dist/server/transports/stdio.js` — 4 levels deep
- Docker environment may have different directory structure
- `GDRIVE_OAUTH_PATH` env var overrides this, but fallback is unreliable
- Source: CodeRabbit 🟠 Major

## Proposed Solutions

### Option 1: Resolve Relative to process.cwd()

**Approach:** Change fallback to `path.join(process.cwd(), 'credentials/gcp-oauth.keys.json')`.

**Pros:**
- `process.cwd()` is the project root in all standard Node.js invocations
- Works regardless of output directory structure

**Cons:**
- May differ in some deployment contexts (but cwd is standard)

**Effort:** 15 minutes

**Risk:** Low

---

### Option 2: Require GDRIVE_OAUTH_PATH Explicitly

**Approach:** Remove the fallback entirely and throw a clear error if `GDRIVE_OAUTH_PATH` is not set.

**Pros:**
- Explicit is better than silent fallback
- Forces users to configure properly

**Cons:**
- Breaking change for users relying on fallback

**Effort:** 15 minutes

**Risk:** Low-Medium

---

### Option 3: Relative to Package Root via import.meta.resolve / __dirname

**Approach:** Use a root-finding mechanism (e.g., walk up directories looking for `package.json`) to reliably locate the project root.

**Pros:**
- Works in any structure

**Cons:**
- Overkill for this use case

**Effort:** 1 hour

**Risk:** Low

## Recommended Action

Completed on 2026-02-26: implemented and verified in this session.

## Technical Details

**Affected files:**
- `src/server/transports/stdio.ts:33-38` — `getOAuthKeysPath()` function

## Resources

- **PR:** #40
- **Comment:** CodeRabbit `src/server/transports/stdio.ts#36`

## Acceptance Criteria

- [x] OAuth key file path resolves correctly regardless of TypeScript `outDir`
- [x] Path works in both local development and Docker environments
- [x] Clear error message if neither `GDRIVE_OAUTH_PATH` nor fallback file exists
- [x] Tested with Docker build (`docker run` confirms auth file loading)

## Work Log

### 2026-02-25 - Todo Created

**By:** Claude Code

**Actions:**
- Filed from CodeRabbit PR #40 review comment `src/server/transports/stdio.ts#36`

### 2026-02-26 - Todo Completed

**By:** Codex

**Actions:**
- Implemented the fix in code
- Added/updated regression tests
- Verified with type-check, build, and test runs

**Outcome:**
- Todo resolved and validated
