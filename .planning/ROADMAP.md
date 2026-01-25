# Roadmap: GDrive MCP Server Bug Fix

**Created:** 2026-01-25
**Milestone:** v3.4.0 - Bug Fix & Technical Debt Cleanup
**Total Phases:** 6

## Overview

| Phase | Name | Requirements | Estimated Complexity |
|-------|------|--------------|---------------------|
| 1 | API Consistency | API-01, API-02, API-03 | Medium |
| 2 | Security Fixes | SEC-01, SEC-02 | Medium |
| 3 | DRY Extraction | DRY-01, DRY-02, DRY-03 | High |
| 4 | Validation | VAL-01, VAL-02, VAL-03 | Medium |
| 5 | Caching | CACHE-01, CACHE-02 | Low |
| 6 | Cleanup & Docs | CLEAN-01 to CLEAN-06, DOC-01 | Low |

---

## Phase 1: API Consistency

**Goal:** Standardize parameter naming across Gmail and Calendar modules for AI agent clarity.

**Requirements:**
- API-01: Gmail `modifyLabels` uses `id` parameter
- API-02: Calendar `EventResult` returns `eventId`
- API-03: Calendar `deleteEvent` returns proper type

**Plans:** 2 plans

Plans:
- [ ] 01-01-PLAN.md — Gmail modifyLabels id parameter rename (API-01)
- [ ] 01-02-PLAN.md — Calendar EventResult eventId + deleteEvent type fix (API-02, API-03)

**Key Files:**
- `src/modules/gmail/types.ts`
- `src/modules/gmail/labels.ts`
- `src/modules/calendar/types.ts`
- `src/modules/calendar/read.ts`
- `src/modules/calendar/create.ts`
- `src/modules/calendar/update.ts`
- `src/modules/calendar/delete.ts`
- `src/tools/listTools.ts`

**Success Criteria:**
- All Gmail single-resource operations use `id` parameter
- All Calendar results return `eventId` matching input options
- `deleteEvent` returns `DeleteEventResult` with `eventId`
- Tests pass for modified functions
- Manual verification confirms parameter consistency

**Dependencies:** None

---

## Phase 2: Security Fixes

**Goal:** Eliminate injection vulnerabilities and apply consistent security validation.

**Requirements:**
- SEC-01: Drive search escapes single quotes
- SEC-02: Gmail `compose.ts` uses shared validation

**Key Files:**
- `src/modules/drive/search.ts`
- `src/modules/gmail/compose.ts`
- `src/modules/gmail/send.ts`
- `src/modules/gmail/utils.ts` (new)

**Success Criteria:**
- Search queries with single quotes don't break or inject
- `compose.ts` uses same validation as `send.ts`
- Shared `gmail/utils.ts` contains extracted functions
- Tests cover edge cases (special characters, malformed input)
- Manual verification of security scenarios

**Dependencies:** None

---

## Phase 3: DRY Extraction

**Goal:** Extract duplicated code into shared utility modules.

**Requirements:**
- DRY-01: Single `parseAttendees` function
- DRY-02: Single `buildEventResult` function
- DRY-03: Single `encodeToBase64Url` function

**Key Files:**
- `src/modules/calendar/utils.ts` (new)
- `src/modules/calendar/read.ts`
- `src/modules/calendar/create.ts`
- `src/modules/calendar/update.ts`
- `src/modules/gmail/utils.ts` (from Phase 2)
- `src/modules/gmail/compose.ts`
- `src/modules/gmail/send.ts`

**Success Criteria:**
- `parseAttendees` exists only in `calendar/utils.ts`
- `buildEventResult` exists only in `calendar/utils.ts`
- `encodeToBase64Url` exists only in `gmail/utils.ts`
- All consumers import from utils
- No duplicate implementations remain
- Tests pass for all Calendar and Gmail operations

**Dependencies:** Phase 2 (gmail/utils.ts created)

---

## Phase 4: Validation

**Goal:** Replace unsafe non-null assertions with proper runtime validation.

**Requirements:**
- VAL-01: Gmail non-null assertions validated
- VAL-02: Calendar non-null assertions validated
- VAL-03: `modifyLabels` validates operations

**Key Files:**
- `src/modules/gmail/read.ts`
- `src/modules/gmail/list.ts`
- `src/modules/gmail/labels.ts`
- `src/modules/calendar/read.ts`

**Success Criteria:**
- No `!` assertions without preceding validation
- Clear error messages for missing required data
- `modifyLabels` throws if no labels to add/remove
- Tests cover null/undefined API response scenarios

**Dependencies:** None

---

## Phase 5: Caching

**Goal:** Ensure consistent caching patterns across all modules.

**Requirements:**
- CACHE-01: Forms module caching
- CACHE-02: Calendar cache key fix

**Key Files:**
- `src/modules/forms/read.ts`
- `src/modules/calendar/read.ts`

**Success Criteria:**
- Forms read operations use cache manager
- Cache hit/miss properly recorded
- Calendar event cache includes `calendarId` in key
- No cache collision possible across calendars
- Tests verify caching behavior

**Dependencies:** None

---

## Phase 6: Cleanup & Documentation

**Goal:** Remove dead code, fix minor issues, and complete documentation.

**Requirements:**
- CLEAN-01: Remove unused `DeleteEventResult` export
- CLEAN-02: Remove dead `timeZone` block
- CLEAN-03: Remove `|| undefined` patterns
- CLEAN-04: Add search logging
- CLEAN-05: Standardize freebusy error handling
- CLEAN-06: Add `labelIds` to `CreateDraftResult`
- DOC-01: Document threading parameters

**Key Files:**
- `src/modules/calendar/types.ts`
- `src/modules/calendar/index.ts`
- `src/modules/calendar/create.ts`
- `src/modules/calendar/freebusy.ts`
- `src/modules/forms/read.ts`
- `src/modules/drive/search.ts`
- `src/modules/gmail/types.ts`
- `src/tools/listTools.ts`

**Success Criteria:**
- No dead code remains in identified locations
- Consistent error handling patterns
- Complete API documentation for threading
- All tests pass
- Clean lint output

**Dependencies:** Phase 1 (API-03 must be done before CLEAN-01)

---

## Phase Order & Parallelization

```
Phase 1 (API) ──────┐
Phase 2 (Security) ─┼─► Phase 3 (DRY) ─► Phase 6 (Cleanup)
Phase 4 (Validation)┤
Phase 5 (Caching) ──┘
```

**Parallel Safe:**
- Phases 1, 2, 4, 5 can run in parallel
- Phase 3 depends on Phase 2 (gmail/utils.ts)
- Phase 6 depends on Phase 1 (API-03 before CLEAN-01)

---

*Roadmap created: 2026-01-25*
*Last updated: 2026-01-25 after Phase 1 planning*
