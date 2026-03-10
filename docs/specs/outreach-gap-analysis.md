# Outreach Features — Gap Analysis

**Date:** 2026-03-10
**Spec:** `docs/specs/outreach-features.md`
**Codebase:** v4.0.0-alpha (commit 7692c86)
**Analyst:** Obi (PAI)

---

## Executive Summary

The gdrive MCP codebase is **60-70% ready for P0** and **20-30% ready for P1**. P0 features are thin wrappers around existing email building and send infrastructure. P1 features require new CF Worker HTTP routes and KV data structures that don't exist yet.

**Key findings:**
1. All P0 features can reuse `buildEmailMessage()` and `sendMessage()` — no new Google API calls needed
2. The rate limiter handles per-request API throttling — sufficient for 50-100 sends/day on Google Workspace (2,000/day limit)
3. KV binding (`GDRIVE_KV`) exists but has no tracking schema — list-by-prefix is the only query pattern
4. The spec's inline template design (`{{variable}}`) is correct for MVP — don't over-engineer with stored templates
5. Two open monitoring alerts (GDRIVE-10, GDRIVE-13) should be triaged before new feature work

---

## Existing Linear Issues (GDRIVE Team)

| ID | Title | Status | Priority | Notes |
|----|-------|--------|----------|-------|
| GDRIVE-13 | Critical Monitoring Alert (Mar 5) | Todo | High | Health + perf checks failing |
| GDRIVE-10 | Critical Monitoring Alert (Feb 9) | Todo | High | Health + perf + metrics failing |
| GDRIVE-8 | Gmail API Integration v3.2.0 | Done | Urgent | Shipped — 12 operations |
| GDRIVE-5 | addQuestion JSON payload bug | Done | Urgent | Fixed |
| GDRIVE-4 | getAppScript ID resolution | Done | Medium | Fixed |

**Related (AOJ team, all Done):** AOJ-318 (reply ops), AOJ-319 (forward ops), AOJ-320 (attachment ops), AOJ-321 (message management)

**Recommendation:** Triage GDRIVE-10 and GDRIVE-13 before starting outreach work. They may indicate Worker deployment issues that would block P1 tracking features.

---

## P0 Feature Gap Analysis

### 1. `gmail.sendFromTemplate` — Template Rendering + Send

**Readiness: 75%**

| What Exists | File | Lines |
|-------------|------|-------|
| Email building (RFC 2822, MIME, sanitization) | `src/modules/gmail/utils.ts` | 92-146 |
| Send operation | `src/modules/gmail/send.ts` | 42-91 |
| HTML support (`isHtml` flag) | `src/modules/gmail/types.ts` | 184 |
| Rate limiting per service | `src/sdk/rate-limiter.ts` | all |
| Base64url encoding | `src/modules/gmail/utils.ts` | 153-159 |

**What's Missing:**

| Item | Action | File |
|------|--------|------|
| `renderTemplate()` function | CREATE | `src/modules/gmail/templates.ts` |
| `SendFromTemplateOptions` type | CREATE | `src/modules/gmail/types.ts` |
| SDK spec entry | UPDATE | `src/sdk/spec.ts` (gmail section ~line 430) |
| Runtime registration | UPDATE | `src/sdk/runtime.ts` (gmail section ~line 170) |
| Module export | UPDATE | `src/modules/gmail/index.ts` |

**Spec Accuracy:** The spec's inline template design (`template` string + `variables` object) is correct and simpler than stored templates. No changes needed.

**Design Decision:** `renderTemplate()` should be a shared utility used by both `sendFromTemplate` and `sendBatch`. Extract to `src/modules/gmail/templates.ts`.

**Effort:** 3-4 hours

---

### 2. `gmail.dryRun` — Preview Without Sending

**Readiness: 80%**

| What Exists | File | Lines |
|-------------|------|-------|
| `buildEmailMessage()` renders full RFC 2822 | `src/modules/gmail/utils.ts` | 92-146 |
| Header sanitization + validation | `src/modules/gmail/utils.ts` | 11-61 |
| `createDraft` already builds without sending | `src/modules/gmail/compose.ts` | 30-67 |

