# GDrive MCP Server - Bug Fix & Technical Debt Cleanup

## What This Is

A comprehensive bug fix and technical debt cleanup initiative for the Google Drive MCP server. This project addresses 28 identified issues spanning API inconsistencies, security vulnerabilities, DRY violations, and code quality problems across the Gmail, Calendar, Drive, and Forms modules.

## Core Value

**AI agents can reliably use the MCP server APIs without encountering parameter naming confusion, security vulnerabilities, or runtime errors.**

Every fix must improve the experience for AI agents consuming this API.

## Requirements

### Validated

<!-- Shipped and confirmed valuable. -->

(None yet — ship to validate)

### Active

<!-- Current scope. Building toward these. -->

**HIGH Priority (Breaking changes, Security)**
- [ ] Fix Gmail `id` vs `messageId` parameter inconsistency (#1)
- [ ] Fix Calendar `eventId` vs `id` return type inconsistency (#2)
- [ ] Fix Calendar `deleteEvent` returns wrong type structure (#3)
- [ ] Fix search query SQL injection vulnerability (#4)
- [ ] Extract email validation from `send.ts` to shared utils for `compose.ts` (#5)

**MEDIUM Priority (Code quality, DRY, Validation)**
- [ ] Extract `parseAttendees` to shared Calendar utils (#6)
- [ ] Extract ~250 lines of response building code to shared utils (#7)
- [ ] Add caching to Forms module (#8)
- [ ] Replace non-null assertions with proper validation (#9)
- [ ] Fix cache key missing `calendarId` (#10)
- [ ] Add validation to `modifyLabels` for empty operations (#11)
- [ ] Extract duplicate base64URL encoding to shared util (#12)

**LOW Priority (Cleanup, Documentation)**
- [ ] Remove unused `DeleteEventResult` type export (#13)
- [ ] Remove dead `timeZone` code block (#14)
- [ ] Clean up redundant `|| undefined` patterns (#15)
- [ ] Add missing search operation logging (#16)
- [ ] Standardize error handling pattern in `freebusy.ts` (#17)
- [ ] Add `labelIds` to `CreateDraftResult` (#18)
- [ ] Document threading parameters in listTools.ts (#19)

### Out of Scope

<!-- Explicit boundaries. Includes reasoning to prevent re-adding. -->

- New features — This is purely cleanup and fixes
- API breaking changes beyond parameter renames — Clean break approved only for naming
- Performance optimization work — Cache additions are for consistency, not optimization
- Refactoring beyond fixing identified issues — No scope creep

## Context

**Codebase State:**
- Brownfield project with established patterns
- Codebase mapped in `.planning/codebase/` (7 documents)
- TypeScript/Node.js with ES modules
- Google Workspace APIs: Drive, Sheets, Forms, Docs, Gmail, Calendar
- Redis caching infrastructure
- Jest testing framework with 60%+ coverage

**Source of Issues:**
- Analysis by 3 parallel code-simplifier agents (2026-01-23)
- API verification against official Google docs (2026-01-24)
- Full specification in `specs/bugs.md`

**Testing Approach:**
- Each fix must have unit tests
- Manual verification required for all changes
- Existing test patterns to follow in `__tests__/` directories

## Constraints

- **Breaking Changes**: Clean break approved — no deprecation period for parameter renames
- **Testing**: Both unit tests AND manual verification required per fix
- **Dependencies**: All issues are independent — can be parallelized
- **Patterns**: Follow existing codebase conventions documented in `.planning/codebase/CONVENTIONS.md`

## Key Decisions

<!-- Decisions that constrain future work. Add throughout project lifecycle. -->

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Clean break for API renames | Simpler codebase, less tech debt | — Pending |
| All 28 issues in scope | Complete cleanup vs partial | — Pending |
| Tests + manual verification | Higher confidence in fixes | — Pending |

---
*Last updated: 2026-01-25 after project initialization*
