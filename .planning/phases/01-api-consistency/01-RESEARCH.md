# Phase 1: API Consistency - Research

**Researched:** 2026-01-25
**Domain:** TypeScript API refactoring and parameter naming consistency
**Confidence:** HIGH

## Summary

This research investigates best practices for standardizing parameter naming across TypeScript API modules, specifically for refactoring Gmail and Calendar modules to achieve consistent naming conventions. The phase addresses three specific API inconsistencies documented in specs/bugs.md: Gmail's `modifyLabels` using `messageId` vs `id`, Calendar's `EventResult` returning `id` vs `eventId`, and Calendar's `deleteEvent` returning the wrong type structure.

The standard approach for API consistency refactoring in TypeScript involves: (1) analyzing existing parameter naming patterns across the codebase, (2) choosing the most consistent naming convention based on API documentation and existing patterns, (3) implementing type-safe parameter renames with comprehensive tests, and (4) updating all affected files including type definitions, implementations, and tool documentation.

Key recommendations include using Jest for unit testing parameter changes, implementing tests before code changes (TDD approach), and ensuring manual verification confirms parameter consistency across all operations.

**Primary recommendation:** Use systematic type-driven refactoring with comprehensive unit tests, following the existing test patterns in the codebase (Jest with mock contexts).

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | 5.6.2 | Type system for API contracts | Enables compile-time verification of parameter changes |
| Jest | 29.7.0 | Unit testing framework | Industry standard for TypeScript testing with excellent mock support |
| ts-jest | 29.1.2 | TypeScript preprocessor for Jest | Enables seamless TypeScript testing with ESM support |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @jest/globals | 29.7.0 | Jest types and utilities | For type-safe test writing with TypeScript |
| @types/jest | 29.5.12 | TypeScript definitions for Jest | Provides IntelliSense and type checking in tests |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Jest | Vitest | Vitest is faster and has better ESM support, but Jest is already configured and has better ecosystem support for googleapis mocking |
| Manual testing | Property-based testing (fast-check) | Property-based testing would provide better coverage but adds complexity for simple parameter renaming |

**Installation:**
```bash
# Already installed in package.json
# No additional dependencies needed
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── modules/
│   ├── gmail/
│   │   ├── types.ts          # Type definitions with parameter names
│   │   ├── labels.ts         # Implementation using parameters
│   │   └── __tests__/        # Unit tests (pattern to create)
│   └── calendar/
│       ├── types.ts          # Type definitions
│       ├── delete.ts         # Implementation
│       ├── read.ts           # Implementation
│       ├── create.ts         # Implementation
│       └── __tests__/        # Unit tests (existing)
└── tools/
    └── listTools.ts          # API documentation
```

### Pattern 1: Type-First Parameter Renaming
**What:** Change type definitions first, then implementation, then tests
**When to use:** When parameter name changes need to propagate through multiple files
**Example:**
```typescript
// Step 1: Update type definition
export interface ModifyLabelsOptions {
  id: string;  // Changed from messageId
  addLabelIds?: string[];
  removeLabelIds?: string[];
}

// Step 2: Update implementation
export async function modifyLabels(
  options: ModifyLabelsOptions,
  context: GmailContext
): Promise<ModifyLabelsResult> {
  const { id, addLabelIds, removeLabelIds } = options;  // Changed from messageId

  const response = await context.gmail.users.messages.modify({
    userId: 'me',
    id: id,  // Changed from messageId
    requestBody,
  });

  return {
    id,  // Changed from messageId
    labelIds,
    message: 'Labels modified successfully',
  };
}

// Step 3: Update result type
export interface ModifyLabelsResult {
  id: string;  // Changed from messageId
  labelIds: string[];
  message: string;
}
```