**What's Missing:**

| Item | Action | File |
|------|--------|------|
| `dryRunMessage()` function | CREATE | `src/modules/gmail/compose.ts` |
| `DryRunResult` type | CREATE | `src/modules/gmail/types.ts` |
| Base64url DECODE utility | CREATE | `src/modules/gmail/utils.ts` |
| SDK spec entry | UPDATE | `src/sdk/spec.ts` |
| Runtime registration | UPDATE | `src/sdk/runtime.ts` |

**Gotcha:** `encodeToBase64Url()` exists (line 153) but there's no corresponding decode. Need ~5 lines to add `decodeFromBase64Url()` for parsing the rendered message back to readable text.

**Spec Accuracy:** Spec is correct. The `wouldSend: false` field in the output is a nice touch for AI agents to reason about.

**Effort:** 2-3 hours (simplest P0 feature)

---

### 3. `sheets.readAsRecords` — Sheet as Keyed Objects

**Readiness: 85%**

| What Exists | File | Lines |
|-------------|------|-------|
| `readSheet()` returns 2D array | `src/modules/sheets/read.ts` | 51-89 |
| Range parsing + cache | `src/modules/sheets/read.ts` | 56-71 |
| 12 existing sheet operations | `src/sdk/runtime.ts` | 50-97 |

**What's Missing:**

| Item | Action | File |
|------|--------|------|
| `readAsRecords()` function (~20 lines) | CREATE | `src/modules/sheets/read.ts` |
| `ReadAsRecordsResult` type | CREATE | `src/modules/sheets/read.ts` |
| SDK spec entry | UPDATE | `src/sdk/spec.ts` (sheets section ~line 139) |
| Runtime registration | UPDATE | `src/sdk/runtime.ts` (sheets section ~line 54) |
| Module export | UPDATE | `src/modules/sheets/index.ts` |

**Spec Accuracy:** Correct. This is literally a transform layer over `readSheet()` — zip headers with rows.

**Gotcha:** Sparse rows (fewer cells than headers) should map to `null`, not `undefined`. Empty sheets (header only) should return `records: [], count: 0`.

**Effort:** 2 hours (thinnest wrapper of all P0 features)

---

### 4. `gmail.sendBatch` — Batch Send with Throttling

**Readiness: 65%**

| What Exists | File | Lines |
|-------------|------|-------|
| `sendMessage()` for single sends | `src/modules/gmail/send.ts` | 42-91 |
| Rate limiter wraps all operations | `src/sdk/rate-limiter.ts` | all |
| Error handling patterns | `src/modules/gmail/send.ts` | 78-89 |
| Logging + perf tracking | `src/modules/gmail/send.ts` | 78 |

**What's Missing:**

| Item | Action | File |
|------|--------|------|
| `sendBatch()` function | CREATE | `src/modules/gmail/send.ts` |
| `BatchSendOptions`, `BatchSendResult` types | CREATE | `src/modules/gmail/types.ts` |
| ~~Daily quota tracking~~ | DROPPED | Existing rate limiter sufficient for 50-100/day volume |
| SDK spec entry | UPDATE | `src/sdk/spec.ts` |
| Runtime registration | UPDATE | `src/sdk/runtime.ts` |

**Spec vs Code Mismatch:**

The spec designs `sendBatch` with a shared `template` + per-recipient `variables` array (outreach-oriented). This is better than the explore agent's suggestion of per-item full `SendMessageOptions`. **Keep the spec's design** — it pairs naturally with `renderTemplate()` from feature #1.

However, the spec should also support a `dryRun: true` flag on `sendBatch` that returns all rendered emails without sending (preview the entire batch). This is missing from the spec.

**Quota Note:** Google Workspace allows 2,000 sends/day. At 50-100 sends/day volume, the existing per-request rate limiter is sufficient — no daily quota tracker needed.

**Effort:** 4-5 hours

---

## P1 Feature Gap Analysis

### 5. CF Worker Tracking Pixel Endpoint

