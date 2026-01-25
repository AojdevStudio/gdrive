# Codebase Analysis: Bugs, Inconsistencies, and Technical Debt

**Analysis Date**: 2026-01-23
**Analyzed By**: 3 parallel code-simplifier agents
**Total Issues Found**: 28
**API Verification**: 2026-01-24 - Verified against official Google API documentation (Gmail v1, Calendar v3)

---

## Executive Summary

This document captures all bugs, inconsistencies, and technical debt identified in the gdrive MCP server codebase. Issues are categorized by priority and include specific file locations, descriptions, and recommended fixes.

### Issue Distribution

| Priority | Count | Categories |
|----------|-------|------------|
| HIGH | 5 | Breaking changes, Security vulnerabilities |
| MEDIUM | 7 | Code quality, DRY violations, Missing validation |
| LOW | 7+ | Cleanup, Dead code, Minor inconsistencies |

---

## HIGH PRIORITY Issues

### Issue #1: Gmail `id` vs `messageId` Parameter Inconsistency

**Type**: API Inconsistency (Breaking for AI agents)
**Severity**: HIGH
**Status**: Open

**Location**:
- `/src/modules/gmail/types.ts:83` - `GetMessageOptions.id`
- `/src/modules/gmail/types.ts:126` - `GetThreadOptions.id`
- `/src/modules/gmail/types.ts:301` - `ModifyLabelsOptions.messageId`

**Description**:
The Gmail module uses `id` for `getMessage` and `getThread` operations, but uses `messageId` for `modifyLabels`. This inconsistency causes AI agents to use the wrong parameter name when calling the API.

**Google API Documentation Reference**:
Per the official Gmail API v1, all message operations use `id` as the path parameter:
- `GET /gmail/v1/users/{userId}/messages/{id}` (messages.get)
- `POST /gmail/v1/users/{userId}/messages/{id}/modify` (messages.modify)

**Evidence**:
```typescript
// GetMessageOptions uses 'id'
export interface GetMessageOptions {
  id: string;  // line 83
  format?: 'minimal' | 'full' | 'raw' | 'metadata';
}

// ModifyLabelsOptions uses 'messageId'
export interface ModifyLabelsOptions {
  messageId: string;  // line 301
  addLabelIds?: string[];
  removeLabelIds?: string[];
}
```

**Impact**: AI agents learning from `getMessage({ id: "..." })` will incorrectly call `modifyLabels({ id: "..." })` instead of `modifyLabels({ messageId: "..." })`.

**Recommended Fix**: Standardize to `id` across all single-resource operations:
1. Change `ModifyLabelsOptions.messageId` to `id`
2. Update `ModifyLabelsResult.messageId` to `id`
3. Update `/src/modules/gmail/labels.ts` implementation
4. Update `/src/tools/listTools.ts` documentation

---

### Issue #2: Calendar `eventId` vs `id` Return Type Inconsistency

**Type**: API Inconsistency (Confusing for AI agents)
**Severity**: HIGH
**Status**: Open

**Location**:
- `/src/modules/calendar/types.ts:102-104` - `GetEventOptions.eventId`
- `/src/modules/calendar/types.ts:263-268` - `UpdateEventOptions.eventId`
- `/src/modules/calendar/types.ts:273-277` - `DeleteEventOptions.eventId`
- `/src/modules/calendar/types.ts:131` - `EventResult.id` (returns `id`)

**Description**:
The Calendar module accepts `eventId` in operation options but returns `id` in results. This creates inconsistency when chaining operations (e.g., create → update).

**Google API Documentation Reference**:
Per the official Google Calendar API v3, event operations use `eventId` as the path parameter:
- `GET /calendar/v3/calendars/{calendarId}/events/{eventId}`
- `PUT /calendar/v3/calendars/{calendarId}/events/{eventId}`
- `DELETE /calendar/v3/calendars/{calendarId}/events/{eventId}`

**Evidence**:
```typescript
// Options correctly use 'eventId' (matches Google API)
export interface GetEventOptions {
  calendarId?: string;
  eventId: string;
}

// Results use 'id' (inconsistent with options)
export interface EventResult {
  id: string;  // Should be 'eventId' for consistency
}
```

