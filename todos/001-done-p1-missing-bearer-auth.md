---
status: done
priority: p1
issue_id: "001"
tags: [security, worker, authentication]
dependencies: []
---

# Missing Bearer Token Authentication on Deployed Worker

## Problem Statement

The deployed Cloudflare Worker at `worker.ts#62` is completely open to unauthenticated requests. Any POST to the `/mcp` endpoint grants full Google Workspace access (read email, send email, delete files, etc.). The migration plan specified `MCP_BEARER_TOKEN` secret validation and origin allowlist, but neither is implemented.

## Findings

- `worker.ts:62` — Method/path check present, but zero auth validation before routing to MCP handler
- Migration plan explicitly listed bearer token validation (`MCP_BEARER_TOKEN` secret) as a security requirement
- Origin allowlist also specified but not implemented
- Live endpoint `gdrive-mcp.chinyereirondi.workers.dev` is publicly exposed
- Source: CodeRabbit review, 🔴 Critical

## Proposed Solutions

### Option 1: Bearer Token Middleware

**Approach:** Read `MCP_BEARER_TOKEN` from Workers env/secret binding, validate `Authorization: Bearer <token>` header before any MCP handling.

**Pros:**
- Standard pattern, easy to implement
- Cloudflare secrets keep token out of source

**Cons:**
- Single token — no per-user auth

**Effort:** 1-2 hours

**Risk:** Low

---

### Option 2: Bearer Token + Origin Allowlist

**Approach:** Combine bearer validation with `CF-Worker-Allowed-Origins` or manual `Origin` header check.

**Pros:**
- Defence in depth
- Matches migration plan spec exactly

**Cons:**
- Slightly more complex

**Effort:** 2-3 hours

**Risk:** Low

## Recommended Action

Completed on 2026-02-26: implemented and verified in this session.

## Technical Details

**Affected files:**
- `worker.ts:62` — request routing, auth check must be added here before MCP handler

**Related components:**
- Cloudflare Worker secrets (`MCP_BEARER_TOKEN`)
- `src/server/bootstrap.ts` — MCP server setup

## Resources

- **PR:** #40
- **Comment:** CodeRabbit `worker.ts#62`

## Acceptance Criteria

- [x] `Authorization: Bearer <token>` validated against `MCP_BEARER_TOKEN` secret
- [x] Returns 401 on missing/invalid token before touching MCP handler
- [x] Origin allowlist implemented or explicitly deferred with documented rationale
- [x] Unit test covers unauthenticated request rejection
- [x] No credentials exposed in environment

## Work Log

### 2026-02-25 - Todo Created

**By:** Claude Code

**Actions:**
- Filed from CodeRabbit PR #40 review comment `worker.ts#62`
- Severity: 🔴 Critical

**Learnings:**
- This is the highest-priority security gap in the v4 Workers migration

### 2026-02-26 - Todo Completed

**By:** Codex

**Actions:**
- Implemented the fix in code
- Added/updated regression tests
- Verified with type-check, build, and test runs

**Outcome:**
- Todo resolved and validated
