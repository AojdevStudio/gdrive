# Codebase Concerns

**Analysis Date:** 2026-01-25

## Tech Debt

**Complex Sheet Handler Module:**
- Issue: `src/sheets/sheets-handler.ts` is 948 lines with extensive range resolution logic and 200+ lines of debug logging statements scattered throughout
- Files: `src/sheets/sheets-handler.ts` (lines 214, 223, 232, 236)
- Impact: High cyclomatic complexity makes debugging and maintenance difficult; excessive debug logging at info level will bloat production logs
- Fix approach: Extract sheet metadata resolution into a separate utility module; move debug logging behind proper debug-level guards instead of info-level logs

**Large Helper Utility Files:**
- Issue: `src/sheets/helpers.ts` (717 lines) and `src/sheets/advanced-tools.ts` (768 lines) have grown into monolithic utility collections
- Files: `src/sheets/helpers.ts`, `src/sheets/advanced-tools.ts`
- Impact: Difficult to locate specific functionality; unclear module boundaries; increases chance of naming collisions
- Fix approach: Group related functions into domain-specific modules (e.g., range parsing, formatting rules, grid calculations)

**Empty Return Values Without Documentation:**
- Issue: Functions return empty objects `{}` or arrays `[]` with no context about when/why this happens
- Files: `src/sheets/conditional-formatting.ts` (line 108), `src/sheets/helpers.ts` (lines 626, 635), `src/sheets/advanced-tools.ts` (line 672)
- Impact: Callers cannot distinguish between "no data" and "operation failed"; unclear behavior in edge cases
- Fix approach: Use explicit null returns or typed Optional<T> wrapper; document expected behavior in JSDoc

**Dual Sheets Implementation (Legacy + New):**
- Issue: Both old handler-based sheets (`src/sheets/`) and new modular sheets (`src/modules/sheets/`) exist with potential for divergent behavior
- Files: `src/sheets/sheets-handler.ts` vs `src/modules/sheets/manage.ts`, `src/modules/sheets/read.ts`, etc.
- Impact: Code duplication; maintenance burden keeping both in sync; confusion about which should be used
- Fix approach: Deprecate old sheets handler in favor of modular implementation; migrate all callers to new modules

**Calendar Attendee Resolution Not Validated at Input:**
- Issue: `src/modules/calendar/create.ts` resolves contact names to emails via `resolveContacts()` but contact file is optional and resolution can silently fail
- Files: `src/modules/calendar/create.ts` (line 14, 130+)
- Impact: Events may be created with unresolved names instead of actual email addresses; attendees not invited as expected
- Fix approach: Add validation after contact resolution to verify all non-email attendees were successfully resolved; log warnings when resolution fails

## Known Bugs

**Cached Free/Busy Data Has Wrong TTL:**
- Symptoms: Free/busy checks may return stale data; no 60-second TTL enforced despite spec requirement
- Files: `src/modules/calendar/freebusy.ts` (line 98)
- Trigger: Check free/busy multiple times within 60 seconds; data is cached for full 5-minute default TTL
- Workaround: None; cache invalidation requires server restart or manual cache clear
- Note: Comment indicates CacheManager doesn't support per-operation TTL configuration

**Debug Logging at Info Level Contaminates Logs:**
- Symptoms: Production logs show verbose resolver metadata and range normalization details at INFO level
- Files: `src/sheets/sheets-handler.ts` (lines 214, 223, 232, 236)
- Trigger: Any sheet operation triggers 4+ debug messages logged as INFO
- Workaround: Change logger level to ERROR or WARN at runtime
- Impact: Difficult to find meaningful operational logs; log files bloat rapidly

**Token Refresh Promise Not Awaited on Startup:**
- Symptoms: Directory creation failures for token storage silently ignored; audit log directory creation failures silently ignored
- Files: `src/auth/TokenManager.ts` (lines 81-86)
- Trigger: Token storage path doesn't exist and has permission issues; error is only logged, not propagated
- Workaround: Pre-create token directories with correct permissions before starting server
- Impact: Tokens may fail to persist; audit logs not written; discovered late during actual token operations

**Generic Error Catching Without Re-examination:**
- Symptoms: Broad `catch (error: unknown)` handlers in hot paths without differentiation between recoverable and unrecoverable errors
- Files: `src/drive/drive-handler.ts` (line 448), `src/modules/drive/batch.ts` (line 250)
- Trigger: Any error in Drive API operations gets generic handler
- Workaround: None; all errors treated identically
- Impact: Cannot distinguish API failures (retry) from permission errors (fail fast) from malformed input (invalid)