### Pattern 2: Mock Context Testing Pattern
**What:** Use Jest mocks to test API operations without actual Google API calls
**When to use:** For all unit tests of module operations
**Example:**
```typescript
// Source: Existing pattern from src/modules/calendar/__tests__/read.test.ts
import { describe, test, expect, beforeEach, jest } from '@jest/globals';

describe('modifyLabels', () => {
  let mockContext: any;
  let mockGmailApi: any;

  beforeEach(() => {
    mockGmailApi = {
      users: {
        messages: {
          modify: jest.fn(),
        },
      },
    };

    mockContext = {
      logger: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
      },
      gmail: mockGmailApi,
      cacheManager: {
        get: jest.fn(() => Promise.resolve(null)),
        set: jest.fn(() => Promise.resolve(undefined)),
        invalidate: jest.fn(() => Promise.resolve(undefined)),
      },
      performanceMonitor: {
        track: jest.fn(),
      },
      startTime: Date.now(),
    };
  });

  test('uses id parameter consistently', async () => {
    const mockResponse = {
      data: {
        id: 'msg123',
        labelIds: ['INBOX', 'UNREAD'],
      },
    };

    mockGmailApi.users.messages.modify.mockResolvedValue(mockResponse);

    const result = await modifyLabels({
      id: 'msg123',  // Test new parameter name
      addLabelIds: ['STARRED'],
    }, mockContext);

    expect(mockGmailApi.users.messages.modify).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'me',
        id: 'msg123',
      })
    );
    expect(result.id).toBe('msg123');
  });
});
```

### Pattern 3: Comprehensive Test Coverage for Parameter Changes
**What:** Test all code paths affected by parameter rename
**When to use:** For breaking API changes
**Example:**
```typescript
describe('deleteEvent', () => {
  test('returns DeleteEventResult with eventId', async () => {
    const result = await deleteEvent({
      eventId: 'evt123',
      sendUpdates: 'all',
    }, mockContext);

    // Verify correct return type structure
    expect(result).toHaveProperty('eventId');
    expect(result.eventId).toBe('evt123');
    expect(result.message).toBe('Event deleted successfully');

    // Should NOT have 'success' property (old structure)
    expect(result).not.toHaveProperty('success');
  });

  test('invalidates correct cache keys', async () => {
    await deleteEvent({ eventId: 'evt123' }, mockContext);

    expect(mockContext.cacheManager.invalidate).toHaveBeenCalledWith(
      'calendar:getEvent:evt123'
    );
  });
});
```

### Anti-Patterns to Avoid
- **Changing implementation before types:** This breaks TypeScript compilation and makes it harder to track changes
- **Testing only happy path:** Parameter renames affect error cases, cache invalidation, and logging - test all paths
- **Skipping tool documentation updates:** The listTools.ts file is how AI agents discover API signatures - outdated docs cause runtime errors
- **Manual verification only:** Automated tests catch regressions; manual testing alone is insufficient for API changes

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Mocking Google APIs | Custom mock implementations | Jest's `jest.fn()` with type annotations | Google APIs are complex; Jest mocks provide type safety and reset capabilities |
| Test fixtures | Inline test data | beforeEach setup with shared mock context | DRY principle; existing codebase uses this pattern consistently |
| Type validation | Runtime checks | TypeScript's compile-time type checking | Parameter renames are caught at compile time, not runtime |
| Cache invalidation testing | Manual cache clearing | Mock cacheManager with `jest.fn()` spy assertions | Existing pattern verified in calendar/__tests__/read.test.ts |

**Key insight:** The codebase already has robust testing patterns. Reuse the existing mock context pattern rather than creating new test infrastructure.

## Common Pitfalls

### Pitfall 1: Incomplete Parameter Propagation
**What goes wrong:** Changing parameter name in type definition but missing it in destructuring, logging, or error messages
**Why it happens:** TypeScript doesn't catch all uses (e.g., logger calls, string interpolation)
**How to avoid:**
1. Use global search/replace to find all occurrences
2. Run `npm run type-check` after changes
3. Check all logger.info() calls for old parameter names
4. Verify cache key construction uses new names
**Warning signs:**
- Tests pass but logs show undefined values
- Cache invalidation patterns use old parameter names
- Error messages reference non-existent parameters

### Pitfall 2: Breaking Tool Documentation
**What goes wrong:** Update types and implementation but forget to update listTools.ts signatures
**Why it happens:** listTools.ts is not type-checked against actual implementations
**How to avoid:**
1. Add listTools.ts to manual verification checklist
2. Search for function name in listTools.ts
3. Update signature strings to match new parameter names
**Warning signs:**
- AI agents report "parameter not found" errors
- Tool discovery shows outdated signatures
- Manual testing works but programmatic calls fail

