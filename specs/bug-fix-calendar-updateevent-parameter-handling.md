# Bug Fix: Calendar updateEvent Parameter Handling

**Generated:** 2026-01-12
**Status:** Ready for Implementation
**RBP Compatible:** Yes
**Priority:** P1 - High

## Problem Statement

### Why This Exists
The `updateEvent` operation in the Google Calendar integration (issue #31) fails with `Cannot read properties of undefined (reading 'start')` when users provide date/time parameters. This prevents users from updating calendar events with new times or attendees, breaking a core calendar management workflow.

### Who It's For
- MCP clients using the gdrive server to manage Google Calendar events
- Users trying to update event times, add attendees, or modify event details
- Developers integrating Calendar API functionality into their applications

### Cost of NOT Doing It
- Calendar event updates are completely broken - users cannot modify existing events
- Workaround requires using `deleteEvent` + `createEvent`, losing event history and attendee responses
- User frustration and reduced trust in the Calendar integration
- P1 priority indicates immediate business impact

### Root Cause Analysis
Located in `/Users/aojdevstudio/MCP-Servers/gdrive/src/modules/calendar/update.ts` lines 116-165:

1. **Current Behavior**: Lines 161-165 directly assign `updates.start` and `updates.end` to `eventResource.start/end`
2. **Type Mismatch**: Users naturally pass ISO strings (`"2026-01-10T14:00:00-06:00"`) but Google Calendar API expects `EventDateTime` objects (`{dateTime: string, timeZone?: string}`)
3. **Failure Point**: Line 117 calls `validateEventTimes(updates.start, updates.end)` which tries to access `.dateTime` property on a string, causing `Cannot read properties of undefined`

### Issue Details
- **GitHub Issue**: #31
- **Created**: 2026-01-10
- **File**: `src/modules/calendar/update.ts:105-364`
- **Error Message**: `MCP error -32603: Cannot read properties of undefined (reading 'start')`

## Technical Requirements

### Architecture Decision: Flexible Parameter Parsing
Following the user's preference to "Support both formats", implement automatic detection and conversion:

**Input Format 1 - ISO String (Simple)**:
```json
{
  "start": "2026-01-10T14:00:00-06:00",
  "end": "2026-01-10T15:00:00-06:00"
}
```

**Input Format 2 - EventDateTime Object (Explicit)**:
```json
{
  "start": {"dateTime": "2026-01-10T14:00:00-06:00", "timeZone": "America/Chicago"},
  "end": {"dateTime": "2026-01-10T15:00:00-06:00", "timeZone": "America/Chicago"}
}
```

**Input Format 3 - All-Day Event (Date Only)**:
```json
{
  "start": {"date": "2026-01-10"},
  "end": {"date": "2026-01-11"}
}
```

### Implementation Approach

**1. Add Utility Function `normalizeEventDateTime`** in `src/modules/calendar/utils.ts`:
- Accept `string | EventDateTime | undefined` as input
- Return `EventDateTime | undefined`
- Auto-detect input type and convert appropriately
- Preserve timezone information when provided
- Handle both `dateTime` and `date` (all-day) formats

**2. Update `updateEvent` Function** in `src/modules/calendar/update.ts`:
- Call `normalizeEventDateTime()` for `updates.start` and `updates.end` before validation
- Update type annotations to accept flexible input
- Maintain backward compatibility with existing EventDateTime object format

**3. Update TypeScript Types** in `src/modules/calendar/types.ts`:
- Modify `UpdateEventOptions.updates.start/end` to accept `string | EventDateTime`
- Document both accepted formats in JSDoc comments
- Keep internal processing using `EventDateTime` objects

### Data Model Impact
```typescript
// Before (Strict)
interface UpdateEventOptions {
  eventId: string;
  updates: {
    start?: EventDateTime;  // Only accepts objects
    end?: EventDateTime;
  };
}

// After (Flexible)
interface UpdateEventOptions {
  eventId: string;
  updates: {
    start?: string | EventDateTime;  // Accepts both
    end?: string | EventDateTime;
  };
}

// Internal normalization ensures Google API gets correct format
```

### Performance Constraints
- String detection and conversion adds <1ms overhead per call
- No caching required (operation is O(1) string check + object creation)
- No impact on existing EventDateTime object inputs (passthrough path)

## Edge Cases & Error Handling

### Edge Case 1: Invalid ISO String Format
**Scenario**: User provides malformed datetime string
```json
{"start": "not-a-date", "end": "2026-01-10T14:00:00-06:00"}
```
**Handling**:
- Catch `Invalid Date` from `new Date()` constructor
- Throw clear error: `Invalid datetime format for 'start'. Expected ISO 8601 string or EventDateTime object.`
- Include example in error message

### Edge Case 2: Mixing String and Object Formats
**Scenario**: User provides string for start, object for end
```json
{"start": "2026-01-10T14:00:00-06:00", "end": {"dateTime": "2026-01-10T15:00:00-06:00"}}
```
**Handling**: Perfectly valid - normalize each independently

### Edge Case 3: All-Day Event with String Input
**Scenario**: User wants all-day event but provides string instead of `{date: "..."}`
```json
{"start": "2026-01-10", "end": "2026-01-11"}
```
**Handling**:
- Detect date-only format (no `T` in string, length === 10)
- Auto-convert to `{date: "2026-01-10"}` format
- Log info message about auto-detection

### Edge Case 4: Timezone Missing in ISO String
**Scenario**: User provides datetime without timezone offset
```json
{"start": "2026-01-10T14:00:00", "end": "2026-01-10T15:00:00"}
```
**Handling**:
- Accept as valid (Google API interprets in calendar's default timezone)
- Optionally log warning if `timeZone` field not in updates

### Edge Case 5: Only Updating One Time Field
**Scenario**: User updates start time but not end time
```json
{"eventId": "abc123", "updates": {"start": "2026-01-10T14:00:00-06:00"}}
```
**Handling**:
- Validation only runs if BOTH start and end provided (line 117 check)
- Single field update should work - Google API handles duration preservation

### Edge Case 6: Partial Update with Other Fields
**Scenario**: User updates summary and attendees but not times
```json
{"eventId": "abc123", "updates": {"summary": "New Title", "attendees": ["user@example.com"]}}
```
**Handling**:
- Time normalization skipped (no start/end in updates)
- Existing behavior preserved

### Error Recovery
- All errors thrown synchronously before API call
- No partial state corruption (updates not applied if validation fails)
- User receives actionable error message with format examples

## User Experience

### Mental Model
Users expect two equally valid ways to specify times:
1. **Simple strings** (like they'd type in a form): `"2026-01-10T14:00:00-06:00"`
2. **Structured objects** (like API docs show): `{dateTime: "...", timeZone: "..."}`

Both should "just work" without consulting documentation.

### Confusion Points
**Where might users get confused?**
1. **All-day events**: String `"2026-01-10"` vs object `{date: "2026-01-10"}` - auto-detection helps
2. **Timezone handling**: ISO string with offset vs explicit timeZone field - both valid
3. **Error messages**: Current error `Cannot read properties of undefined` gives no context - need better errors

### Feedback Requirements
**At each step:**
1. **Input validation failure**: Clear error with examples of valid formats
2. **Successful normalization**: Debug log showing detected format (for troubleshooting)
3. **API success**: Return updated event with normalized times in response

### Documentation Updates Required
1. Update `listTools.ts` line 279-282 to show both string and object examples
2. Add JSDoc to `UpdateEventOptions` documenting accepted formats
3. Update `CLAUDE.md` with updateEvent usage examples

## Scope & Tradeoffs

### In Scope (MVP)
✅ Accept ISO string format for start/end times
✅ Accept EventDateTime object format (existing)
✅ Auto-detect and normalize both formats
✅ Comprehensive error messages for invalid input
✅ Unit tests for all format variations
✅ Update type definitions to reflect flexibility
✅ Fix validation logic to work with normalized data

### Out of Scope (Future Enhancements)
❌ Natural language parsing ("tomorrow at 2pm") - use quickAdd for that
❌ Timezone auto-detection from user locale - require explicit timezone
❌ Batch update operations - separate feature
❌ Recurring event modification - existing support sufficient
❌ Undo/rollback functionality - not part of bug fix

### Technical Debt Accepted
- **No automatic timezone inference**: Users must include timezone in ISO string or object. Acceptable because Google API has same limitation.
- **Date-only string detection is heuristic**: Checks for `YYYY-MM-DD` pattern. Edge case: `2026-01-10T00:00:00` might be intended as all-day but treated as datetime. Acceptable - users can use explicit `{date: "..."}` format if needed.
- **No migration path for old clients**: Clients using broken format will now get clear errors instead of undefined behavior. Acceptable - existing behavior was already broken.

### MVP vs Ideal
**MVP (This PR)**:
- Support both string and object input
- Auto-normalization utility
- Clear error messages
- Unit test coverage

**Ideal (Future)**:
- Interactive parameter validation in Claude Desktop UI
- Timezone autocomplete suggestions
- Calendar-specific datetime picker widget
- Format migration guide for existing integrations

## Integration Requirements

### Systems Affected
1. **Google Calendar API** (googleapis v3):
   - No changes - still receives EventDateTime objects
   - Normalization happens before API call

2. **MCP Tool Schema** (index.ts lines 558-576):
   - No changes - `params` remains generic object
   - Type flexibility handled in module layer

3. **Cache Invalidation** (update.ts lines 346-353):
   - No changes - cache keys don't depend on time format
   - Existing invalidation logic works unchanged

### What Other Systems Need to Know
- **Calendar Module Consumers**: All date/time parameters now accept both formats
- **Test Infrastructure**: New test fixtures available for both formats
- **Documentation**: Updated examples show preferred simple string format

### Migration Path
**For Existing Clients**:
1. **No breaking changes** - existing EventDateTime object format still works
2. **Optional adoption** - clients can switch to simpler string format gradually
3. **Error clarity** - broken calls now fail fast with actionable errors instead of undefined behavior

**For New Clients**:
1. Use simple ISO string format by default
2. Use object format when explicit timezone control needed
3. Consult error messages if validation fails

## Security & Compliance

### Sensitive Data Touched
- **Event times**: No PII, timezone may reveal user location (already exposed via existing API)
- **No new data access**: Normalization is pure function, no external calls

### Authentication/Authorization
- **No changes**: Existing OAuth2 scopes sufficient
  - `https://www.googleapis.com/auth/calendar.readonly` (read)
  - `https://www.googleapis.com/auth/calendar.events` (update)

### Input Validation Security
- **ISO string parsing**: Uses `new Date()` constructor - safe from injection
- **Object structure**: TypeScript type guards prevent malformed objects
- **No eval() or dynamic code**: Pure data transformation

### Compliance Notes
- **No GDPR impact**: Datetime handling doesn't affect personal data processing
- **No audit trail changes**: Existing event modification logging unchanged

## Success Criteria & Testing

### Acceptance Criteria
**This feature is done when:**

1. ✅ **String format accepted**: `updateEvent` successfully processes ISO string times
   ```typescript
   updateEvent({eventId: "abc", updates: {start: "2026-01-10T14:00:00-06:00"}})
   ```

2. ✅ **Object format still works**: Backward compatibility maintained
   ```typescript
   updateEvent({eventId: "abc", updates: {start: {dateTime: "2026-01-10T14:00:00-06:00"}}})
   ```

3. ✅ **All-day events work**: Both string and object formats for dates
   ```typescript
   updateEvent({eventId: "abc", updates: {start: "2026-01-10"}})
   updateEvent({eventId: "abc", updates: {start: {date: "2026-01-10"}}})
   ```

4. ✅ **Clear errors**: Invalid input produces actionable error messages
   ```typescript
   // Should throw: "Invalid datetime format for 'start'. Expected ISO 8601 string or EventDateTime object. Example: '2026-01-10T14:00:00-06:00' or {dateTime: '...', timeZone: '...'}"
   updateEvent({eventId: "abc", updates: {start: "not-a-date"}})
   ```

5. ✅ **Validation works**: Time validation catches invalid ranges after normalization
   ```typescript
   // Should throw: "Event end time must be after start time"
   updateEvent({eventId: "abc", updates: {start: "2026-01-10T15:00:00-06:00", end: "2026-01-10T14:00:00-06:00"}})
   ```

6. ✅ **Tests pass**: All unit tests green, coverage >80% for new code

## Testing Strategy

### Test Framework
**Jest** (already configured in project)

### Test Command
```bash
npm test
```

### Unit Tests

#### Test File: `src/modules/calendar/__tests__/update.test.ts`

- [ ] Test: **normalizeEventDateTime with ISO string input** → Converts to EventDateTime object
  - Input: `"2026-01-10T14:00:00-06:00"`
  - Expected: `{dateTime: "2026-01-10T14:00:00-06:00"}`

- [ ] Test: **normalizeEventDateTime with EventDateTime object input** → Returns unchanged
  - Input: `{dateTime: "2026-01-10T14:00:00-06:00", timeZone: "America/Chicago"}`
  - Expected: Same object

- [ ] Test: **normalizeEventDateTime with date-only string** → Converts to date format
  - Input: `"2026-01-10"`
  - Expected: `{date: "2026-01-10"}`

- [ ] Test: **normalizeEventDateTime with undefined** → Returns undefined
  - Input: `undefined`
  - Expected: `undefined`

- [ ] Test: **normalizeEventDateTime with invalid string** → Throws error with helpful message
  - Input: `"not-a-date"`
  - Expected: Error matching `/Invalid datetime format/`

- [ ] Test: **updateEvent with string times** → Successfully updates event
  - Mock Google API response
  - Verify normalized times sent to API
  - Verify eventResource built correctly

- [ ] Test: **updateEvent with object times** → Backward compatibility maintained
  - Use existing EventDateTime objects
  - Verify no conversion applied
  - Verify same API call as before

- [ ] Test: **updateEvent with mixed formats** → Handles string start + object end
  - Input: `{start: "2026-01-10T14:00:00-06:00", end: {dateTime: "2026-01-10T15:00:00-06:00"}}`
  - Verify both normalized correctly

- [ ] Test: **updateEvent validation after normalization** → Catches invalid time ranges
  - Input: end before start (using strings)
  - Expected: Validation error thrown

- [ ] Test: **updateEvent with partial update** → Only start time updated
  - Input: `{start: "2026-01-10T14:00:00-06:00"}` (no end)
  - Verify validation skipped, update succeeds

#### Test File: `src/modules/calendar/__tests__/utils.test.ts`

- [ ] Test: **normalizeEventDateTime helper function** → Unit test suite
  - All format variations
  - Error cases
  - Edge cases (timezone handling, date vs datetime detection)

### Integration Tests
Not required for this bug fix - unit tests provide sufficient coverage for pure functions.

### Manual Testing Checklist
Before closing issue #31:
- [ ] Test updateEvent with ISO string times in Claude Desktop
- [ ] Test updateEvent with EventDateTime objects
- [ ] Test updateEvent with attendees + string times (issue reproduction case)
- [ ] Verify error message clarity when invalid format provided
- [ ] Verify cache invalidation still works

## Implementation Tasks

<!-- RBP-TASKS-START -->
### Task 1: Add normalizeEventDateTime utility function
- **ID:** task-001
- **Dependencies:** none
- **Files:** `src/modules/calendar/utils.ts`
- **Acceptance:** Function accepts string/EventDateTime/undefined, returns normalized EventDateTime/undefined, handles all edge cases
- **Tests:** `src/modules/calendar/__tests__/utils.test.ts` (new test suite for normalization)

### Task 2: Update TypeScript type definitions
- **ID:** task-002
- **Dependencies:** task-001
- **Files:** `src/modules/calendar/types.ts`
- **Acceptance:** UpdateEventOptions.updates.start/end accept string | EventDateTime, JSDoc includes both format examples
- **Tests:** Type checking passes (`npm run type-check`)

### Task 3: Integrate normalization into updateEvent function
- **ID:** task-003
- **Dependencies:** task-001, task-002
- **Files:** `src/modules/calendar/update.ts`
- **Acceptance:** Normalize start/end before validation, validation works with normalized data, API receives correct EventDateTime objects
- **Tests:** `src/modules/calendar/__tests__/update.test.ts` (comprehensive updateEvent test suite)

### Task 4: Update error messages for clarity
- **ID:** task-004
- **Dependencies:** task-001
- **Files:** `src/modules/calendar/utils.ts`
- **Acceptance:** Invalid input produces error with format examples and helpful guidance
- **Tests:** Error message tests in utils.test.ts

### Task 5: Update documentation and tool definitions
- **ID:** task-005
- **Dependencies:** task-003
- **Files:** `src/tools/listTools.ts`, `CLAUDE.md`
- **Acceptance:** Tool signature shows both formats, usage examples demonstrate string format, CLAUDE.md has updateEvent examples
- **Tests:** Manual review

### Task 6: Write comprehensive unit tests
- **ID:** task-006
- **Dependencies:** task-003
- **Files:** `src/modules/calendar/__tests__/update.test.ts`, `src/modules/calendar/__tests__/utils.test.ts`
- **Acceptance:** All test cases pass, coverage >80% for new code, edge cases covered
- **Tests:** `npm test` (self-validating)

### Task 7: Manual testing and issue verification
- **ID:** task-007
- **Dependencies:** task-006
- **Files:** N/A (testing only)
- **Acceptance:** Issue #31 reproduction case works, error messages clear, backward compatibility verified
- **Tests:** Manual testing checklist completed
<!-- RBP-TASKS-END -->

## Implementation Notes

### Files to Modify

**1. `src/modules/calendar/utils.ts` (NEW function)**
- Add `normalizeEventDateTime(input: string | EventDateTime | undefined): EventDateTime | undefined`
- Export function for use in update.ts and tests
- Include comprehensive JSDoc with examples

**2. `src/modules/calendar/types.ts` (TYPE updates)**
- Modify `UpdateEventOptions` interface
- Update JSDoc comments with format examples
- No runtime code changes

**3. `src/modules/calendar/update.ts` (INTEGRATION)**
- Import `normalizeEventDateTime` from utils
- Add normalization before validation (after line 114):
  ```typescript
  // Normalize start/end times to EventDateTime format
  const normalizedUpdates = {
    ...updates,
    start: updates.start ? normalizeEventDateTime(updates.start) : undefined,
    end: updates.end ? normalizeEventDateTime(updates.end) : undefined
  };
  ```
- Use `normalizedUpdates` for validation and event resource building
- Minimal changes to existing logic

**4. `src/tools/listTools.ts` (DOCUMENTATION)**
- Update line 279-282 (calendar.updateEvent signature)
- Add example showing string format as primary, object as alternative

**5. `CLAUDE.md` (USAGE GUIDE)**
- Add Calendar API section if not present
- Include updateEvent examples with both formats
- Cross-reference with issue #31 for context

### Patterns to Follow

**Existing Calendar Module Patterns**:
1. **Validation before API calls**: See `validateEventTimes` usage in create.ts and update.ts
2. **Contact resolution**: See `resolveContacts` pattern in create.ts lines 131-144
3. **Conditional field building**: See update.ts lines 149-215 (only include defined fields)
4. **Cache invalidation**: See update.ts lines 346-353 (pattern to preserve)

**Testing Patterns (from existing tests)**:
- Mock Google API responses: See `src/__tests__/sheets/createSheet.test.ts`
- Jest describe/it structure: Follow existing test organization
- Type assertion patterns: Use existing calendar test fixtures

**Error Handling Patterns**:
- Throw synchronously before API calls (see validateEventTimes)
- Include actionable guidance in error messages
- Use template literals for formatted error text

### Code Quality Checklist
- [ ] TypeScript strict mode compliance
- [ ] ESLint passes (`npm run lint`)
- [ ] Type checking passes (`npm run type-check`)
- [ ] All tests pass (`npm test`)
- [ ] Test coverage >80% for new code
- [ ] JSDoc comments on all exported functions
- [ ] No console.log() statements (use logger)
- [ ] Error messages are user-friendly

---

## Related Issues

### Issue #10 - OBSOLETE (Closed)
**Status**: The `getAppScript` feature was removed in architecture cleanup (commit 89e17fb, 2025-09-23). Issue #10 was created on 2025-08-11, before the removal. This issue is now obsolete and should be closed with reason: "Feature removed in v3.1.0 architecture refactor. Apps Script viewing is no longer part of this MCP server."

**Action Required**: Close GitHub issue #10 with comment explaining feature removal and pointing to commit 89e17fb for context.

---

## Summary

This specification provides a complete implementation plan for fixing the `updateEvent` calendar bug (issue #31) by supporting flexible datetime parameter formats. The solution normalizes user input (ISO strings or EventDateTime objects) before validation and API calls, maintaining backward compatibility while dramatically improving user experience. With comprehensive test coverage and clear error messages, this fix transforms a completely broken feature into a robust, user-friendly API operation.

**Estimated Implementation Time**: 4-6 hours
**Risk Level**: Low (pure function transformation, no external dependencies)
**Breaking Changes**: None (additive change only)
