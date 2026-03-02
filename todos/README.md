# Todo Registry

All items in this directory are completed and verified.

Last updated: 2026-02-26

## Summary
- Total completed: 15
- P1 completed: 10
- P2 completed: 5

## Completed Items

| ID | Priority | File | Title |
|---|---|---|---|
| 001 | P1 | [001-done-p1-missing-bearer-auth.md](./001-done-p1-missing-bearer-auth.md) | Missing Bearer Token Authentication on Deployed Worker |
| 002 | P1 | [002-done-p1-rate-limiter-counter-bypass.md](./002-done-p1-rate-limiter-counter-bypass.md) | Rate Limiter Counter Bypass Bug Allows Over-Quota Concurrent Calls |
| 003 | P1 | [003-done-p1-sandbox-async-timeout.md](./003-done-p1-sandbox-async-timeout.md) | Sandbox runInContext Timeout Does Not Cover Async Execution |
| 004 | P1 | [004-done-p1-worker-tsconfig-node-modules.md](./004-done-p1-worker-tsconfig-node-modules.md) | Worker tsconfig Includes Node.js-Only Modules in CF Workers Bundle |
| 005 | P1 | [005-done-p1-transport-type-safety.md](./005-done-p1-transport-type-safety.md) | Worker Transport Uses `{} as any` Bypassing Type Safety |
| 006 | P1 | [006-done-p1-kv-plaintext-token-storage.md](./006-done-p1-kv-plaintext-token-storage.md) | Workers Auth Stores OAuth Tokens in KV as Plaintext JSON |
| 007 | P1 | [007-done-p1-workers-encrypted-token-mismatch.md](./007-done-p1-workers-encrypted-token-mismatch.md) | Workers Auth Path Cannot Handle Encrypted Token Format from TokenManager |
| 008 | P1 | [008-done-p1-key-rotation-wrong-version.md](./008-done-p1-key-rotation-wrong-version.md) | Key Rotation Saves Tokens Under Old Key Version Instead of New |
| 009 | P1 | [009-done-p1-rate-limiter-per-call-scope.md](./009-done-p1-rate-limiter-per-call-scope.md) | Rate Limiter Recreated Per execute() Call — No Cross-Call Quota Protection |
| 010 | P1 | [010-done-p1-error-serializer-circular-ref.md](./010-done-p1-error-serializer-circular-ref.md) | Error Serializer Crashes on Circular References in Metadata |
| 011 | P2 | [011-done-p2-redis-keys-blocking-scan.md](./011-done-p2-redis-keys-blocking-scan.md) | Redis KEYS Command Blocks Server During Cache Invalidation |
| 012 | P2 | [012-done-p2-fragile-oauth-path.md](./012-done-p2-fragile-oauth-path.md) | OAuth Key File Fallback Path Tightly Coupled to Build Directory Structure |
| 013 | P2 | [013-done-p2-kv-key-length-validation.md](./013-done-p2-kv-key-length-validation.md) | KV Store Accepts Any Key Length Before crypto.subtle.importKey |
| 014 | P2 | [014-done-p2-kv-cache-invalidation.md](./014-done-p2-kv-cache-invalidation.md) | KV Cache Invalidation Uses Expiry Hack Instead of Proper Delete |
| 015 | P2 | [015-done-p2-rate-limiter-wake-counter.md](./015-done-p2-rate-limiter-wake-counter.md) | Rate Limiter Wake Counter Not Incremented When Dequeuing Waiters |