## Security Considerations

**Environment Variable Sanitization for File Paths (Partial):**
- Risk: TokenManager sanitizes environment paths for newline/equals injections but only handles first line of multi-line env var
- Files: `src/auth/TokenManager.ts` (lines 104-124)
- Current mitigation: Split on newline and take first non-empty trimmed line
- Recommendations:
  - Validate that paths are absolute or relative with no parent directory traversal (`../`)
  - Explicitly validate path doesn't contain shell metacharacters
  - Add filesystem-level ACL checks before using paths

**Email Header Injection Protection (Adequate):**
- Risk: Email composition could allow header injection via CR/LF in headers or email addresses
- Files: `src/modules/gmail/send.ts` (lines 33-36, 60-68, 80-115)
- Current mitigation: All header values sanitized to remove `\r\n`; email addresses validated with RFC 5322 pattern; subject RFC 2047 encoded
- Status: Properly implemented; no immediate risk

**Encryption Key Rotation Requires Env Vars:**
- Risk: Key rotation requires adding `GDRIVE_TOKEN_ENCRYPTION_KEY_V2/V3/V4` env vars; no automated key generation
- Files: `src/auth/TokenManager.ts` (line 133+), `src/auth/KeyRotationManager.ts`
- Current mitigation: Manual validation that keys are 32-byte base64; iterations >= 100k for PBKDF2
- Recommendations:
  - Document the full key rotation procedure with examples
  - Add automated key version discovery from environment
  - Consider supporting encrypted key storage in credentials file (currently only in env)

**OAuth Credentials File Path Not Validated:**
- Risk: `gcp-oauth.keys.json` path comes from env or defaults to `./gcp-oauth.keys.json` in current directory
- Files: `src/health-check.ts` (line 87)
- Current mitigation: File existence checked; basic JSON parsing
- Recommendations:
  - Fail fast during server startup if OAuth keys missing (current behavior logs but continues)
  - Validate OAuth file contains required fields (`client_id`, `client_secret`, `redirect_uris`)
  - Support reading from standard GCP credential locations

**Token Storage on Filesystem Unencrypted on Disk:**
- Risk: Encrypted tokens stored at `~/.gdrive-mcp-tokens.json` but filesystem encryption varies by OS
- Files: `src/auth/TokenManager.ts` (lines 305+)
- Current mitigation: AES-256-GCM encryption before write; PBKDF2 key derivation with 100k iterations
- Recommendations:
  - Document that filesystem encryption is essential (use encrypted filesystem, FileVault, BitLocker, etc.)
  - Consider storing only refresh tokens (access tokens are short-lived)
  - Support external token store (e.g., system keyring via `keytar` library)

## Performance Bottlenecks

**Synchronous Metadata Fetches in Range Resolution:**
- Problem: For each sheet operation with name-based range reference, must call `spreadsheets.get()` to resolve name to ID
- Files: `src/sheets/sheets-handler.ts` (lines 108-117, 141-162)
- Cause: No sheet metadata cache; each resolve operation triggers API call
- Improvement path:
  - Cache sheet metadata at spreadsheet level with 5-minute TTL
  - Implement cache invalidation on sheet create/delete/rename
  - Add cache to CacheManager as `sheets:${spreadsheetId}:metadata`

**Calendar Event Creation Has N+1 Contact Lookups:**
- Problem: When resolving attendee names, contacts file is read for each attendee instead of once per operation
- Files: `src/modules/calendar/create.ts` (lines 140-145)
- Cause: `resolveContacts()` call doesn't cache/batch lookups
- Improvement path:
  - Load contacts once at operation start
  - Build lookup map and reuse for all attendees
  - Profile to verify this is actual bottleneck (may be I/O-bound on contacts file)

**Free/Busy Queries Not Batched:**
- Problem: Multiple free/busy checks cannot be combined into single API call
- Files: `src/modules/calendar/freebusy.ts` (lines 60+)
- Cause: Function signature doesn't support batch input; one query per invocation
- Improvement path:
  - Add batch operation similar to Calendar API's native batching
  - Requires API signature change; deprecate single-check function

**Sheet Metadata Queries in Batch Operations Not Parallelized:**
- Problem: Batch file operations may make sequential API calls for sheet resolution
- Files: `src/modules/drive/batch.ts` (lines 250+)
- Cause: Unknown if batch operation implementation parallelizes or serializes
- Improvement path:
  - Audit batch operation to confirm parallelization
  - Add concurrent.map with configurable concurrency limits
  - Monitor API quota usage to prevent burst exhaustion