### Pitfall 3: Test-Implementation Mismatch
**What goes wrong:** Tests use old parameter names even though implementation changed
**Why it happens:** Tests are written before implementation changes or copy-pasted without updating
**How to avoid:**
1. Update tests immediately after type changes
2. Run `npm test` after each change
3. Use TypeScript strict mode to catch type mismatches
**Warning signs:**
- Tests pass with type assertions but would fail without them
- Mock function calls show different parameter names than implementation
- Coverage drops because old test paths no longer execute

### Pitfall 4: Inconsistent Result Type Changes
**What goes wrong:** Change options parameter name but forget to change result field name (or vice versa)
**Why it happens:** Options and Result types are defined separately
**How to avoid:**
1. Identify all related types (Options, Result, Summary)
2. Change all occurrences of the parameter in all related types
3. Verify consistency: if input uses `eventId`, output should too
**Warning signs:**
- Input uses `eventId` but result has `id` field
- AI agents have to rename fields between chained operations
- Documentation shows inconsistent naming patterns

## Code Examples

Verified patterns from official sources:

### Complete Parameter Rename Flow
```typescript
// Source: Existing codebase patterns from gmail/types.ts and calendar/types.ts

// STEP 1: Update type definitions
// File: src/modules/gmail/types.ts
export interface ModifyLabelsOptions {
  id: string;  // CHANGED: was messageId
  addLabelIds?: string[];
  removeLabelIds?: string[];
}

export interface ModifyLabelsResult {
  id: string;  // CHANGED: was messageId
  labelIds: string[];
  message: string;
}

// STEP 2: Update implementation
// File: src/modules/gmail/labels.ts
export async function modifyLabels(
  options: ModifyLabelsOptions,
  context: GmailContext
): Promise<ModifyLabelsResult> {
  const { id, addLabelIds, removeLabelIds } = options;  // CHANGED: was messageId

  const requestBody: gmail_v1.Schema$ModifyMessageRequest = {};

  if (addLabelIds && addLabelIds.length > 0) {
    requestBody.addLabelIds = addLabelIds;
  }

  if (removeLabelIds && removeLabelIds.length > 0) {
    requestBody.removeLabelIds = removeLabelIds;
  }

  const response = await context.gmail.users.messages.modify({
    userId: 'me',
    id: id,  // CHANGED: was messageId
    requestBody,
  });

  const labelIds = response.data.labelIds || [];

  // CHANGED: cache invalidation uses new parameter name
  await context.cacheManager.invalidate(`gmail:getMessage:${id}`);
  await context.cacheManager.invalidate('gmail:list');

  context.performanceMonitor.track('gmail:modifyLabels', Date.now() - context.startTime);

  // CHANGED: logging uses new parameter name
  context.logger.info('Modified labels', {
    id,  // CHANGED: was messageId
    added: addLabelIds?.length || 0,
    removed: removeLabelIds?.length || 0,
  });

  return {
    id,  // CHANGED: was messageId
    labelIds,
    message: 'Labels modified successfully',
  };
}

// STEP 3: Update tool documentation
// File: src/tools/listTools.ts
{
  name: 'modifyLabels',
  signature: 'modifyLabels({ id: string, addLabelIds?: string[], removeLabelIds?: string[] })',  // CHANGED: was messageId
  description: 'Modify labels on a message (add or remove)',
  example: `const result = await modifyLabels({
  id: '18c123abc',  // CHANGED: was messageId
  removeLabelIds: ['UNREAD', 'INBOX'],
}, context);`,
}
```