**Readiness: 30%**

| What Exists | File |
|-------------|------|
| CF Worker config with KV binding | `wrangler.toml` (lines 1-8) |
| `WorkersKVCache` class | `src/storage/kv-store.ts` (lines 80-128) |
| Worker entry point | `worker.ts` |
| Web Crypto API (for hashing IPs) | `src/storage/kv-store.ts` (lines 13-76) |

**What's Missing:**

| Item | Action | File |
|------|--------|------|
| HTTP route handler for `/track/*` | CREATE | `src/server/worker-routes.ts` |
| Worker fetch routing (MCP vs tracking) | UPDATE | `worker.ts` |
| Tracking KV schema + types | CREATE | `src/storage/tracking-schema.ts` |
| 1x1 transparent GIF binary constant | CREATE | `src/server/worker-routes.ts` |

**KV Limitation (Critical):**
KV does NOT support range queries. To get all events for a campaign, you must `list()` with prefix `tracking:{campaignId}:` — which returns keys, not values. Each value then requires a separate `get()`. For 100 recipients, that's 101 KV reads per query.

**Workaround:** Write a summary record at `tracking:summary:{campaignId}` that aggregates per-recipient open counts. Update on each pixel hit (read-modify-write). Query returns one KV read. Trade-off: slight race condition on concurrent opens (acceptable — tracking is approximate).

**Effort:** 4-5 hours

---

### 6. `gmail.insertTrackingPixel` — Auto-Wrap HTML