**Impact**: AI agents that chain operations must rename the result field:
```typescript
const event = await calendar.getEvent({ eventId: "abc123" });
// event.id is returned, but next operation needs eventId
await calendar.updateEvent({ eventId: event.id, ... }); // Mismatch!
```

**Recommended Fix**: Standardize to `eventId` in both options AND result types to match Google's API naming:
1. Keep `eventId` in all options interfaces (already correct)
2. Change `EventResult.id` to `EventResult.eventId`
3. Update all files that build EventResult objects
4. Update `/src/tools/listTools.ts` documentation

---

### Issue #3: Calendar `deleteEvent` Returns Wrong Type Structure

**Type**: Bug / Type Mismatch
**Severity**: HIGH
**Status**: Open

**Location**:
- `/src/modules/calendar/delete.ts:48` - Function return
- `/src/modules/calendar/types.ts:282-285` - Type definition

**Description**:
The `DeleteEventResult` type is defined but not used. The function returns `{ success: boolean; message: string }` instead of the defined type `{ eventId: string; message: string }`.

**Evidence**:
```typescript
// types.ts defines:
export interface DeleteEventResult {
  eventId: string;
  message: string;
}

// delete.ts returns (line 81-84):
return {
  success: true,  // NOT in the type!
  message: 'Event deleted successfully',
};  // Missing eventId!
```

**Recommended Fix**:
```typescript
export async function deleteEvent(
  options: DeleteEventOptions,
  context: CalendarContext
): Promise<DeleteEventResult> {
  // ...
  return {
    eventId: options.eventId,
    message: 'Event deleted successfully',
  };
}
```

---

### Issue #4: Search Query SQL Injection Vulnerability

**Type**: Security Vulnerability
**Severity**: HIGH
**Status**: Open

**Location**:
- `/src/modules/drive/search.ts:63`

**Description**:
The search query is directly interpolated without escaping single quotes. If the query contains single quotes, it could break the query or cause unexpected behavior.

**Evidence**:
```typescript
q: `name contains '${query}' and trashed = false`,
```

**Attack Vector**: A query like `test' or name contains '` would break the query structure.

**Recommended Fix**:
```typescript
const escapedQuery = query.replace(/'/g, "\\'");
q: `name contains '${escapedQuery}' and trashed = false`,
```

---

### Issue #5: `compose.ts` Lacks Security Validation Present in `send.ts`

**Type**: Security Inconsistency
**Severity**: HIGH
**Status**: Open

**Location**:
- `/src/modules/gmail/compose.ts:14-43` - Simple `buildEmailMessage` (~30 lines)
- `/src/modules/gmail/send.ts:80-126` - Secure `buildEmailMessage` (~50 lines)

**Description**:
The `createDraft` function builds email messages without any validation, while `sendMessage` includes:
- `isValidEmailAddress()` function
- `sanitizeHeaderValue()` for header injection prevention
- `encodeSubject()` for RFC 2047 MIME encoding
- `validateAndSanitizeRecipients()` function

**Impact**: Drafts can be created with malformed email addresses or potentially injected headers, only failing when sent.

**Recommended Fix**: Extract validation functions to a shared `utils.ts` and use in both `compose.ts` and `send.ts`.

---

## MEDIUM PRIORITY Issues

### Issue #6: `parseAttendees` Function Duplicated 3 Times

**Type**: DRY Violation
**Severity**: MEDIUM
**Status**: Open

**Location**:
- `/src/modules/calendar/read.ts:88-122`
- `/src/modules/calendar/create.ts:20-61`
- `/src/modules/calendar/update.ts:19-60`

**Description**:
The `parseAttendees` function is copy-pasted into three different files with slightly different implementations.

**Differences**:
- `read.ts` version uses `if (attendee.displayName)` check
- `create.ts` and `update.ts` versions use `typeof displayName === 'string'` with intermediate variables
- Boolean handling differs (`if (attendee.organizer)` vs `if (attendee.organizer === true)`)