### Complete Unit Test for Parameter Rename
```typescript
// Source: Pattern from src/modules/calendar/__tests__/read.test.ts
// File: src/modules/gmail/__tests__/labels.test.ts (to be created)

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { modifyLabels } from '../labels.js';

describe('modifyLabels', () => {
  let mockContext: any;
  let mockGmailApi: any;

  beforeEach(() => {
    mockGmailApi = {
      users: {
        messages: {
          modify: jest.fn(),
        },
      },
    };

    mockContext = {
      logger: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
      },
      gmail: mockGmailApi,
      cacheManager: {
        get: jest.fn(() => Promise.resolve(null)),
        set: jest.fn(() => Promise.resolve(undefined)),
        invalidate: jest.fn(() => Promise.resolve(undefined)),
      },
      performanceMonitor: {
        track: jest.fn(),
      },
      startTime: Date.now(),
    };
  });

  test('modifies labels with id parameter', async () => {
    const mockResponse = {
      data: {
        id: 'msg123',
        labelIds: ['INBOX', 'STARRED'],
      },
    };

    mockGmailApi.users.messages.modify.mockResolvedValue(mockResponse);

    const result = await modifyLabels({
      id: 'msg123',
      addLabelIds: ['STARRED'],
    }, mockContext);

    expect(mockGmailApi.users.messages.modify).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'me',
        id: 'msg123',
        requestBody: {
          addLabelIds: ['STARRED'],
        },
      })
    );

    expect(result.id).toBe('msg123');
    expect(result.labelIds).toEqual(['INBOX', 'STARRED']);
  });

  test('invalidates cache with correct message id', async () => {
    const mockResponse = {
      data: {
        id: 'msg456',
        labelIds: ['INBOX'],
      },
    };

    mockGmailApi.users.messages.modify.mockResolvedValue(mockResponse);

    await modifyLabels({
      id: 'msg456',
      removeLabelIds: ['UNREAD'],
    }, mockContext);

    expect(mockContext.cacheManager.invalidate).toHaveBeenCalledWith('gmail:getMessage:msg456');
    expect(mockContext.cacheManager.invalidate).toHaveBeenCalledWith('gmail:list');
  });

  test('logs with id parameter', async () => {
    const mockResponse = {
      data: {
        id: 'msg789',
        labelIds: ['INBOX', 'IMPORTANT'],
      },
    };

    mockGmailApi.users.messages.modify.mockResolvedValue(mockResponse);

    await modifyLabels({
      id: 'msg789',
      addLabelIds: ['IMPORTANT'],
      removeLabelIds: ['UNREAD'],
    }, mockContext);

    expect(mockContext.logger.info).toHaveBeenCalledWith(
      'Modified labels',
      expect.objectContaining({
        id: 'msg789',
        added: 1,
        removed: 1,
      })
    );
  });

  test('tracks performance', async () => {
    const mockResponse = {
      data: {
        id: 'msg999',
        labelIds: ['INBOX'],
      },
    };

    mockGmailApi.users.messages.modify.mockResolvedValue(mockResponse);

    await modifyLabels({
      id: 'msg999',
      addLabelIds: ['STARRED'],
    }, mockContext);

    expect(mockContext.performanceMonitor.track).toHaveBeenCalledWith(
      'gmail:modifyLabels',
      expect.any(Number)
    );
  });
});
```

