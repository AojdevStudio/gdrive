# Requirements: GDrive MCP Server Bug Fix

**Defined:** 2026-01-25
**Core Value:** AI agents can reliably use the MCP server APIs without parameter confusion, security issues, or runtime errors

## v1 Requirements

Requirements for this cleanup milestone. Each maps to roadmap phases.

### API Consistency (HIGH)

- [ ] **API-01**: Gmail `modifyLabels` uses `id` parameter matching `getMessage`/`getThread`
- [ ] **API-02**: Calendar `EventResult` returns `eventId` matching input options
- [ ] **API-03**: Calendar `deleteEvent` returns `DeleteEventResult` type with `eventId`

### Security (HIGH)

- [ ] **SEC-01**: Drive search query escapes single quotes preventing injection
- [ ] **SEC-02**: Gmail `compose.ts` uses shared validation matching `send.ts` security

### DRY Violations (MEDIUM)

- [ ] **DRY-01**: Single `parseAttendees` function in `calendar/utils.ts`
- [ ] **DRY-02**: Single `buildEventResult` function in `calendar/utils.ts`
- [ ] **DRY-03**: Single `encodeToBase64Url` function in `gmail/utils.ts`

### Validation (MEDIUM)

- [ ] **VAL-01**: Non-null assertions replaced with explicit validation in Gmail
- [ ] **VAL-02**: Non-null assertions replaced with explicit validation in Calendar
- [ ] **VAL-03**: `modifyLabels` validates at least one label operation provided

### Caching (MEDIUM)

- [ ] **CACHE-01**: Forms module implements caching consistent with other modules
- [ ] **CACHE-02**: Calendar `getEvent` cache key includes `calendarId`

### Cleanup (LOW)

- [ ] **CLEAN-01**: Remove unused `DeleteEventResult` export after API-03 fix
- [ ] **CLEAN-02**: Remove dead `timeZone` code block in `calendar/create.ts`
- [ ] **CLEAN-03**: Remove redundant `|| undefined` patterns in `forms/read.ts`
- [ ] **CLEAN-04**: Add logging to Drive search operations
- [ ] **CLEAN-05**: Standardize error handling in `calendar/freebusy.ts`
- [ ] **CLEAN-06**: Add `labelIds` to `CreateDraftResult` type

### Documentation (LOW)

- [ ] **DOC-01**: Document threading parameters (`inReplyTo`, `references`, `threadId`) in listTools.ts

## v2 Requirements

Deferred to future releases. Not in current roadmap.

- Performance optimization beyond consistency fixes
- Additional API enhancements
- New feature development

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| New API endpoints | This is cleanup only |
| Breaking changes beyond renames | Clean break only for naming consistency |
| Refactoring unrelated code | Focused scope |
| OAuth/auth changes | Not in identified issues |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| API-01 | Phase 1 | Pending |
| API-02 | Phase 1 | Pending |
| API-03 | Phase 1 | Pending |
| SEC-01 | Phase 2 | Pending |
| SEC-02 | Phase 2 | Pending |
| DRY-01 | Phase 3 | Pending |
| DRY-02 | Phase 3 | Pending |
| DRY-03 | Phase 3 | Pending |
| VAL-01 | Phase 4 | Pending |
| VAL-02 | Phase 4 | Pending |
| VAL-03 | Phase 4 | Pending |
| CACHE-01 | Phase 5 | Pending |
| CACHE-02 | Phase 5 | Pending |
| CLEAN-01 | Phase 6 | Pending |
| CLEAN-02 | Phase 6 | Pending |
| CLEAN-03 | Phase 6 | Pending |
| CLEAN-04 | Phase 6 | Pending |
| CLEAN-05 | Phase 6 | Pending |
| CLEAN-06 | Phase 6 | Pending |
| DOC-01 | Phase 6 | Pending |

**Coverage:**
- v1 requirements: 19 total
- Mapped to phases: 19
- Unmapped: 0 ✓

---
*Requirements defined: 2026-01-25*
*Last updated: 2026-01-25 after initial definition*
