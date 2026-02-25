# Phase 3: DRY Extraction - Research

**Researched:** 2026-01-25
**Domain:** Code refactoring, DRY (Don't Repeat Yourself) principle, TypeScript utility extraction
**Confidence:** HIGH

## Summary

Phase 3 addresses MEDIUM-priority DRY violations in the gdrive MCP server by extracting duplicated code into shared utility modules:

1. **DRY-01**: `parseAttendees` function duplicated across `calendar/read.ts`, `calendar/create.ts`, and `calendar/update.ts` - Three identical implementations (88 lines total) that transform Google Calendar API attendee schemas into type-safe `Attendee` objects.

2. **DRY-02**: `buildEventResult` pattern duplicated across calendar operations - ~110 lines of identical code in `read.ts`, `create.ts`, `update.ts`, and `quickAdd()` that transforms Google Calendar event responses into type-safe `EventResult` objects with `exactOptionalPropertyTypes` compliance.

3. **DRY-03**: `encodeToBase64Url` function already exists in `gmail/utils.ts` (created in Phase 2) but is imported and used correctly - verification shows this requirement is already satisfied.

The research confirms these are straightforward refactoring operations following established patterns. The codebase already demonstrates the target architecture in Phase 2's `gmail/utils.ts` extraction, and TypeScript's strict mode (`exactOptionalPropertyTypes: true`) requires careful handling of optional properties during extraction.

**Primary recommendation:** Extract `parseAttendees` and create new `buildEventResult` utility function in `calendar/utils.ts` following the exact pattern established by `gmail/utils.ts` in Phase 2. The `encodeToBase64Url` requirement (DRY-03) is already complete and needs no action.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | 5.x | Type-safe utility extraction | Ensures compile-time verification of refactored code |
| Node.js | 18+ | Runtime environment | ES2022 support required by tsconfig.json |
| Jest | 30.x | Test framework for refactored utilities | Current testing standard in 2026 |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @jest/globals | Latest | Test imports for ESM modules | Required for ESM TypeScript test files |
| ts-jest | Latest | TypeScript Jest transform | Required for running TypeScript tests with ESM |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Manual extraction | Automated refactoring tools | Manual extraction provides better control with exactOptionalPropertyTypes compliance |
| Class-based utilities | Function-based utilities | Functions align with existing codebase patterns (see gmail/utils.ts) |
| Single mega-utility | Domain-specific utilities | Domain-specific (calendar/utils, gmail/utils) provides better organization |

**Installation:**
No new dependencies required - all functionality uses existing TypeScript compilation and testing infrastructure.

## Architecture Patterns

### Recommended Project Structure
```
src/modules/
├── calendar/
│   ├── utils.ts                # NEW: Shared calendar utilities
│   ├── read.ts                 # Uses utils.parseAttendees, utils.buildEventResult
│   ├── create.ts               # Uses utils.parseAttendees, utils.buildEventResult
│   ├── update.ts               # Uses utils.parseAttendees, utils.buildEventResult
│   └── __tests__/
│       └── utils.test.ts       # NEW: Tests for extracted utilities
└── gmail/
    ├── utils.ts                # EXISTING: Already has encodeToBase64Url (Phase 2)
    ├── compose.ts              # Uses utils.encodeToBase64Url (already done)
    └── send.ts                 # Uses utils.encodeToBase64Url (already done)
```

### Pattern 1: Utility Function Extraction with exactOptionalPropertyTypes

**What:** Extract duplicated functions to shared utility module while maintaining TypeScript strict mode compliance
**When to use:** When the same function is duplicated across 3+ files in the same module

**Example:**
```typescript
// Source: Existing pattern in src/modules/gmail/utils.ts (Phase 2)

// src/modules/calendar/utils.ts
import type { calendar_v3 } from 'googleapis';
import type { Attendee, EventResult } from './types.js';

/**
 * Validate event time parameters
 * (Already exists in utils.ts - no changes needed)
 */
export function validateEventTimes(
  start: { dateTime?: string; date?: string },
  end: { dateTime?: string; date?: string }
): void {
  // ... existing implementation
}

/**
 * Parse attendees from Google Calendar event
 * Transforms Google API schema into type-safe Attendee objects
 *
 * CRITICAL: exactOptionalPropertyTypes=true requires explicit undefined checks
 * Cannot assign undefined to optional properties - must conditionally add them
 */
export function parseAttendees(
  attendees: calendar_v3.Schema$EventAttendee[] | undefined
): Attendee[] | undefined {
  if (!attendees || attendees.length === 0) {
    return undefined;
  }

  return attendees.map((attendee) => {
    const parsed: Attendee = {
      email: attendee.email ?? '',
    };

    // Only add optional properties if they exist
    // This pattern is required by exactOptionalPropertyTypes
    const displayName = attendee.displayName;
    if (typeof displayName === 'string') {
      parsed.displayName = displayName;
    }

    const responseStatus = attendee.responseStatus;
    if (
      responseStatus === 'needsAction' ||
      responseStatus === 'declined' ||
      responseStatus === 'tentative' ||
      responseStatus === 'accepted'
    ) {
      parsed.responseStatus = responseStatus;
    }

    if (attendee.organizer === true) {
      parsed.organizer = true;
    } else if (attendee.organizer === false) {
      parsed.organizer = false;
    }

    if (attendee.self === true) {
      parsed.self = true;
    } else if (attendee.self === false) {
      parsed.self = false;
    }

    if (attendee.optional === true) {
      parsed.optional = true;
    } else if (attendee.optional === false) {
      parsed.optional = false;
    }

    return parsed;
  });
}

/**
 * Build EventResult from Google Calendar API response
 * Transforms Google API schema into type-safe EventResult
 *
 * CRITICAL: exactOptionalPropertyTypes=true compliance
 * - Must conditionally add optional properties only if they exist
 * - Cannot use `|| undefined` pattern
 * - Must use explicit if checks before assignment
 */
export function buildEventResult(
  responseData: calendar_v3.Schema$Event
): EventResult {
  const result: EventResult = {
    eventId: responseData.id!,
  };

  // Basic properties
  if (responseData.status) {
    result.status = responseData.status;
  }
  if (responseData.htmlLink) {
    result.htmlLink = responseData.htmlLink;
  }
  if (responseData.created) {
    result.created = responseData.created;
  }
  if (responseData.updated) {
    result.updated = responseData.updated;
  }
  if (responseData.summary) {
    result.summary = responseData.summary;
  }
  if (responseData.description) {
    result.description = responseData.description;
  }
  if (responseData.location) {
    result.location = responseData.location;
  }

  // Creator
  if (responseData.creator) {
    result.creator = {};
    if (responseData.creator.email) {
      result.creator.email = responseData.creator.email;
    }
    if (responseData.creator.displayName) {
      result.creator.displayName = responseData.creator.displayName;
    }
  }

  // Organizer
  if (responseData.organizer) {
    result.organizer = {};
    if (responseData.organizer.email) {
      result.organizer.email = responseData.organizer.email;
    }
    if (responseData.organizer.displayName) {
      result.organizer.displayName = responseData.organizer.displayName;
    }
  }

  // Start/End times
  if (responseData.start) {
    result.start = {};
    if (responseData.start.dateTime) {
      result.start.dateTime = responseData.start.dateTime;
    }
    if (responseData.start.date) {
      result.start.date = responseData.start.date;
    }
    if (responseData.start.timeZone) {
      result.start.timeZone = responseData.start.timeZone;
    }
  }

  if (responseData.end) {
    result.end = {};
    if (responseData.end.dateTime) {
      result.end.dateTime = responseData.end.dateTime;
    }
    if (responseData.end.date) {
      result.end.date = responseData.end.date;
    }
    if (responseData.end.timeZone) {
      result.end.timeZone = responseData.end.timeZone;
    }
  }

  // Recurrence
  if (responseData.recurrence && responseData.recurrence.length > 0) {
    result.recurrence = responseData.recurrence;
  }

  // Attendees
  const parsedAttendees = parseAttendees(responseData.attendees);
  if (parsedAttendees) {
    result.attendees = parsedAttendees;
  }

  // Conference data
  if (responseData.conferenceData) {
    result.conferenceData = responseData.conferenceData;
  }

  // Attachments
  if (responseData.attachments && responseData.attachments.length > 0) {
    result.attachments = responseData.attachments.map((att) => ({
      fileId: att.fileId || '',
      fileUrl: att.fileUrl || '',
      title: att.title || '',
    }));
  }

  // Reminders
  if (responseData.reminders) {
    result.reminders = {
      useDefault: responseData.reminders.useDefault || false,
    };
    if (responseData.reminders.overrides && responseData.reminders.overrides.length > 0) {
      result.reminders.overrides = responseData.reminders.overrides.map((override) => ({
        method: override.method || 'popup',
        minutes: override.minutes || 0,
      }));
    }
  }

  return result;
}
```

### Pattern 2: Import and Usage After Extraction

**What:** Update consumer files to import from utils instead of local implementation
**When to use:** After extracting utilities to shared module

**Example:**
```typescript
// Source: Pattern from src/modules/gmail/compose.ts (Phase 2)

// BEFORE: Local function
function parseAttendees(...) { /* 60 lines */ }

export async function createEvent(...) {
  // ...
  const parsedAttendees = parseAttendees(response.data.attendees);
  // ...
}

// AFTER: Import from utils
import { parseAttendees, buildEventResult } from './utils.js';

export async function createEvent(...) {
  // ...
  const response = await context.calendar.events.insert(params);

  // Use extracted utilities
  const result = buildEventResult(response.data);

  // ...
  return result;
}
```

### Pattern 3: Test Coverage for Extracted Utilities

**What:** Comprehensive unit tests for utility functions independent of API mocks
**When to use:** When extracting utilities to ensure they work in isolation

**Example:**
```typescript
// Source: Pattern from src/modules/gmail/__tests__/utils.test.ts (Phase 2)

// src/modules/calendar/__tests__/utils.test.ts
import { describe, expect, test } from '@jest/globals';
import { parseAttendees, buildEventResult } from '../utils.js';

describe('parseAttendees', () => {
  test('returns undefined for empty array', () => {
    const result = parseAttendees([]);
    expect(result).toBeUndefined();
  });

  test('returns undefined for undefined input', () => {
    const result = parseAttendees(undefined);
    expect(result).toBeUndefined();
  });

  test('parses basic attendee with email only', () => {
    const input = [{ email: 'user@example.com' }];
    const result = parseAttendees(input);

    expect(result).toHaveLength(1);
    expect(result![0].email).toBe('user@example.com');
    expect(result![0].displayName).toBeUndefined();
  });

  test('parses attendee with all properties', () => {
    const input = [{
      email: 'user@example.com',
      displayName: 'Test User',
      responseStatus: 'accepted',
      organizer: true,
      self: false,
      optional: false
    }];

    const result = parseAttendees(input);

    expect(result![0]).toEqual({
      email: 'user@example.com',
      displayName: 'Test User',
      responseStatus: 'accepted',
      organizer: true,
      self: false,
      optional: false
    });
  });

  test('filters invalid response status values', () => {
    const input = [{
      email: 'user@example.com',
      responseStatus: 'invalid-status'
    }];

    const result = parseAttendees(input);

    expect(result![0].responseStatus).toBeUndefined();
  });
});

describe('buildEventResult', () => {
  test('builds minimal result with only eventId', () => {
    const input = { id: 'event123' };
    const result = buildEventResult(input);

    expect(result.eventId).toBe('event123');
    expect(result.summary).toBeUndefined();
  });

  test('builds complete result with all properties', () => {
    const input = {
      id: 'event123',
      summary: 'Test Event',
      description: 'Test Description',
      location: 'Test Location',
      status: 'confirmed',
      htmlLink: 'https://calendar.google.com/event123',
      created: '2026-01-01T00:00:00Z',
      updated: '2026-01-02T00:00:00Z',
      start: {
        dateTime: '2026-01-10T14:00:00-06:00',
        timeZone: 'America/Chicago'
      },
      end: {
        dateTime: '2026-01-10T15:00:00-06:00',
        timeZone: 'America/Chicago'
      },
      attendees: [{
        email: 'user@example.com',
        displayName: 'Test User',
        responseStatus: 'accepted'
      }],
      creator: {
        email: 'creator@example.com',
        displayName: 'Creator'
      },
      organizer: {
        email: 'organizer@example.com',
        displayName: 'Organizer'
      }
    };

    const result = buildEventResult(input);

    expect(result.eventId).toBe('event123');
    expect(result.summary).toBe('Test Event');
    expect(result.attendees).toHaveLength(1);
    expect(result.attendees![0].email).toBe('user@example.com');
  });

  test('handles optional nested objects correctly', () => {
    const input = {
      id: 'event123',
      creator: { email: 'creator@example.com' }
      // No displayName
    };

    const result = buildEventResult(input);

    expect(result.creator).toBeDefined();
    expect(result.creator!.email).toBe('creator@example.com');
    expect(result.creator!.displayName).toBeUndefined();
  });
});
```

### Anti-Patterns to Avoid

- **Partial extraction:** Don't leave duplicates behind - extract ALL occurrences or none
- **Breaking existing behavior:** Extraction must preserve exact behavior including edge cases
- **Skipping tests:** Extracted utilities must have comprehensive unit tests
- **Changing logic during extraction:** Extract first, refactor later (separate concerns)
- **Ignoring exactOptionalPropertyTypes:** Cannot use `|| undefined` - must use conditional assignment

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Type-safe object building | Custom builders | Existing buildEventResult pattern | Already handles exactOptionalPropertyTypes correctly |
| Attendee parsing logic | New implementation | Existing parseAttendees pattern | Battle-tested with multiple response status values |
| Test infrastructure | New test setup | Existing Jest + @jest/globals pattern | Already configured for ESM TypeScript |
| Base64URL encoding | New utility | Existing gmail/utils.ts function | Already implemented and tested in Phase 2 |

**Key insight:** This phase is pure extraction, not new development. All logic already exists and works correctly - the task is moving it to shared locations while maintaining exact behavior.

## Common Pitfalls

### Pitfall 1: Breaking exactOptionalPropertyTypes Compliance

**What goes wrong:** Using `|| undefined` or assigning undefined to optional properties breaks TypeScript compilation
**Why it happens:** Developers forget tsconfig.json has `exactOptionalPropertyTypes: true`
**How to avoid:**
- Use conditional assignment: `if (value) { result.field = value; }`
- Never use: `result.field = value || undefined;`
- Test with `npm run build` to catch violations early
**Warning signs:**
- TypeScript errors about "undefined is not assignable to type"
- Compilation works locally but fails in CI

### Pitfall 2: Inconsistent Extraction Between Files

**What goes wrong:** Some files use utility, others still have local implementation
**Why it happens:** Incomplete refactoring - missing one or more consumer files
**How to avoid:**
- Use grep to find ALL occurrences: `grep -r "function parseAttendees" src/modules/calendar/`
- Remove local implementations immediately after extraction
- Verify with grep that no duplicates remain
**Warning signs:**
- Same function exists in multiple files
- Inconsistent behavior between operations

### Pitfall 3: Changing Behavior During Extraction

**What goes wrong:** "Fixing" perceived issues while extracting, breaking existing consumers
**Why it happens:** Developer spots improvement opportunity during extraction
**How to avoid:**
- Extract first (preserve exact behavior)
- Refactor later (in separate commit/phase)
- If behavior differs between duplicates, investigate which is correct BEFORE extraction
**Warning signs:**
- Tests that previously passed now fail
- Subtle differences in output between old and new code

### Pitfall 4: Missing Test Coverage for Edge Cases

**What goes wrong:** Utility works for happy path but breaks on edge cases
**Why it happens:** Only testing typical usage, not boundary conditions
**How to avoid:**
- Test undefined/null inputs
- Test empty arrays
- Test partial objects (missing optional fields)
- Test invalid enum values (like invalid responseStatus)
**Warning signs:**
- High-level integration tests pass but utility tests are sparse
- Production errors that don't appear in tests

### Pitfall 5: Import Path Errors with ESM

**What goes wrong:** Imports fail at runtime due to missing `.js` extension
**Why it happens:** TypeScript allows imports without extension, but ESM requires it
**How to avoid:**
- Always use `.js` extension in imports: `from './utils.js'`
- Never use: `from './utils'`
- This is required by ES modules despite importing `.ts` files
**Warning signs:**
- Code compiles but fails at runtime
- "Cannot find module" errors despite file existing

## Code Examples

Verified patterns from existing codebase:

### Complete Extraction Example: parseAttendees

```typescript
// Source: Duplicated in src/modules/calendar/read.ts (line 88),
//         create.ts (line 20), update.ts (line 19)

// STEP 1: Add to src/modules/calendar/utils.ts
import type { calendar_v3 } from 'googleapis';
import type { Attendee } from './types.js';

/**
 * Parse attendees from Google Calendar event
 * Transforms Google API schema into type-safe Attendee objects
 *
 * @param attendees Google Calendar API attendees array
 * @returns Parsed attendees array, or undefined if empty/missing
 */
export function parseAttendees(
  attendees: calendar_v3.Schema$EventAttendee[] | undefined
): Attendee[] | undefined {
  if (!attendees || attendees.length === 0) {
    return undefined;
  }

  return attendees.map((attendee) => {
    const parsed: Attendee = {
      email: attendee.email ?? '',
    };

    // Use intermediate variables to help TypeScript narrow types
    const displayName = attendee.displayName;
    if (typeof displayName === 'string') {
      parsed.displayName = displayName;
    }

    const responseStatus = attendee.responseStatus;
    if (
      responseStatus === 'needsAction' ||
      responseStatus === 'declined' ||
      responseStatus === 'tentative' ||
      responseStatus === 'accepted'
    ) {
      parsed.responseStatus = responseStatus;
    }

    if (attendee.organizer === true) {
      parsed.organizer = true;
    } else if (attendee.organizer === false) {
      parsed.organizer = false;
    }

    if (attendee.self === true) {
      parsed.self = true;
    } else if (attendee.self === false) {
      parsed.self = false;
    }

    if (attendee.optional === true) {
      parsed.optional = true;
    } else if (attendee.optional === false) {
      parsed.optional = false;
    }

    return parsed;
  });
}

// STEP 2: Update src/modules/calendar/read.ts
// Remove local parseAttendees function (lines 88-122)
// Add import at top
import { parseAttendees } from './utils.js';

// Usage remains identical (line 246)
const attendees = parseAttendees(response.data.attendees);
if (attendees) {
  result.attendees = attendees;
}

// STEP 3: Update src/modules/calendar/create.ts
// Remove local parseAttendees function (lines 20-61)
// Add import at top
import { parseAttendees, validateEventTimes } from './utils.js';

// Usage remains identical (line 327 in createEvent, line 507 in quickAdd)
const parsedAttendees = parseAttendees(response.data.attendees);
if (parsedAttendees) {
  result.attendees = parsedAttendees;
}

// STEP 4: Update src/modules/calendar/update.ts
// Remove local parseAttendees function (lines 19-60)
// Add import at top
import { parseAttendees, validateEventTimes } from './utils.js';

// Usage remains identical (line 314)
const parsedAttendees = parseAttendees(response.data.attendees);
if (parsedAttendees) {
  result.attendees = parsedAttendees;
}
```

### Complete Extraction Example: buildEventResult

```typescript
// Source: Duplicated pattern in read.ts (lines 164-276), create.ts (lines 244-357),
//         update.ts (lines 232-344), and create.ts quickAdd (lines 425-537)

// STEP 1: Add to src/modules/calendar/utils.ts
import type { calendar_v3 } from 'googleapis';
import type { EventResult } from './types.js';

/**
 * Build EventResult from Google Calendar API response
 * Transforms Google API event schema into type-safe EventResult
 *
 * @param responseData Google Calendar API event object
 * @returns Type-safe EventResult object
 */
export function buildEventResult(
  responseData: calendar_v3.Schema$Event
): EventResult {
  const result: EventResult = {
    eventId: responseData.id!,
  };

  // Only add properties if they exist (exactOptionalPropertyTypes compliance)
  if (responseData.status) {
    result.status = responseData.status;
  }
  if (responseData.htmlLink) {
    result.htmlLink = responseData.htmlLink;
  }
  if (responseData.created) {
    result.created = responseData.created;
  }
  if (responseData.updated) {
    result.updated = responseData.updated;
  }
  if (responseData.summary) {
    result.summary = responseData.summary;
  }
  if (responseData.description) {
    result.description = responseData.description;
  }
  if (responseData.location) {
    result.location = responseData.location;
  }

  // Creator
  if (responseData.creator) {
    result.creator = {};
    if (responseData.creator.email) {
      result.creator.email = responseData.creator.email;
    }
    if (responseData.creator.displayName) {
      result.creator.displayName = responseData.creator.displayName;
    }
  }

  // Organizer
  if (responseData.organizer) {
    result.organizer = {};
    if (responseData.organizer.email) {
      result.organizer.email = responseData.organizer.email;
    }
    if (responseData.organizer.displayName) {
      result.organizer.displayName = responseData.organizer.displayName;
    }
  }

  // Start/End times
  if (responseData.start) {
    result.start = {};
    if (responseData.start.dateTime) {
      result.start.dateTime = responseData.start.dateTime;
    }
    if (responseData.start.date) {
      result.start.date = responseData.start.date;
    }
    if (responseData.start.timeZone) {
      result.start.timeZone = responseData.start.timeZone;
    }
  }

  if (responseData.end) {
    result.end = {};
    if (responseData.end.dateTime) {
      result.end.dateTime = responseData.end.dateTime;
    }
    if (responseData.end.date) {
      result.end.date = responseData.end.date;
    }
    if (responseData.end.timeZone) {
      result.end.timeZone = responseData.end.timeZone;
    }
  }

  // Recurrence
  if (responseData.recurrence && responseData.recurrence.length > 0) {
    result.recurrence = responseData.recurrence;
  }

  // Attendees (uses parseAttendees utility)
  const parsedAttendees = parseAttendees(responseData.attendees);
  if (parsedAttendees) {
    result.attendees = parsedAttendees;
  }

  // Conference data
  if (responseData.conferenceData) {
    result.conferenceData = responseData.conferenceData;
  }

  // Attachments
  if (responseData.attachments && responseData.attachments.length > 0) {
    result.attachments = responseData.attachments.map((att) => ({
      fileId: att.fileId || '',
      fileUrl: att.fileUrl || '',
      title: att.title || '',
    }));
  }

  // Reminders
  if (responseData.reminders) {
    result.reminders = {
      useDefault: responseData.reminders.useDefault || false,
    };
    if (responseData.reminders.overrides && responseData.reminders.overrides.length > 0) {
      result.reminders.overrides = responseData.reminders.overrides.map((override) => ({
        method: override.method || 'popup',
        minutes: override.minutes || 0,
      }));
    }
  }

  return result;
}

// STEP 2: Update src/modules/calendar/read.ts (getEvent function)
// Remove result building code (lines 164-276)
// Replace with:
import { parseAttendees, buildEventResult } from './utils.js';

export async function getEvent(...) {
  // ... params building
  const response = await context.calendar.events.get(params);

  // Build result using utility
  const result = buildEventResult(response.data);

  // Cache, log, return
  await context.cacheManager.set(cacheKey, result);
  context.performanceMonitor.track('calendar:getEvent', Date.now() - context.startTime);
  context.logger.info('Retrieved event', {
    eventId,
    summary: result.summary,
  });

  return result;
}

// STEP 3: Update src/modules/calendar/create.ts (createEvent and quickAdd)
// Remove result building code (lines 244-357 and 425-537)
// Replace with buildEventResult utility call
import { parseAttendees, buildEventResult, validateEventTimes } from './utils.js';

export async function createEvent(...) {
  // ... event creation
  const response = await context.calendar.events.insert(params);

  const result = buildEventResult(response.data);

  // Invalidate caches, log, return
  // ... rest of function
}

export async function quickAdd(...) {
  // ... quick add
  const response = await context.calendar.events.quickAdd(params);

  const result = buildEventResult(response.data);

  // Invalidate caches, log, return
  // ... rest of function
}

// STEP 4: Update src/modules/calendar/update.ts (updateEvent)
// Remove result building code (lines 232-344)
// Replace with buildEventResult utility call
import { parseAttendees, buildEventResult, validateEventTimes } from './utils.js';

export async function updateEvent(...) {
  // ... event update
  const response = await context.calendar.events.patch(params);

  const result = buildEventResult(response.data);

  // Invalidate caches, log, return
  // ... rest of function
}
```

### Verification: encodeToBase64Url (DRY-03)

```typescript
// Source: src/modules/gmail/utils.ts (created in Phase 2)

// VERIFY: Function already exists in gmail/utils.ts
export function encodeToBase64Url(content: string): string {
  return Buffer.from(content)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// VERIFY: compose.ts imports from utils (line 15)
import {
  sanitizeHeaderValue,
  isValidEmailAddress,
  encodeSubject,
  validateAndSanitizeRecipients,
  encodeToBase64Url,  // ✓ Already imported
} from './utils.js';

// VERIFY: send.ts imports from utils (line 18)
import {
  sanitizeHeaderValue,
  isValidEmailAddress,
  encodeSubject,
  validateAndSanitizeRecipients,
  encodeToBase64Url,  // ✓ Already imported
} from './utils.js';

// VERIFY: No local implementations remain
// grep -r "function encodeToBase64Url" src/modules/gmail/
// Expected: Only in utils.ts

// CONCLUSION: DRY-03 is already complete from Phase 2
// No action required for this requirement
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Copy-paste functions | Extract to shared utilities | Modern TypeScript pattern (2020+) | DRY, single source of truth, easier maintenance |
| Manual object building | Type-safe builder functions | TypeScript 4.4+ (exactOptionalPropertyTypes) | Compile-time safety, prevents undefined assignment |
| Ad-hoc testing | Dedicated utility test files | Jest best practices (2022+) | Better isolation, faster test execution |
| Inline implementation | Modular utilities | ES Modules standard (2021+) | Tree-shaking, better code organization |

**Deprecated/outdated:**
- Duplicating utility functions across files
- Using `|| undefined` for optional properties (breaks exactOptionalPropertyTypes)
- Testing only through integration tests (utilities should have unit tests)

## Open Questions

None - all extraction patterns are well-established and proven in Phase 2's gmail/utils.ts implementation.

## Sources

### Primary (HIGH confidence)

- Existing codebase implementation in `src/modules/gmail/utils.ts` (Phase 2) - Proven extraction pattern
- Existing implementations in `src/modules/calendar/read.ts`, `create.ts`, `update.ts` - Source code to extract
- TypeScript configuration `tsconfig.json` - Defines exactOptionalPropertyTypes requirement
- Existing test patterns in `src/modules/gmail/__tests__/utils.test.ts` - Test structure to follow

### Secondary (MEDIUM confidence)

- [TypeScript 4.4 Release Notes - exactOptionalPropertyTypes](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-4.html#exact-optional-property-types) - Official documentation on strict optional handling
- [TypeScript Handbook - Modules](https://www.typescriptlang.org/docs/handbook/modules.html) - ESM import/export patterns
- [Jest ESM Support](https://jestjs.io/docs/ecmascript-modules) - Testing ESM TypeScript modules

### Tertiary (LOW confidence)

None required - this is a straightforward refactoring based on existing codebase patterns.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Uses existing TypeScript/Jest infrastructure from codebase
- Architecture: HIGH - Patterns directly derived from Phase 2's gmail/utils.ts implementation
- Pitfalls: HIGH - Common refactoring pitfalls are well-documented and avoidable

**Research date:** 2026-01-25
**Valid until:** 90 days (stable domain - refactoring patterns don't change frequently)

**Key findings:**
1. `parseAttendees` has three identical implementations across calendar files - direct extraction candidate
2. `buildEventResult` pattern duplicated ~440 lines total across four operations - significant reduction opportunity
3. `encodeToBase64Url` (DRY-03) already extracted in Phase 2 - requirement already satisfied
4. Phase 2's `gmail/utils.ts` provides exact blueprint for calendar utilities extraction
5. TypeScript's `exactOptionalPropertyTypes: true` requires conditional assignment pattern (already used correctly)
6. No new dependencies or infrastructure needed - pure code movement
7. Existing test infrastructure from gmail module can be directly replicated for calendar
