# Phase 5: Caching - Research

**Researched:** 2026-02-20
**Domain:** In-process caching with existing CacheManagerLike interface in TypeScript
**Confidence:** HIGH

## Summary

This phase addresses two caching gaps discovered in the codebase: (1) the Forms `readForm` function does not use the cache at all, while every other read operation in Gmail, Calendar, Drive, and Sheets does; and (2) the Calendar `getEvent` cache key omits `calendarId`, creating a cache collision risk when the same `eventId` exists in multiple calendars.

Both fixes are purely mechanical: no new libraries, no new abstractions, no schema changes. The `CacheManagerLike` interface is already defined in `src/modules/types.ts` and available on `FormsContext` via `BaseContext`. The fix for `readForm` is a straightforward add of the cache check/set/track/log block matching the Gmail and Calendar patterns verbatim. The fix for `getEvent` is a one-line change to the cache key string.

The mutation counterpart for Forms (`addQuestion`) must also invalidate the form cache after a successful `batchUpdate`, matching how Calendar `update.ts` and `delete.ts` invalidate `getEvent` caches when events change. Without this, `readForm` would return stale question lists after questions are added.

**Primary recommendation:** Copy the established caching pattern from `src/modules/gmail/read.ts` (getMessage) directly into `src/modules/forms/read.ts`, fix the `getEvent` cache key to `calendar:getEvent:${calendarId}:${eventId}`, add cache invalidation to `addQuestion`, and update the existing `getEvent` test to assert the corrected cache key format.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CACHE-01 | Forms module implements caching consistent with other modules | CacheManagerLike is already on FormsContext (via BaseContext). Gmail getMessage pattern is the direct template. addQuestion must invalidate form caches post-mutation. |
| CACHE-02 | Calendar `getEvent` cache key includes `calendarId` | Current key `calendar:getEvent:${eventId}` omits calendarId. Fix to `calendar:getEvent:${calendarId}:${eventId}`. Existing test at read.test.ts line 383 asserts `stringContaining('calendar:getEvent:event1')` — test must be updated to assert the full key format. |
</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | 5.6.2 | Type system | Already in use; `CacheManagerLike` is typed |
| Jest | 29.7.0 | Test framework | Already in use; all module tests use Jest |

### Supporting

No new packages required. The `CacheManagerLike` interface is already defined and injected via context.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Existing CacheManagerLike | node-cache, lru-cache | No — user decision is to use the codebase's existing abstraction, not add new caching libraries |
| Module-level cache key prefix | Flat key namespace | No — existing convention is `module:operation:params` (e.g., `gmail:getMessage:${id}:${format}`) |

**Installation:**
```bash
# No new packages required
```

## Architecture Patterns

### Recommended Project Structure

No structural changes. The affected files are:
```
src/
└── modules/
    ├── forms/
    │   ├── read.ts        # CACHE-01: add cache check/set/track/log
    │   └── questions.ts   # CACHE-01: add cache invalidate after addQuestion
    └── calendar/
        └── read.ts        # CACHE-02: fix getEvent cache key to include calendarId
```

### Pattern 1: Read-Through Cache (existing project pattern)

**What:** Check cache before API call; set cache after successful API call; track performance; log result.
**When to use:** All read operations that are deterministic given their inputs (not paginated lists with opaque page tokens as cache keys).
**Example (from `src/modules/gmail/read.ts` getMessage — direct template for readForm):**

```typescript
// Check cache first
const cacheKey = `gmail:getMessage:${id}:${format}`;
const cached = await context.cacheManager.get(cacheKey);
if (cached) {
  context.performanceMonitor.track('gmail:getMessage', Date.now() - context.startTime);
  return cached as MessageResult;
}

// ... build params, call API, build result ...

// Cache the result
await context.cacheManager.set(cacheKey, result);
context.performanceMonitor.track('gmail:getMessage', Date.now() - context.startTime);
context.logger.info('Retrieved message', { id, subject: result.headers.subject });

return result;
```

