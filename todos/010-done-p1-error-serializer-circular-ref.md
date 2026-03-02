---
status: done
priority: p1
issue_id: "010"
tags: [reliability, logging, error-handling, bootstrap]
dependencies: []
---

# Error Serializer Crashes on Circular References in Metadata

## Problem Statement

`src/server/bootstrap.ts:46` — The recursive error metadata serializer has no cycle detection. If any error object contains circular references (e.g., `error.context.request = error`), the serializer will recurse indefinitely until the stack overflows, crashing the logging subsystem and potentially the entire server process.

## Findings

- `bootstrap.ts:46` — Recursive property iteration with no `seen` set or depth limit
- Node.js errors and framework errors frequently contain circular references (e.g., axios errors reference their config which references the error)
- Stack overflow in the logger kills the process without a clean error message
- `JSON.stringify` would throw a `TypeError: Converting circular structure to JSON`
- Source: CodeRabbit 🟠 Major

## Proposed Solutions

### Option 1: WeakSet Cycle Detection

**Approach:** Add a `seen = new WeakSet()` to the recursive serializer. Before recursing into an object, check if it's in `seen`; if so, return `"[Circular]"`.

**Pros:**
- Standard pattern, minimal overhead
- Handles arbitrary depth of circular refs

**Cons:**
- None significant

**Effort:** 30 minutes

**Risk:** Low

---

### Option 2: Use `safe-stable-stringify` or `JSON.stringify` Replacer

**Approach:** Replace the custom recursive serializer with `JSON.stringify` + a replacer that tracks seen objects and replaces circulars with `"[Circular]"`.

**Pros:**
- Battle-tested, less custom code

**Cons:**
- Adds dependency (for `safe-stable-stringify`) or requires writing replacer

**Effort:** 30 minutes – 1 hour

**Risk:** Low

---

### Option 3: Add Max Depth Limit

**Approach:** Cap recursion at depth 5-10 and return `"[MaxDepthExceeded]"` for deeper objects.

**Pros:**
- Also prevents deep (non-circular) objects from being fully serialized

**Cons:**
- Doesn't fully fix circular refs — could still blow up at shallow depths

**Effort:** 30 minutes

**Risk:** Low (but incomplete)

## Recommended Action

Completed on 2026-02-26: implemented and verified in this session.

## Technical Details

**Affected files:**
- `src/server/bootstrap.ts:40-55` — error metadata serializer

## Resources

- **PR:** #40
- **Comment:** CodeRabbit `src/server/bootstrap.ts#46`

## Acceptance Criteria

- [x] Circular references in error metadata do not cause stack overflow
- [x] Circular references are represented as `"[Circular]"` in serialized output
- [x] Winston logger remains operational after serializing circular error objects
- [x] Test: pass error with circular ref to serializer, verify no crash and `[Circular]` in output

## Work Log

### 2026-02-25 - Todo Created

**By:** Claude Code

**Actions:**
- Filed from CodeRabbit PR #40 review comment `src/server/bootstrap.ts#46`

### 2026-02-26 - Todo Completed

**By:** Codex

**Actions:**
- Implemented the fix in code
- Added/updated regression tests
- Verified with type-check, build, and test runs

**Outcome:**
- Todo resolved and validated
