---
type: feature-spec
status: draft-v2
created: 2026-03-10
revised: 2026-03-10
target_repo: ~/Projects/local-mcps/gdrive
notes: "v2 — revised after gap analysis against codebase (v4.0.0-alpha). Incorporates 6 findings from outreach-gap-analysis.md. DailyQuotaTracker removed — existing rate limiter is sufficient for 50-100 sends/day on Google Workspace (2,000/day limit)."
---

# gdrive MCP — Email Outreach Features (v2)

## Why Build This

**gog CLI** is a mature tool for Google Workspace (send, sheets, drive, 13 APIs, `--track`, `--dry-run`).

**What gog cannot do:**
1. **Serve infrastructure.** CLI can't host tracking pixels, click redirects, or webhooks.
2. **Speak MCP.** AI agents call MCP tools natively — no shelling out, no stdout parsing.
3. **Compose across services atomically.** Read Sheet + render template + send email + write result back — one `execute` call.

**gdrive MCP's unfair advantages:**
- **CF Worker runtime** — it IS a server. Tracking endpoints, webhooks, KV/D1 storage.
- **MCP protocol** — first-class tool for Claude Code, Cursor, Cline.
- **Cross-service orchestration** — Gmail + Sheets + Drive in one SDK.

**The goal:** Build what gog structurally cannot — an AI-native email outreach platform with built-in tracking infrastructure.

---

## Capability Comparison

| Capability | gog CLI | gdrive MCP (current) | gdrive MCP (proposed) |
|---|---|---|---|
| Send plain/HTML email | Yes | `gmail.sendMessage` | Same |
| Attachments | Yes | `gmail.sendWithAttachments` | Same |
| Reply threading | Yes | `gmail.replyToMessage` | Same |
| Read Sheet as data | Yes | `sheets.readSheet` (2D array) | + `sheets.readAsRecords` (keyed objects) |
| Write to Sheet | Yes | `sheets.updateCells/appendRows` | + `sheets.updateRecords` (by key match) |
| Open tracking | `--track` | No | **CF Worker pixel endpoint** |
| Click tracking | No | No | **CF Worker redirect endpoint** (P2) |
| Dry run / preview | `--dry-run` | No | **`gmail.dryRun`** |
| Template rendering | No | No | **`gmail.sendFromTemplate`** (body + subject) |
| Batch with throttle | Shell loop | No | **`gmail.sendBatch`** (with dryRun flag) |
| Reply detection | No | `gmail.searchMessages` | **`gmail.detectReplies`** (by campaign) |
| Tracking data store | Impossible (CLI) | Possible (CF Worker) | **`/track/:id` + KV store** |

**Bold = genuine advantages only the MCP can offer.**

---

## P0 — Campaign Essentials

The minimum to run outreach entirely through the gdrive MCP from Claude Code.

### 1. `gmail.sendFromTemplate`

Accepts an inline template string with `{{variable}}` placeholders + a variables object. Renders **both subject and body**, then sends.

```typescript
// Input
{
  service: "gmail",
  operation: "sendFromTemplate",
  args: {
    to: ["amy@todaysdental.com"],
    subject: "{{firstName}}, quick follow-up on claims",
    template: "Hey {{firstName}},\n\n{{personalNote}}\n\nYou know that thing we've all dealt with...",
    variables: { firstName: "Amy", personalNote: "We rebuilt your claims sheet together last year" },
    isHtml: false
  }
}

// Output
{ messageId: "abc123", threadId: "xyz789", rendered: true }
```

**Implementation notes:**
- `renderTemplate()` is a shared utility in `src/modules/gmail/templates.ts` — used by both this and `sendBatch`
- Handles `{{variable}}` replacement in both subject and body
- Missing variables throw an error (fail loud, not silent blanks)
- When `isHtml: true`, variable values are HTML-escaped before insertion

### 2. `gmail.dryRun`

Same signature as `sendFromTemplate` but returns the rendered email without sending. Ossie reviews, approves, then the real send fires.

```typescript
// Input
{
  service: "gmail",
  operation: "dryRun",
  args: {
    to: ["amy@todaysdental.com"],
    subject: "{{firstName}}, quick follow-up on claims",
    template: "Hey {{firstName}},\n\n...",
    variables: { firstName: "Amy" }
  }
}

// Output
{
  to: ["amy@todaysdental.com"],
  subject: "Amy, quick follow-up on claims",
  body: "Hey Amy,\n\nWe rebuilt your claims sheet together last year\n\nYou know that thing...",
  isHtml: false,
  wouldSend: false
}
```