**Applied to readForm:**
```typescript
// Check cache first
const cacheKey = `forms:readForm:${formId}`;
const cached = await context.cacheManager.get(cacheKey);
if (cached) {
  context.performanceMonitor.track('forms:read', Date.now() - context.startTime);
  return cached as ReadFormResult;
}

// ... existing API call and result building ...

// Cache the result
await context.cacheManager.set(cacheKey, result);
context.performanceMonitor.track('forms:read', Date.now() - context.startTime);
context.logger.info('Retrieved form', { formId, title: result.title });

return result;
```

Note: The existing `readForm` already calls `context.performanceMonitor.track('forms:read', ...)` at the end. The cache-miss path replaces that single call; the cache-hit path adds a new early-return call.

### Pattern 2: Mutation Cache Invalidation (existing project pattern)

**What:** After a mutation succeeds, invalidate the cache for the affected resource.
**When to use:** Any write/mutation operation that modifies data that is cached by a read operation.
**Example (from `src/modules/calendar/delete.ts`):**

```typescript
// Invalidate caches for this event and list caches
const cacheKeys = [
  `calendar:getEvent:${eventId}`,
  `calendar:listEvents:${calendarId}:*`,
];
for (const pattern of cacheKeys) {
  await context.cacheManager.invalidate(pattern);
}
```

**Applied to addQuestion (questions.ts):**

```typescript
// Invalidate form cache after mutation
await context.cacheManager.invalidate(`forms:readForm:${formId}`);
```

`addQuestion` adds items to the form — any cached `readForm` result for that `formId` is now stale. The invalidation pattern is a simple exact-key invalidate (no glob needed because `readForm` key is `forms:readForm:${formId}` — no sub-keys).

### Pattern 3: Cache Key with calendarId (CACHE-02 fix)

**What:** Include all scoping parameters in the cache key to prevent cross-resource collisions.
**When to use:** Whenever a resource ID is not globally unique — event IDs in Google Calendar are scoped per-calendar.
**Current (broken):**
```typescript
const cacheKey = `calendar:getEvent:${eventId}`;
```
**Fixed:**
```typescript
const cacheKey = `calendar:getEvent:${calendarId}:${eventId}`;
```

This mirrors how `listEvents` already includes `calendarId` as a separate segment:
```typescript
// From src/modules/calendar/list.ts
const cacheKey = `calendar:listEvents:${calendarId}:${JSON.stringify({...})}`;
```

The fix also requires updating the invalidation keys in `update.ts` and `delete.ts` to match the new format:
```typescript
// In calendar/update.ts and calendar/delete.ts — currently:
`calendar:getEvent:${eventId}`

// Must become:
`calendar:getEvent:${calendarId}:${eventId}`
```

**Critically:** Existing test in `src/modules/calendar/__tests__/read.test.ts` at line 383 asserts:
```typescript
expect(mockContext.cacheManager.set).toHaveBeenCalledWith(
  expect.stringContaining('calendar:getEvent:event1'),
  ...
)
```
This test passes today with the broken key. After the fix, the key becomes `calendar:getEvent:primary:event1` (since calendarId defaults to `'primary'`). The test assertion must be updated to match.

### Anti-Patterns to Avoid

- **Skipping cache invalidation in addQuestion:** If `readForm` is cached but `addQuestion` does not invalidate, callers get stale question lists. This is the most likely correctness bug to miss.
- **Using only eventId in getEvent cache key:** The existing bug — same eventId can exist in different calendars. Always include the scoping resource (calendarId) in the key.
- **Not updating invalidation sites:** Fixing the cache key in `read.ts` without fixing the invalidation keys in `update.ts` and `delete.ts` means invalidation misses (old key no longer matches new key format).
- **Caching list operations with mutable keys:** `listResponses` in `responses.ts` should NOT be cached without a TTL discussion — form responses are frequently submitted and a stale list cache would be misleading. This phase scopes only to `readForm` (form metadata/questions, not responses).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cache storage | Custom Map/object | `context.cacheManager` | Already injected, handles Redis fallback and TTL |
| Cache key design | Custom hash | String interpolation matching existing pattern | Readable, debuggable, consistent with codebase |
| Cache invalidation | Custom tracking set | `cacheManager.invalidate(pattern)` | Already implemented in CacheManagerLike interface |
| Test mocks | Custom spy objects | Jest `jest.fn()` matching existing test patterns | Read.test.ts and list.test.ts show the exact mock shape needed |