**Recommended Fix**: Extract to `/src/modules/calendar/utils.ts`:
```typescript
export function parseAttendees(
  attendees: calendar_v3.Schema$EventAttendee[] | undefined
): Attendee[] | undefined {
  // Single canonical implementation
}
```

---

### Issue #7: ~250 Lines of Response Building Code Duplicated

**Type**: DRY Violation
**Severity**: MEDIUM
**Status**: Open

**Location**:
- `/src/modules/calendar/create.ts:244-377` (~130 lines)
- `/src/modules/calendar/update.ts:232-364` (~130 lines)
- `/src/modules/calendar/read.ts:164-286` (~120 lines)

**Description**:
The `EventResult` building logic is nearly identical across `createEvent`, `updateEvent`, `quickAdd`, and `getEvent` functions.

**Recommended Fix**: Create shared utility:
```typescript
// /src/modules/calendar/utils.ts
export function buildEventResult(data: calendar_v3.Schema$Event): EventResult {
  const result: EventResult = { id: data.id! };
  if (data.status) result.status = data.status;
  // ... rest of the mapping
  return result;
}
```

---

### Issue #8: Forms Module Missing Caching

**Type**: Inconsistency
**Severity**: MEDIUM
**Status**: Open

**Location**:
- `/src/modules/forms/read.ts`

**Description**:
Unlike `gmail/read.ts`, `calendar/read.ts`, `drive/read.ts`, and `sheets/read.ts`, the `forms/read.ts` module does not implement caching. No `cacheManager.get()` or `cacheManager.set()` calls.

**Recommended Fix**: Add caching pattern consistent with other modules:
```typescript
const cacheKey = `forms:readForm:${formId}`;
const cached = await context.cacheManager.get(cacheKey);
if (cached) {
  context.performanceMonitor.recordCacheHit();
  return cached;
}
// ... perform operation
await context.cacheManager.set(cacheKey, result);
```

---

### Issue #9: Non-Null Assertions Without Validation

**Type**: Potential Runtime Error
**Severity**: MEDIUM
**Status**: Open

**Location**:
- `/src/modules/gmail/read.ts:114` - `message.id!`, `message.threadId!`
- `/src/modules/gmail/list.ts:70-73` - `msg.id!`, `msg.threadId!`
- `/src/modules/calendar/read.ts` - Multiple occurrences

**Evidence**:
```typescript
const result: MessageResult = {
  id: message.id!,        // Could be null/undefined
  threadId: message.threadId!,  // Could be null/undefined
};
```

**Impact**: Runtime errors if Gmail API returns unexpected null values.

**Recommended Fix**: Add defensive checks:
```typescript
if (!message.id || !message.threadId) {
  throw new Error('Invalid message response: missing id or threadId');
}
```

---

### Issue #10: Cache Key Inconsistency - Missing `calendarId`

**Type**: Bug (Potential Cache Collision)
**Severity**: MEDIUM
**Status**: Open

**Location**:
- `/src/modules/calendar/read.ts:149`

**Description**:
The `getEvent` cache key doesn't include `calendarId`, which could cause cache collisions if the same event ID exists in different calendars.

**Evidence**:
```typescript
// Current (problematic)
const cacheKey = `calendar:getEvent:${eventId}`;

// Should be
const cacheKey = `calendar:getEvent:${calendarId}:${eventId}`;
```

---

### Issue #11: `modifyLabels` Allows Empty Operations

**Type**: Missing Validation
**Severity**: MEDIUM
**Status**: Open

**Location**:
- `/src/modules/gmail/labels.ts:131-137`

**Description**:
If both `addLabelIds` and `removeLabelIds` are undefined or empty, an empty request is sent to the API.

**Recommended Fix**:
```typescript
if ((!addLabelIds || addLabelIds.length === 0) &&
    (!removeLabelIds || removeLabelIds.length === 0)) {
  throw new Error('At least one of addLabelIds or removeLabelIds must be provided');
}
```

---

### Issue #12: Duplicate Base64URL Encoding

