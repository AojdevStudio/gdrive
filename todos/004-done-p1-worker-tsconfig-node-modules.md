---
status: done
priority: p1
issue_id: "004"
tags: [build, cloudflare-workers, tsconfig, bundling]
dependencies: []
---

# Worker tsconfig Includes Node.js-Only Modules in CF Workers Bundle

## Problem Statement

`tsconfig.worker.json:19` includes `src/modules/**/*.ts` which pulls in Node.js-specific code (fs, path, crypto, child_process, etc.) into the Cloudflare Workers bundle. Workers runs on V8 isolates without a Node.js runtime, so any imported Node.js built-in will throw at runtime with an opaque error.

## Findings

- `tsconfig.worker.json:19` — `"src/modules/**/*.ts"` glob includes all module files
- `src/modules/` contains code written for the original Node.js server (Drive, Sheets, Forms, Docs, Gmail, Calendar handlers)
- Cloudflare Workers does not support Node.js built-ins unless explicitly polyfilled via `nodejs_compat` flag
- Bundle compiles without error at build time — failure only manifests at runtime, making this insidious
- Source: CodeRabbit 🔴 Critical

## Proposed Solutions

### Option 1: Explicit Include List for Worker

**Approach:** Replace the glob with an explicit list of only Workers-compatible files in `tsconfig.worker.json`.

**Pros:**
- Precise control over bundle contents

**Cons:**
- Must be manually maintained as new files are added

**Effort:** 30 minutes

**Risk:** Low

---

### Option 2: Separate workers/ Directory

**Approach:** Move Workers-specific implementations into `src/workers/` and include only that in `tsconfig.worker.json`.

**Pros:**
- Clear architectural boundary
- Glob is safe because directory is purpose-built

**Cons:**
- Requires moving/refactoring files

**Effort:** 2-4 hours

**Risk:** Medium

---

### Option 3: Enable `nodejs_compat` in wrangler.toml

**Approach:** Add `compatibility_flags = ["nodejs_compat"]` to enable Node.js polyfills in CF Workers.

**Pros:**
- May allow existing modules to work with minimal changes

**Cons:**
- Polyfills increase bundle size; not all Node.js APIs are covered
- Doesn't fix the architectural problem

**Effort:** 30 minutes

**Risk:** Medium

## Recommended Action

Completed on 2026-02-26: implemented and verified in this session.

## Technical Details

**Affected files:**
- `tsconfig.worker.json:19` — include glob
- `src/modules/**` — potentially incompatible with Workers runtime

## Resources

- **PR:** #40
- **Comment:** CodeRabbit `tsconfig.worker.json#19`

## Acceptance Criteria

- [x] Worker bundle does not include Node.js-only built-in imports
- [x] `wrangler deploy --dry-run` produces no Node.js compatibility warnings
- [x] All 6 Google service operations function correctly in Workers environment
- [x] Build process validated against CF Workers runtime constraints

## Work Log

### 2026-02-25 - Todo Created

**By:** Claude Code

**Actions:**
- Filed from CodeRabbit PR #40 review comment `tsconfig.worker.json#19`

### 2026-02-26 - Todo Completed

**By:** Codex

**Actions:**
- Implemented the fix in code
- Added/updated regression tests
- Verified with type-check, build, and test runs

**Outcome:**
- Todo resolved and validated