**Key insight:** Zero new infrastructure required. The entire implementation is applying existing patterns to the two affected files.

## Common Pitfalls

### Pitfall 1: Forgetting to Update Invalidation Sites After Cache Key Change

**What goes wrong:** `getEvent` cache key changes from `calendar:getEvent:${eventId}` to `calendar:getEvent:${calendarId}:${eventId}`, but `update.ts` and `delete.ts` still try to invalidate the old key pattern. Cached stale events survive mutations.
**Why it happens:** Cache key used in multiple places; easy to update only the write site.
**How to avoid:** Grep for all occurrences of `calendar:getEvent:` before and after the change.
**Warning signs:** Tests for update/delete pass but stale cache data returned after mutation in integration.

### Pitfall 2: readForm's Existing performanceMonitor.track Call

**What goes wrong:** The current `readForm` has a single `performanceMonitor.track('forms:read', ...)` call at the end (line 73). When adding caching, the cache-hit early return path also needs a `track` call — otherwise cache hits are not measured.
**Why it happens:** The cache-miss path retains the existing track call, but the new early-return path needs its own.
**How to avoid:** Follow the Gmail `getMessage` pattern exactly — both the cache-hit branch and the post-set line call `performanceMonitor.track`.

### Pitfall 3: Caching listResponses

**What goes wrong:** Developer caches `listResponses` alongside `readForm` as part of "Forms module caching."
**Why it happens:** CACHE-01 says "Forms module implements caching" — could be read as all Forms operations.
**How to avoid:** Scope CACHE-01 to `readForm` only. Form responses are end-user submissions and change frequently. The decision in the phase context explicitly identifies `src/modules/forms/read.ts` as the target file.

### Pitfall 4: Test Assertion Still Uses Old Cache Key Format

**What goes wrong:** After fixing `getEvent` cache key, existing test at line 383 of `read.test.ts` still passes because `stringContaining('calendar:getEvent:event1')` matches both old and new key. The bug goes undetected in future.
**Why it happens:** `expect.stringContaining` is a partial match — the old assertion string is a substring of the new key.
**How to avoid:** Update the test to assert the exact key or use `stringContaining('calendar:getEvent:primary:event1')` so it distinguishes old from new format.

### Pitfall 5: calendarId Default Value in Cache Key

**What goes wrong:** `getEvent` uses `const { calendarId = 'primary', eventId } = options;` — the cache key must use the resolved value (after default), not the raw options value. Otherwise a call with explicit `calendarId: 'primary'` and a call with omitted `calendarId` produce different cache keys for the same resource.
**Why it happens:** Using `options.calendarId` in the key instead of the destructured `calendarId` variable.
**How to avoid:** Use the destructured variable in the cache key: `calendar:getEvent:${calendarId}:${eventId}` where `calendarId` is already defaulted to `'primary'`.

## Code Examples

### readForm with Caching (complete implementation)

```typescript
// src/modules/forms/read.ts
export async function readForm(
  options: ReadFormOptions,
  context: FormsContext
): Promise<ReadFormResult> {
  const { formId } = options;

  // Check cache first
  const cacheKey = `forms:readForm:${formId}`;
  const cached = await context.cacheManager.get(cacheKey);
  if (cached) {
    context.performanceMonitor.track('forms:read', Date.now() - context.startTime);
    return cached as ReadFormResult;
  }

  const response = await context.forms.forms.get({
    formId,
  });

  const questions: FormQuestion[] = response.data.items?.map((item, index) => ({
    itemId: item.itemId || undefined,
    index,
    title: item.title || undefined,
    description: item.description || undefined,
    type: item.questionItem?.question ? Object.keys(item.questionItem.question)[0] : 'unknown',
    required: Boolean(item.questionItem && 'required' in item.questionItem && item.questionItem.required),
  })) ?? [];

  const result: ReadFormResult = {
    formId: response.data.formId || undefined,
    title: response.data.info?.title || undefined,
    description: response.data.info?.description || undefined,
    publishedUrl: response.data.responderUri || undefined,
    editUrl: `https://docs.google.com/forms/d/${formId}/edit`,
    questions,
  };

  // Cache the result
  await context.cacheManager.set(cacheKey, result);
  context.performanceMonitor.track('forms:read', Date.now() - context.startTime);
  context.logger.info('Retrieved form', { formId, title: result.title });

  return result;
}
```

### addQuestion cache invalidation (addition to questions.ts)

```typescript
// After the batchUpdate call in addQuestion:
await context.cacheManager.invalidate(`forms:readForm:${formId}`);