**Type**: DRY Violation
**Severity**: MEDIUM
**Status**: Open

**Location**:
- `/src/modules/gmail/compose.ts:70-74`
- `/src/modules/gmail/send.ts:162-166`

**Evidence**:
```typescript
// Identical code in both files:
const encodedMessage = Buffer.from(emailMessage)
  .toString('base64')
  .replace(/\+/g, '-')
  .replace(/\//g, '_')
  .replace(/=+$/, '');
```

**Recommended Fix**: Extract to shared utility:
```typescript
// /src/modules/gmail/utils.ts
export function encodeToBase64Url(content: string): string {
  return Buffer.from(content)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}
```

---

## LOW PRIORITY Issues

### Issue #13: Unused `DeleteEventResult` Type Exported

**Type**: Dead Code
**Severity**: LOW
**Status**: Open

**Location**:
- `/src/modules/calendar/types.ts:282-285`
- `/src/modules/calendar/index.ts:30`

**Description**: `DeleteEventResult` is exported from the module index but never actually used by the `deleteEvent` function.

---

### Issue #14: Dead `timeZone` Code Block

**Type**: Dead Code
**Severity**: LOW
**Status**: Open

**Location**:
- `/src/modules/calendar/create.ts:237-240`

**Evidence**:
```typescript
if (timeZone) {
  // TimeZone is set in the start/end EventDateTime objects, not at the params level
  // So we just ensure it's passed through correctly in the eventResource
}
```

Empty conditional block that does nothing.

---

### Issue #15: Redundant `|| undefined` Patterns

**Type**: Code Complexity
**Severity**: LOW
**Status**: Open

**Location**:
- `/src/modules/forms/read.ts:65-77`

**Evidence**:
```typescript
itemId: item.itemId || undefined,  // Redundant
title: item.title || undefined,     // Redundant
```

The `|| undefined` is redundant when the type already accepts `undefined`.

---

### Issue #16: Missing Search Operation Logging

**Type**: Inconsistency
**Severity**: LOW
**Status**: Open

**Location**:
- `/src/modules/drive/search.ts`

**Description**: The `search` and `enhancedSearch` functions track performance but don't log info like other operations do.

---

### Issue #17: Inconsistent Error Handling Pattern in `freebusy.ts`

**Type**: Inconsistency
**Severity**: LOW
**Status**: Open

**Location**:
- `/src/modules/calendar/freebusy.ts:50-114`

**Description**: `freebusy.ts` uses try/catch with re-throw pattern while other Calendar and Gmail files do not use try/catch.

---

### Issue #18: `CreateDraftResult` Missing `labelIds`

**Type**: Inconsistency
**Severity**: LOW
**Status**: Open

**Location**:
- `/src/modules/gmail/types.ts:196` - `CreateDraftResult`

**Description**: `SendMessageResult`, `SendDraftResult`, and `ModifyLabelsResult` all include `labelIds`, but `CreateDraftResult` does not.

---

### Issue #19: Threading Parameters Missing from Documentation

**Type**: Documentation Gap
**Severity**: LOW
**Status**: Open

**Location**:
- `/src/tools/listTools.ts:218` - `createDraft` signature
- `/src/tools/listTools.ts:224` - `sendMessage` signature

**Description**:
The Gmail module fully supports email thread replies via `threadId`, `inReplyTo`, and `references` parameters in both `sendMessage` and `createDraft`. However, the API documentation in `listTools.ts` is incomplete:

**What's Implemented** (in types.ts):
```typescript
// SendMessageOptions (types.ts:210-231)
export interface SendMessageOptions {
  to: string[];
  subject: string;
  body: string;
  // ... other fields
  inReplyTo?: string;     // Message-ID being replied to
  references?: string;    // Thread reference chain
  threadId?: string;      // Associates reply with thread
}

// CreateDraftOptions (types.ts:172-191)
export interface CreateDraftOptions {
  to: string[];
  subject: string;
  body: string;
  // ... other fields
  inReplyTo?: string;     // Message-ID being replied to
  references?: string;    // Thread reference chain
}
```