**Redis Connection Startup Delay:**
- Problem: Server waits for Redis connection attempt (default 10 retries * 50-500ms backoff) before responding to first request
- Files: `index.ts` (lines 288-318)
- Cause: `await this.client.connect()` blocks startup; continues anyway on failure
- Improvement path:
  - Make Redis connection async in background
  - Start server immediately with graceful fallback to memory cache
  - Emit warning if Redis not available after N seconds

## Fragile Areas

**Sheet Range Parsing and Validation:**
- Files: `src/sheets/helpers.ts` (parseA1Notation, parseRangeInput), `src/sheets/sheets-handler.ts` (resolveRangeWithSheet)
- Why fragile: Complex state machine for parsing A1 notation; multiple edge cases (special characters in sheet names, quoted names, invalid ranges)
- Safe modification:
  - Add comprehensive test cases for edge cases (sheet names with "!", numbers, unicode)
  - Use state machine parser or grammar (not regex) for robustness
  - Test coverage: Missing tests for sheet names with special characters
- Test coverage: Covered in `src/__tests__/sheets-handler-range-resolution.test.ts` but gap remains for unicode/special chars

**Authentication Token Refresh Loop:**
- Files: `src/auth/AuthManager.ts` (lines 200-290)
- Why fragile: Token refresh is async with retry logic; race conditions possible between refresh and token usage
- Safe modification:
  - Ensure all token access goes through auth manager (no direct token reads)
  - Use mutex/lock during refresh to prevent concurrent refreshes
  - Add timeout to refresh operation
- Test coverage: Tested but concurrent access patterns not covered

**Google Forms Question Type Validation:**
- Files: `src/modules/forms/questions.ts` (lines 152-172), `src/forms/forms-handler.ts` (lines 167-187)
- Why fragile: Question type validation duplicated in two places; no shared validation schema
- Safe modification:
  - Create single source of truth for question type validation
  - Export validation schema from shared module
  - Implement discriminated union type for question options
- Test coverage: 21 tests in `src/__tests__/forms/addQuestion.test.ts` provide good coverage

**Calendar Attendee Email Validation Incomplete:**
- Files: `src/modules/calendar/create.ts` (lines 130-145)
- Why fragile: Contact resolution can silently fail; invalid emails may be sent to Google Calendar API
- Safe modification:
  - Validate all attendee emails after resolution
  - Throw error if any attendee is unresolved name (not email-like)
  - Add validation before API call
- Test coverage: No tests for failed contact resolution scenarios

**Shared Sheets Schema Handling:**
- Files: `src/sheets/sheets-schemas.ts`, `src/modules/sheets/manage.ts`
- Why fragile: Two separate schema definitions with potential drift; unclear which is canonical
- Safe modification:
  - Unify to single schema module
  - Deprecate old `src/sheets/` implementation
  - Add migration path for callers
- Test coverage: Separate tests for each implementation; integration tests missing

## Scaling Limits

**Concurrent API Quota Management:**
- Current capacity: Depends on Google Workspace plan; typically 1000-2000 requests/minute per user
- Limit: No quota tracking or backoff; parallel operations can exhaust quota
- Scaling path:
  - Implement quota tracking per API (Drive, Sheets, Gmail, Calendar)
  - Add exponential backoff on 429 responses
  - Queue operations when approaching quota limits
  - Expose quota status via health check endpoint

**Redis Single Instance:**
- Current capacity: Single Redis instance can handle ~10k ops/sec depending on hardware
- Limit: Server becomes bottleneck if cache hit rate < 50% or operations > 5k/sec
- Scaling path:
  - Monitor cache hit rate and operation latency
  - Add Redis cluster support for horizontal scaling
  - Implement cache eviction policy (LRU)
  - Consider in-memory cache for frequently accessed metadata

**Sheet Metadata Cache Growth:**
- Current capacity: Unbounded cache of sheet metadata for all spreadsheets accessed
- Limit: Memory grows linearly with number of accessed spreadsheets
- Scaling path:
  - Implement cache size limits (max entries, max memory)
  - Add LRU eviction when limits exceeded
  - Use spreadsheet ID as cache key namespace to prevent collisions

**Batch File Operations Size Limit:**
- Current capacity: Unknown batch size limit; API may have constraints
- Limit: Single batch request may fail if > 100 operations or payload > 10MB
- Scaling path:
  - Add client-side batch chunking (e.g., 50 ops per API call)
  - Implement batch monitoring with request size calculation
  - Document batch operation limits clearly