context.performanceMonitor.track('forms:addQuestion', Date.now() - context.startTime);
context.logger.info('Question added to form', { formId, type, title });
```

### getEvent cache key fix (calendar/read.ts)

```typescript
// Current (line 114):
const cacheKey = `calendar:getEvent:${eventId}`;

// Fixed:
const cacheKey = `calendar:getEvent:${calendarId}:${eventId}`;
```

### Invalidation sites to update (calendar/update.ts and calendar/delete.ts)

```typescript
// Currently in both update.ts and delete.ts:
const cacheKeys = [
  `calendar:getEvent:${eventId}`,
  `calendar:listEvents:${calendarId}:*`,
];

// Must become:
const cacheKeys = [
  `calendar:getEvent:${calendarId}:${eventId}`,
  `calendar:listEvents:${calendarId}:*`,
];
```

### Test for readForm caching (new test file)

```typescript
// src/__tests__/forms/read.test.ts
import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { readForm } from '../../../modules/forms/read.js';

describe('readForm', () => {
  let mockContext: any;
  let mockFormsApi: any;

  beforeEach(() => {
    mockFormsApi = {
      forms: {
        get: jest.fn(),
      },
    };

    mockContext = {
      logger: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
      },
      forms: mockFormsApi,
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

  test('returns cached result without calling API', async () => {
    const cachedResult = {
      formId: 'form123',
      title: 'Cached Form',
      questions: [],
      editUrl: 'https://docs.google.com/forms/d/form123/edit',
    };
    mockContext.cacheManager.get = jest.fn(() => Promise.resolve(cachedResult));

    const result = await readForm({ formId: 'form123' }, mockContext);

    expect(result).toEqual(cachedResult);
    expect(mockFormsApi.forms.get).not.toHaveBeenCalled();
    expect(mockContext.performanceMonitor.track).toHaveBeenCalledWith(
      'forms:read',
      expect.any(Number)
    );
  });

  test('caches result after API call', async () => {
    mockFormsApi.forms.get.mockResolvedValue({
      data: {
        formId: 'form123',
        info: { title: 'My Form' },
        items: [],
      },
    });

    await readForm({ formId: 'form123' }, mockContext);

    expect(mockContext.cacheManager.set).toHaveBeenCalledWith(
      'forms:readForm:form123',
      expect.objectContaining({ formId: 'form123' })
    );
  });

  test('checks cache with correct key', async () => {
    mockFormsApi.forms.get.mockResolvedValue({
      data: { formId: 'form456', info: { title: 'Another Form' }, items: [] },
    });

    await readForm({ formId: 'form456' }, mockContext);

    expect(mockContext.cacheManager.get).toHaveBeenCalledWith('forms:readForm:form456');
  });

  test('tracks performance on cache hit', async () => {
    mockContext.cacheManager.get = jest.fn(() => Promise.resolve({ formId: 'f1', questions: [], editUrl: '' }));

    await readForm({ formId: 'f1' }, mockContext);

    expect(mockContext.performanceMonitor.track).toHaveBeenCalledWith('forms:read', expect.any(Number));
  });

  test('tracks performance and logs on cache miss', async () => {
    mockFormsApi.forms.get.mockResolvedValue({
      data: { formId: 'form789', info: { title: 'Logged Form' }, items: [] },
    });

    await readForm({ formId: 'form789' }, mockContext);

    expect(mockContext.performanceMonitor.track).toHaveBeenCalledWith('forms:read', expect.any(Number));
    expect(mockContext.logger.info).toHaveBeenCalledWith(
      'Retrieved form',
      expect.objectContaining({ formId: 'form789' })
    );
  });
});
```

### Updated getEvent cache key test assertion

```typescript
// In src/modules/calendar/__tests__/read.test.ts
// Update line 383 from:
expect(mockContext.cacheManager.set).toHaveBeenCalledWith(
  expect.stringContaining('calendar:getEvent:event1'),
  ...
)
// To:
expect(mockContext.cacheManager.set).toHaveBeenCalledWith(
  'calendar:getEvent:primary:event1',  // calendarId defaults to 'primary'
  expect.objectContaining({ eventId: 'event1', summary: 'Event 1' })
);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Omit calendarId from event cache key | Include all scoping parameters in key | N/A (existing bug) | Prevents silent cache collisions across calendars |
| No caching in Forms readForm | Read-through cache matching Gmail/Calendar pattern | This phase | Consistent performance; forms metadata fetched once per TTL |

**Deprecated/outdated:**
- N/A — this phase has no library changes, only applying existing patterns.

## Open Questions

1. **TTL for forms:readForm cache**
   - What we know: Other operations use `cacheManager.set(key, value)` with no explicit TTL argument — the TTL is configured in the CacheManagerLike implementation (either Redis TTL or in-memory default).
   - What's unclear: Whether forms metadata changes frequently enough to need a shorter TTL.
   - Recommendation: Use the same `cacheManager.set(key, result)` call with no TTL override — the cache manager's default is appropriate. The `addQuestion` invalidation handles the active mutation path.

2. **Should listResponses be cached?**
   - What we know: `responses.ts` (`listResponses`) has no caching. Form responses are end-user submissions, not structural metadata.
   - What's unclear: Whether the phase intent is to cache responses as well.
   - Recommendation: Explicitly out of scope for this phase. CACHE-01 targets `src/modules/forms/read.ts` as specified in the phase description. Caching responses requires a TTL discussion not present in requirements.

3. **Do addQuestion invalidation patterns need wildcards?**
   - What we know: The `readForm` cache key is `forms:readForm:${formId}` — a single key per form, no sub-keys.
   - What's unclear: Whether future additions could create sub-keys under this prefix.
   - Recommendation: Use exact-key invalidation (`forms:readForm:${formId}`) rather than a wildcard pattern. This matches how `modifyLabels` in Gmail invalidates `gmail:getMessage:${id}` (exact, no wildcard).

## Sources

### Primary (HIGH confidence)

- `src/modules/gmail/read.ts` — Direct template for cache-hit early return + cache-set pattern (verified by reading file)
- `src/modules/calendar/read.ts` — Second reference implementation for both getCalendar and (buggy) getEvent (verified by reading file)
- `src/modules/calendar/list.ts` — Shows `calendarId` already included in `listEvents` cache key (verified by reading file)
- `src/modules/calendar/update.ts` — Shows mutation invalidation pattern (verified by reading file)
- `src/modules/calendar/delete.ts` — Shows mutation invalidation pattern (verified by reading file)
- `src/modules/calendar/__tests__/read.test.ts` — Shows existing test assertions for cache behavior (verified by reading file)
- `src/modules/types.ts` — Confirms `CacheManagerLike` is on `BaseContext` (hence on `FormsContext`) (verified by reading file)
- `src/modules/forms/read.ts` — Confirms no caching currently present (verified by reading file)
- `src/modules/forms/questions.ts` — Confirms no cache invalidation currently present (verified by reading file)
- `.planning/REQUIREMENTS.md` — Confirms CACHE-01 and CACHE-02 scope and status (verified by reading file)

### Secondary (MEDIUM confidence)

- `src/modules/gmail/labels.ts` — Additional reference for mutation invalidation with exact key pattern (modifyLabels invalidates getMessage cache)
- `.planning/codebase/CONVENTIONS.md` — Confirms context injection pattern and logging conventions

### Tertiary (LOW confidence)

- N/A — all claims verified from codebase source files directly.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new libraries, existing interface in codebase
- Architecture: HIGH — exact pattern copy from two verified reference implementations
- Pitfalls: HIGH — identified from direct code reading, not speculation

**Research date:** 2026-02-20
**Valid until:** 2026-05-20 (90 days — patterns are stable, no external dependencies)