**What's Documented** (in listTools.ts):
```typescript
// sendMessage - shows threadId but MISSING inReplyTo/references:
signature: 'sendMessage({ to, subject, body, ..., threadId?: string })'

// createDraft - MISSING all threading params:
signature: 'createDraft({ to, subject, body, cc?, bcc?, isHtml?, from? })'
```

**Impact**: AI agents cannot discover thread reply functionality without reading source code.

**Recommended Fix**: Update `listTools.ts` signatures:
```typescript
// createDraft
signature: 'createDraft({ to: string[], subject: string, body: string, cc?: string[], bcc?: string[], isHtml?: boolean, from?: string, inReplyTo?: string, references?: string })',
description: 'Create a draft email (supports threading via inReplyTo/references)',

// sendMessage
signature: 'sendMessage({ to: string[], subject: string, body: string, cc?: string[], bcc?: string[], isHtml?: boolean, from?: string, threadId?: string, inReplyTo?: string, references?: string })',
description: 'Send a new email message (supports threading and send-as aliases)',
```

**How to Reply to a Thread** (current undocumented workflow):
```typescript
// 1. Get the original message
const msg = await gmail.getMessage({ id: "original-msg-id" });

// 2. Reply using threadId and headers
await gmail.sendMessage({
  to: ["recipient@example.com"],
  subject: "Re: " + msg.headers.subject,
  body: "Your reply here",
  threadId: msg.threadId,
  inReplyTo: msg.headers.messageId,
  references: msg.headers.references
});
```

---

## Implementation Recommendations

### Phase 1: Critical Fixes (HIGH Priority)

1. **Fix Gmail parameter inconsistency** (~30 min)
   - Files: `types.ts`, `labels.ts`, `listTools.ts`
   - Change `messageId` to `id`

2. **Fix Calendar result type inconsistency** (~30 min)
   - Files: `types.ts`, `read.ts`, `create.ts`, `update.ts`, `listTools.ts`
   - Change `EventResult.id` to `EventResult.eventId` (keep options as-is)

3. **Fix `deleteEvent` return type** (~15 min)
   - File: `delete.ts`
   - Return `DeleteEventResult` with `eventId`

4. **Fix search query escaping** (~15 min)
   - File: `drive/search.ts`
   - Escape single quotes in query

5. **Extract email validation utilities** (~1 hour)
   - Create `gmail/utils.ts`
   - Move validation from `send.ts`
   - Use in both `send.ts` and `compose.ts`

### Phase 2: Code Quality (MEDIUM Priority)

6. **Extract shared Calendar utilities** (~1 hour)
   - Create `calendar/utils.ts`
   - Move `parseAttendees` and `buildEventResult`
   - Update imports in all Calendar files

7. **Add Forms caching** (~30 min)
   - Add caching to `forms/read.ts`

8. **Fix non-null assertions** (~30 min)
   - Add explicit validation in Gmail and Calendar read operations

9. **Fix cache key patterns** (~15 min)
   - Add `calendarId` to Calendar cache keys

10. **Add `modifyLabels` validation** (~15 min)
    - Require at least one label operation

### Phase 3: Cleanup (LOW Priority)

11. Remove dead code and unused exports
12. Fix redundant patterns
13. Add missing logging
14. Document threading parameters in listTools.ts (Issue #19)

---

## Appendix: Files Affected by Module

### Gmail Module
- `types.ts` - Issues #1, #18
- `read.ts` - Issue #9
- `list.ts` - Issue #9
- `compose.ts` - Issues #5, #12
- `send.ts` - Issue #12
- `labels.ts` - Issues #1, #11

### Calendar Module
- `types.ts` - Issues #2, #3, #13
- `read.ts` - Issues #6, #7, #10
- `create.ts` - Issues #6, #7, #14
- `update.ts` - Issues #6, #7
- `delete.ts` - Issue #3
- `freebusy.ts` - Issue #17

### Drive Module
- `search.ts` - Issues #4, #16

### Forms Module
- `read.ts` - Issues #8, #15

### Tools
- `listTools.ts` - Documentation updates for Issues #1, #2, #19