### 3. `sheets.readAsRecords`

Reads a Sheet tab and returns rows as keyed objects. First row = keys.

```typescript
// Input
{
  service: "sheets",
  operation: "readAsRecords",
  args: {
    spreadsheetId: "abc123",
    range: "Contacts!A:G"
  }
}

// Output
{
  records: [
    { name: "Amy", email: "amy@todaysdental.com", version: "A", personalNote: "...", status: "pending", sentDate: "", replied: "" },
    { name: "Dr. Guiste", email: "elihu@todaysdental.com", version: "B", personalNote: "...", status: "pending", sentDate: "", replied: "" }
  ],
  count: 2,
  columns: ["name", "email", "version", "personalNote", "status", "sentDate", "replied"]
}
```

**Implementation notes:**
- Thin wrapper over existing `readSheet()` — zip headers with rows
- Sparse rows (fewer cells than headers) → `null` for missing values
- Empty sheets (header only) → `records: [], count: 0`

### 4. `gmail.sendBatch`

Takes a template + array of recipients with per-recipient variables. Sends with configurable delay. Supports `dryRun` flag to preview the entire batch without sending.

```typescript
// Input
{
  service: "gmail",
  operation: "sendBatch",
  args: {
    template: "Hey {{firstName}},\n\n{{personalNote}}\n\nYou know that thing...",
    subject: "{{firstName}}, quick follow-up on claims",
    recipients: [
      { to: "amy@todaysdental.com", variables: { firstName: "Amy", personalNote: "..." } },
      { to: "haley@todaysdental.com", variables: { firstName: "Haley", personalNote: "..." } }
    ],
    delayMs: 5000,
    isHtml: false,
    dryRun: false
  }
}

// Output (when dryRun: false)
{
  sent: 2,
  failed: 0,
  results: [
    { to: "amy@todaysdental.com", messageId: "abc", threadId: "xyz", status: "sent" },
    { to: "haley@todaysdental.com", messageId: "def", threadId: "uvw", status: "sent" }
  ]
}

// Output (when dryRun: true)
{
  sent: 0,
  failed: 0,
  previews: [
    { to: "amy@todaysdental.com", subject: "Amy, quick follow-up...", body: "Hey Amy,\n\n...", wouldSend: false },
    { to: "haley@todaysdental.com", subject: "Haley, quick follow-up...", body: "Hey Haley,\n\n...", wouldSend: false }
  ]
}
```

**Implementation notes:**
- Uses shared `renderTemplate()` from `src/modules/gmail/templates.ts`
- Sequential sends with `delayMs` between each (default 5s)
- Continues on individual send failure — reports per-recipient status
- Existing rate limiter handles API throttling — no additional quota tracking needed

---

## P1 — Tracking Infrastructure

Where the CF Worker advantage becomes real. gog structurally cannot do any of this.

### 5. Tracking Pixel Endpoint

New CF Worker route: `GET /track/:campaignId/:recipientId/pixel.gif`

Returns a 1x1 transparent GIF. On each hit, writes to KV:
- `campaignId`, `recipientId`, timestamp, User-Agent
- Aggregated in a summary record at `tracking:summary:{campaignId}` (single KV read to query)
- TTL: 90 days

**Implementation notes:**
- ~30 lines of CF Worker code in `src/server/worker-routes.ts`
- Worker routing: `worker.ts` splits `/track/*` requests to tracking handler, everything else to MCP
- KV uses summary-record pattern (read-modify-write on each hit) to avoid expensive list+get queries
- Tracking pixel URL must be configurable via `trackingBaseUrl` config, not hardcoded

### 6. `gmail.insertTrackingPixel`

When `track: true` is passed to `sendFromTemplate` or `sendBatch`, wraps body in minimal HTML and appends the tracking pixel `<img>` tag.

**Implementation notes:**
- Plain text bodies auto-converted to HTML — **must** convert `\n` to `<br>` to preserve formatting
- Pixel URL: `{trackingBaseUrl}/track/{campaignId}/{recipientId}/pixel.gif`

### 7. `gmail.getTrackingData`

Queries KV for tracking data by campaignId. Returns per-recipient open events.

```typescript
// Output
{
  campaignId: "clarte-warm-v1",
  recipients: [
    { recipientId: "amy", opens: 3, firstOpen: "2026-03-11T09:14:00Z", lastOpen: "2026-03-12T14:22:00Z" },
    { recipientId: "haley", opens: 0 }
  ]
}
```