**Readiness: 70%** (depends on feature #5)

Mostly a transform on existing `sendMessage()` — wraps body in HTML, appends `<img>` tag. The `buildEmailMessage()` already handles `isHtml: true`.

**Gotcha:** Plain text emails auto-converted to HTML. Must preserve newlines as `<br>` tags, not just `\n`. The spec doesn't mention this.

**Effort:** 3 hours

---

### 7. `gmail.getTrackingData` — Query KV

**Readiness: 25%** (depends on feature #5)

**Blocker:** This is a Worker-only operation. On Node.js runtime (stdio MCP), KV is not available. Need to either:
- Route this operation through the Worker HTTP endpoint (new pattern)
- Or only support it on Worker deployment

The spec doesn't address this runtime split. **This is a design gap.**

**Effort:** 3-4 hours

---

### 8. `gmail.detectReplies` — Reply Detection by ThreadId

**Readiness: 60%**

| What Exists | File | Lines |
|-------------|------|-------|
| `searchMessages()` with Gmail query syntax | `src/modules/gmail/search.ts` | all |
| `getThread()` for thread retrieval | `src/modules/gmail/read.ts` | all |

This is a composition of existing operations — search for messages in given threadIds, filter to messages NOT from the sender. The spec is correct that this automates what gog requires manually.

**Effort:** 3 hours

---

### 9. `sheets.updateRecords` — Update by Key Match

**Readiness: 50%**

| What Exists | File | Lines |
|-------------|------|-------|
| `readSheet()` for data retrieval | `src/modules/sheets/read.ts` | 51-89 |
| `updateCells()` for cell updates | `src/modules/sheets/update.ts` | all |

Needs: read sheet → find row by key column match → compute cell range → call `updateCells()`. The tricky part is translating row index to A1 notation range.

**Effort:** 3-4 hours

---

## Cross-Cutting Concerns

### 1. CF Worker vs Node.js Runtime Split

The gdrive MCP runs in TWO runtimes:
- **Node.js** (stdio) — local MCP server, has `isolated-vm` sandbox for code execution
- **CF Worker** — deployed, has KV/D1/R2 but no `isolated-vm`

| Feature | Node.js | CF Worker |
|---------|---------|-----------|
| P0: sendFromTemplate | Yes | Yes |
| P0: dryRun | Yes | Yes |
| P0: readAsRecords | Yes | Yes |
| P0: sendBatch | Yes | Yes |
| P1: Tracking pixel | No (no HTTP) | Yes |
| P1: insertTrackingPixel | Yes | Yes |
| P1: getTrackingData | **No (no KV)** | Yes |
| P1: detectReplies | Yes | Yes |
| P1: updateRecords | Yes | Yes |

**Implication:** `getTrackingData` is Worker-only. The spec should acknowledge this and the SDK spec should mark it as Worker-only.

### 2. Rate Limiter — Sufficient for Current Volume

Current: `RateLimiter` in `src/sdk/rate-limiter.ts` wraps operations with per-request throttling (prevents 429s).
Google Workspace limit: 2,000 sends/day. Expected volume: 50-100/day.

**Conclusion:** Existing rate limiter is sufficient. No daily quota tracker needed at this volume. If volume scales past 500/day, revisit then.

### 3. Template Rendering — Shared Utility

Both `sendFromTemplate` and `sendBatch` need template rendering. Extract `renderTemplate(template: string, variables: Record<string, string>): string` into `src/modules/gmail/templates.ts`. Handle:
- `{{variable}}` replacement
- Missing variable → throw or warn (configurable)
- HTML escaping when `isHtml: true`
- Subject line template support (not just body)

### 4. Spec Inaccuracies / Missing Items

| Item | Issue | Recommendation |
|------|-------|----------------|
| `sendBatch` missing `dryRun` flag | Can't preview batch before sending | Add `dryRun: boolean` to `BatchSendOptions` |
| ~~No daily quota tracking~~ | DROPPED — 50-100/day vs 2,000 Workspace limit | Not needed |
| `getTrackingData` runtime assumption | Spec doesn't mention Worker-only limitation | Document runtime requirement |
| `insertTrackingPixel` plain→HTML conversion | Spec doesn't handle `\n` → `<br>` | Add to implementation notes |
| No subject template support | `sendFromTemplate` renders body but not subject with variables | Add subject template rendering |
| Tracking pixel URL hardcoded in spec | Uses `gdrive-mcp.workers.dev` — should be configurable | Add `trackingBaseUrl` config |

---

## Recommended Implementation Order

```
Phase 1 (P0 Foundation — Week 1):
  1. sheets.readAsRecords     (2h)  — no dependencies, simplest
  2. renderTemplate() utility (2h)  — shared by 3+4
  3. gmail.dryRun             (3h)  — uses renderTemplate, no send
  4. gmail.sendFromTemplate   (3h)  — uses renderTemplate + sendMessage
  5. gmail.sendBatch          (5h)  — uses renderTemplate + sendMessage + throttle

Phase 2 (P1 Tracking — Week 2):
  6. CF Worker route setup    (4h)  — tracking pixel endpoint
  7. gmail.insertTrackingPixel(3h)  — depends on #6 for pixel URL
  8. gmail.getTrackingData    (3h)  — depends on #6 for KV schema
  9. gmail.detectReplies      (3h)  — independent, uses existing search
  10. sheets.updateRecords    (3h)  — independent, closes the loop

Pre-req:
  - Triage GDRIVE-10/13      (2h)  — Worker health before P1
```

**Total estimated effort:** ~31 hours across both phases

---

## Files Changed Summary

### New Files (7)
- `src/modules/gmail/templates.ts` — renderTemplate, sendFromTemplate
- `src/storage/tracking-schema.ts` — KV tracking types
- `src/server/worker-routes.ts` — tracking pixel HTTP handler
- `docs/specs/outreach-features.md` — original spec (copied)
- `docs/specs/outreach-gap-analysis.md` — this document

### Modified Files (8)
- `src/modules/gmail/types.ts` — new types for template, batch, dryRun, tracking
- `src/modules/gmail/send.ts` — sendBatch function
- `src/modules/gmail/compose.ts` — dryRunMessage function
- `src/modules/gmail/utils.ts` — decodeFromBase64Url, escapeHtml
- `src/modules/gmail/index.ts` — new exports
- `src/modules/sheets/read.ts` — readAsRecords function
- `src/sdk/spec.ts` — 6 new operation specs
- `src/sdk/runtime.ts` — 6 new operation registrations
- `worker.ts` — route tracking requests
- `wrangler.toml` — route config (if needed)