## Dependencies at Risk

**isolated-vm (v6.0.2):**
- Risk: No longer actively maintained; last update 2023; Node.js 22+ compatibility unverified
- Impact: Security vulnerabilities may not be patched; could break on future Node.js versions
- Migration plan:
  - Verify current usage (grep for imports)
  - Consider worker_threads as replacement if isolated execution no longer needed
  - If needed, fork and maintain or find alternative sandbox library

**Node.js 22.0.0+ Requirement:**
- Risk: Skips stable Node.js versions (18, 20); deployment complexity
- Impact: May not run on production systems still on Node 18/20; requires version coordination
- Migration plan:
  - Test and support Node 20 (still in LTS until April 2026)
  - Document breaking changes that require Node 22
  - Use feature detection for Node 22-specific features instead of hard requirement

**Google Workspace API Rate Limits:**
- Risk: Client code doesn't handle 429/quotaExceeded responses; no backoff strategy
- Impact: High-volume operations fail without retry; poor user experience
- Migration plan:
  - Add rate limit aware client wrapper
  - Implement exponential backoff (start 1s, cap 60s)
  - Expose quota information in responses

## Missing Critical Features

**Batch Cache Invalidation:**
- Problem: Batch file operations don't invalidate related caches (search results, file metadata, sheet metadata)
- Blocks: Batch operations may return stale cached results on subsequent reads
- Resolution: Add cache invalidation triggers for batch create/update/delete/move operations

**Token Refresh Failure Recovery:**
- Problem: If token refresh fails with invalid_grant, tokens are deleted but not recoverable without re-authentication
- Blocks: Server becomes unusable after token refresh fails; no recovery mechanism
- Resolution: Implement token recovery flow (queue for re-auth) or support fallback authentication

**Contact Resolution Error Handling:**
- Problem: Calendar event creation silently continues if contact file missing or unreadable
- Blocks: Events created with unresolved names instead of emails; attendees not invited
- Resolution: Add strict validation mode; fail events if any attendee unresolved

**Sheet Metadata Preloading:**
- Problem: First sheet operation always blocks on metadata fetch; no prefetching option
- Blocks: Latency-sensitive operations forced to wait on metadata resolution
- Resolution: Add optional metadata preload during spreadsheet initialization

## Test Coverage Gaps

**Sheet Range Resolution with Unicode/Special Characters:**
- What's not tested: Sheet names containing emoji, unicode, quotes, brackets, special regex chars
- Files: `src/sheets/helpers.ts` (parseRangeInput, parseA1Notation), `src/sheets/sheets-handler.ts`
- Risk: Parser may fail on valid sheet names; undetected until user reports
- Priority: High

**Calendar Attendee Resolution Failure Scenarios:**
- What's not tested: Contact file missing, contact file unreadable, contact format invalid, name not found
- Files: `src/modules/calendar/create.ts` (resolveContacts call)
- Risk: Silent failures lead to incorrect event creation; hard to debug
- Priority: High

**Batch Operation Partial Failures:**
- What's not tested: Batch with 50% success rate; transient vs permanent failures; error message accuracy
- Files: `src/modules/drive/batch.ts`
- Risk: Unclear how to handle partial success; users may not know which operations failed
- Priority: Medium

**Token Refresh Under Network Errors:**
- What's not tested: Refresh fails with ECONNREFUSED, ETIMEDOUT, malformed response; retry logic edge cases
- Files: `src/auth/AuthManager.ts` (checkAndRefreshToken)
- Risk: Transient network issues cause permanent auth failure
- Priority: Medium

**Redis Connection Failure Graceful Degradation:**
- What's not tested: Redis goes down mid-operation; connection drops; reconnection behavior
- Files: `index.ts` (CacheManager), all cache get/set operations
- Risk: Unknown fallback behavior; may crash or return wrong cached data
- Priority: Medium

**Large Sheet Operations (10k+ rows):**
- What's not tested: Reading/writing sheets with 10k+ rows; memory usage; timeout behavior
- Files: `src/modules/sheets/read.ts`, `src/modules/sheets/update.ts`
- Risk: Out of memory errors or timeouts on large operations
- Priority: Low

**Concurrent Batch Operations:**
- What's not tested: Multiple batch operations on same spreadsheet/drive simultaneously
- Files: `src/modules/drive/batch.ts`
- Risk: Race conditions in metadata updates; inconsistent state
- Priority: Low

---

*Concerns audit: 2026-01-25*