### Type-Safe DeleteEventResult Fix
```typescript
// Source: Fixing Issue #3 from specs/bugs.md
// File: src/modules/calendar/delete.ts

export async function deleteEvent(
  options: DeleteEventOptions,
  context: CalendarContext
): Promise<DeleteEventResult> {  // CHANGED: was Promise<{ success: boolean; message: string }>
  const {
    calendarId = 'primary',
    eventId,
    sendUpdates = 'none',
  } = options;

  const params: calendar_v3.Params$Resource$Events$Delete = {
    calendarId,
    eventId,
    sendUpdates,
  };

  await context.calendar.events.delete(params);

  // Invalidate caches
  const cacheKeys = [
    `calendar:getEvent:${eventId}`,
    `calendar:listEvents:${calendarId}:*`,
  ];
  for (const pattern of cacheKeys) {
    await context.cacheManager.invalidate(pattern);
  }

  context.performanceMonitor.track('calendar:deleteEvent', Date.now() - context.startTime);
  context.logger.info('Deleted calendar event', {
    calendarId,
    eventId,
    sendUpdates,
  });

  return {
    eventId,  // CHANGED: was { success: true, message: '...' }
    message: 'Event deleted successfully',
  };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Inconsistent parameter naming across operations | Consistent parameter naming matching Google API conventions | Issue identified 2026-01-23 | AI agents can predict parameter names based on operation type |
| `messageId` in modifyLabels | `id` in all Gmail single-resource operations | Phase 1 target | Matches getMessage/getThread pattern |
| `EventResult.id` | `EventResult.eventId` | Phase 1 target | Matches input parameter naming |
| `{ success, message }` return from deleteEvent | `DeleteEventResult` type with `eventId` | Phase 1 target | Type consistency with other operations |

**Deprecated/outdated:**
- Using different parameter names for the same concept (messageId vs id) across a module
- Returning ad-hoc object structures instead of defined Result types
- Mismatched input/output parameter naming (input: eventId, output: id)

## Open Questions

1. **Should we version the API during this refactor?**
   - What we know: This is a breaking change for existing code using messageId
   - What's unclear: Whether external consumers exist beyond Claude Code agents
   - Recommendation: Since this is an MCP server (not a published library), proceed with breaking change but document it in CHANGELOG

2. **Should listTools.ts be type-checked?**
   - What we know: listTools.ts contains hardcoded strings that can drift from actual signatures
   - What's unclear: Whether we can/should generate it from types automatically
   - Recommendation: Manual verification sufficient for Phase 1; consider automated generation in future tech debt phase

3. **Do we need integration tests for parameter changes?**
   - What we know: Unit tests verify the code structure is correct
   - What's unclear: Whether integration tests against real Google APIs would catch additional issues
   - Recommendation: Unit tests sufficient for parameter renames; manual verification covers integration concerns

## Sources

### Primary (HIGH confidence)
- Codebase analysis - /Users/aojdevstudio/MCP-Servers/gdrive/src/modules/gmail/types.ts (lines 83, 126, 301)
- Codebase analysis - /Users/aojdevstudio/MCP-Servers/gdrive/src/modules/gmail/labels.ts (implementation patterns)
- Codebase analysis - /Users/aojdevstudio/MCP-Servers/gdrive/src/modules/calendar/types.ts (lines 102-104, 131, 263-268, 273-277, 282-285)
- Codebase analysis - /Users/aojdevstudio/MCP-Servers/gdrive/src/modules/calendar/delete.ts (line 48 return type)
- Codebase analysis - /Users/aojdevstudio/MCP-Servers/gdrive/specs/bugs.md (Issues #1, #2, #3)
- Existing test patterns - /Users/aojdevstudio/MCP-Servers/gdrive/src/modules/calendar/__tests__/read.test.ts
- Project configuration - /Users/aojdevstudio/MCP-Servers/gdrive/jest.config.js
- Project configuration - /Users/aojdevstudio/MCP-Servers/gdrive/package.json (Jest 29.7.0, ts-jest 29.1.2)

### Secondary (MEDIUM confidence)
- [Google TypeScript Style Guide](https://google.github.io/styleguide/tsguide.html) - Parameter naming conventions
- [TypeScript Style Guide (ts.dev)](https://ts.dev/style/) - Official TypeScript style recommendations
- [Google AIP-190: Naming conventions](https://google.aip.dev/190) - API parameter naming consistency
- [REST API Naming Conventions Best Practices](https://www.moesif.com/blog/technical/api-development/The-Ultimate-Guide-to-REST-API-Naming-Convention/) - Consistency importance
- [API Design Best Practices 2026](https://eluminoustechnologies.com/blog/api-design/) - Modern API consistency patterns

### Tertiary (LOW confidence)
- [Jest 30 Breaking Changes](https://jestjs.io/docs/upgrading-to-jest30) - TypeScript type improvements (using Jest 29, not directly applicable)
- WebSearch results on TypeScript parameter naming - General best practices, not specific to this codebase

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Jest and TypeScript versions verified in package.json
- Architecture: HIGH - Test patterns verified in existing codebase files
- Pitfalls: HIGH - Derived from actual bugs documented in specs/bugs.md and codebase analysis

**Research date:** 2026-01-25
**Valid until:** 2026-02-25 (30 days - stable domain with well-established practices)
