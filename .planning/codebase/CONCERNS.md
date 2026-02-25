# Codebase Concerns

**Analysis Date:** 2026-02-25

## Tech Debt

**Dual implementation paths (modules vs handlers):**
- Issue: Active server dispatch in `index.ts` uses `src/modules/*`, while parallel handler stacks remain in `src/drive/`, `src/sheets/`, `src/forms/`, and `src/docs/`
- Files: `index.ts`, `src/modules/*`, `src/drive/drive-handler.ts`, `src/sheets/sheets-handler.ts`, `src/forms/forms-handler.ts`, `src/docs/docs-handler.ts`
- Impact: Behavior drift risk and higher maintenance overhead when fixes are applied to one path only
- Fix approach: Either retire unused handler stacks or formalize a single source-of-truth abstraction shared by both paths

**Monolithic entrypoint complexity:**
- Issue: `index.ts` contains server bootstrap, tool schema declarations, dispatch logic, caching, logging, and multiple CLI flows in one file
- Files: `index.ts`
- Impact: Higher change risk and slower reviews for unrelated modifications
- Fix approach: Split into `server/`, `cli/`, `auth-bootstrap/`, and `observability/` modules with thin composition root

## Known Bugs

**Version drift in runtime metadata:**
- Symptoms: Server advertises version `3.1.0` while package version is `3.3.0`
- Files: `index.ts`, `package.json`
- Trigger: Startup and client introspection of MCP server metadata
- Workaround: Manually keep both version locations in sync during releases

**Free/busy cache TTL mismatch with intent:**
- Symptoms: `checkFreeBusy` comments call for 60s TTL, but cache manager applies fixed 5-minute TTL globally
- Files: `src/modules/calendar/freebusy.ts`, `index.ts`
- Trigger: Scheduling checks where stale availability persists longer than intended
- Workaround: Disable cache or accept stale window until per-operation TTL support is added

## Security Considerations

**Credential and token file handling relies on operator hygiene:**
- Risk: Local credentials and token files are file-based; accidental permission or path misconfiguration can expose auth artifacts
- Files: `scripts/auth.sh`, `src/auth/TokenManager.ts`, `Dockerfile`, `.gitignore`
- Current mitigation: Encryption at rest for tokens, ignore rules, and explicit required key checks
- Recommendations: Add startup permission checks and CI guardrails for unsafe file modes/paths

**Broad OAuth scopes increase blast radius:**
- Risk: A compromised token has broad workspace access across Drive, Sheets, Docs, Forms, Gmail, and Calendar
- Files: `index.ts` (OAuth scopes list)
- Current mitigation: Encrypted token storage and refresh controls
- Recommendations: Document least-privilege profile variants and optionally support scope-restricted modes

## Performance Bottlenecks

**Redis invalidation uses pattern scan via `KEYS`:**
- Problem: `CacheManager.invalidate` fetches matching keys then deletes; keyspace-wide pattern operations can become expensive
- Files: `index.ts`
- Cause: Simplicity-first invalidation strategy
- Improvement path: Migrate to namespaced sets or SCAN-based invalidation for large deployments

**Frequent metrics logging in long-running processes:**
- Problem: Performance stats are logged every 30 seconds regardless of activity
- Files: `index.ts`
- Cause: Fixed-interval telemetry loop
- Improvement path: Adaptive logging interval or activity-triggered metrics emission

## Fragile Areas

**Auth singleton lifecycle in tests and runtime:**
- Files: `src/auth/AuthManager.ts`, `src/auth/TokenManager.ts`, `src/__tests__/auth/*.test.ts`
- Why fragile: Static singletons plus mutable `process.env` can leak state across tests or command modes
- Safe modification: Add explicit reset hooks for test/runtime transitions before refactors
- Test coverage: Strong auth test coverage exists, but shared state still raises regression risk

**Strict optional typing with heavy mocks:**
- Files: `src/modules/calendar/__tests__/freebusy.test.ts`
- Why fragile: Frequent `@ts-expect-error` usage around mocks signals friction with `exactOptionalPropertyTypes`
- Safe modification: Introduce typed test builders to reduce ad-hoc casting and expectation suppressions
- Test coverage: Covered, but maintainability cost is elevated

## Scaling Limits

**Single-process stdio architecture:**
- Current capacity: One Node process handles all requests and dispatch serially within event loop constraints
- Limit: Throughput and isolation are bounded by one runtime instance
- Scaling path: Run multiple isolated MCP server processes per workspace/client and externalize shared cache safely

## Dependencies at Risk

**`isolated-vm` native dependency:**
- Risk: Native build/runtime compatibility issues across environments
- Impact: Install/build failures can block deployment
- Migration plan: Evaluate optional loading or alternative isolation strategy for constrained platforms

**Google API surface churn:**
- Risk: API changes can break typed assumptions in operation modules
- Impact: Runtime failures in request/response mapping
- Migration plan: Pin + regularly update with contract tests against affected service operations

## Missing Critical Features

**No HTTP service boundary for webhook-driven workflows:**
- Problem: Current architecture is stdio MCP only; inbound webhook/event integrations are not present
- Blocks: Event-driven automation that depends on external callbacks

## Test Coverage Gaps

**Router coverage for `index.ts` is thin relative to complexity:**
- What's not tested: Full MCP request-handler matrix across all tools/operations in the live router
- Files: `index.ts`
- Risk: Dispatch regressions can slip through despite strong module-level tests
- Priority: High

**Docs module test coverage is sparse:**
- What's not tested: End-to-end behavior of Docs text/style/table operations
- Files: `src/modules/docs/*.ts`
- Risk: Formatting/editing regressions may only surface in runtime integration
- Priority: Medium

---

*Concerns audit: 2026-02-25*