**Runtime constraint:** This operation is **Worker-only**. KV is not available on the Node.js stdio runtime. On Node.js, this operation returns an error explaining the requirement.

### 8. `gmail.detectReplies`

Given an array of threadIds (from `sendBatch` results), searches Gmail for replies not from the sender. Returns who replied and when.

**Implementation notes:**
- Composes existing `searchMessages()` + `getThread()` — no new API surface needed
- Filters out messages from the authenticated user (sender)

### 9. `sheets.updateRecords`

Updates cells in a Sheet by matching a key column. E.g., "for row where email = amy@todaysdental.com, set status = 'sent', sentDate = '2026-03-10'".

Closes the loop: send emails → get tracking data → write status back to the Sheet. The Google Sheet becomes a live campaign dashboard.

**Implementation notes:**
- Reads sheet → finds matching row by key column → translates row index to A1 range → calls existing `updateCells()`

---

## P2 — Platform Features (Future)

| # | Feature | Why CF Worker |
|---|---------|--------------|
| 10 | **Click tracking** — `/click/:id?url=X` logs + redirects | Hosting redirect endpoint |
| 11 | **Webhook receiver** — Gmail push for real-time replies | Receiving inbound webhooks |
| 12 | **Sequence schema** — multi-email campaign cadence | Stored in KV/D1 |
| 13 | **Bounce detection** — scan bounced replies, flag in Sheet | Gmail search + Sheet update |
| 14 | **Unsubscribe endpoint** — serves page, updates Sheet | Hosting web page |
| 15 | **Stored templates** — reusable templates in Drive/KV | Beyond inline templates |

---

## Implementation Order

```
Phase 1 — P0 (Week 1, ~15h):
  1. sheets.readAsRecords       (2h)  — simplest, no dependencies
  2. renderTemplate() utility   (2h)  — shared by 3, 4, 5
  3. gmail.dryRun               (3h)  — uses renderTemplate, no send
  4. gmail.sendFromTemplate     (3h)  — renderTemplate + sendMessage
  5. gmail.sendBatch            (5h)  — renderTemplate + sendMessage + throttle + dryRun flag

Phase 2 — P1 (Week 2, ~16h):
  6. CF Worker tracking routes  (4h)  — pixel endpoint + KV schema
  7. gmail.insertTrackingPixel  (3h)  — depends on #6
  8. gmail.getTrackingData      (3h)  — depends on #6, Worker-only
  9. gmail.detectReplies        (3h)  — independent, uses existing search
  10. sheets.updateRecords      (3h)  — independent, closes the loop

Pre-req: Triage GDRIVE-10/GDRIVE-13 monitoring alerts before P1.
```

---

## Linear Issues to Create

### P0 (GDRIVE team)

| # | Title | Priority | Estimate |
|---|-------|----------|----------|
| 1 | `gmail.sendFromTemplate` — template rendering (subject + body) + send | Urgent | 3 pts |
| 2 | `gmail.dryRun` — preview rendered email without sending | High | 1 pt |
| 3 | `sheets.readAsRecords` — read Sheet as array of keyed objects | High | 2 pts |
| 4 | `gmail.sendBatch` — batch send with throttling, dryRun flag, structured results | High | 3 pts |

### P1 (GDRIVE team)

| # | Title | Priority | Estimate |
|---|-------|----------|----------|
| 5 | CF Worker tracking pixel endpoint + KV schema | Medium | 2 pts |
| 6 | `gmail.insertTrackingPixel` — auto-wrap with tracking HTML on send | Medium | 2 pts |
| 7 | `gmail.getTrackingData` — query open events by campaign (Worker-only) | Medium | 1 pt |
| 8 | `gmail.detectReplies` — find replies by threadId array | Medium | 2 pts |
| 9 | `sheets.updateRecords` — update Sheet rows by key column match | Medium | 2 pts |

---

## Open Source Positioning

**What this is:** The first MCP server with built-in email campaign infrastructure. Not a cold email SaaS — a developer tool for AI-native email outreach.

**Who it's for:** Developers using Claude Code, Cursor, or any MCP client who want to run email campaigns without paying for Instantly/Lemlist/Apollo.

**Complementary with gog:** gog for interactive CLI work. gdrive MCP when your AI agent needs to orchestrate a campaign.
