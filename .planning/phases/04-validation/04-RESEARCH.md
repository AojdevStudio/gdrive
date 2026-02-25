# Phase 4: Validation - Research

**Researched:** 2026-01-26
**Domain:** Runtime validation in TypeScript with Google APIs
**Confidence:** HIGH

## Summary

This phase focuses on replacing unsafe non-null assertions (`!`) with proper runtime validation in Gmail and Calendar modules. The research reveals that the TypeScript community in 2025-2026 strongly emphasizes runtime validation for external API data, with clear patterns for validation without external libraries.

The codebase uses TypeScript's strict mode (`strict: true`, `exactOptionalPropertyTypes: true`, `noUncheckedIndexedAccess: true`) which provides excellent compile-time safety, but API responses require runtime validation since TypeScript cannot guarantee external data shapes. The key insight is that non-null assertions bypass TypeScript's type system, creating runtime risk when API responses don't match expectations.

**Primary recommendation:** Implement inline validation helpers (type guards and assertion functions) that validate data just before usage, throw descriptive errors with contextual information, and integrate with the existing Winston logging infrastructure for error tracking. This approach aligns with the user's decision to avoid validation libraries and use native TypeScript patterns.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | 5.6.2 | Type system with strict mode | Already in use; provides compile-time safety and advanced narrowing |
| Node.js | 22.0.0+ | Runtime environment | Already in use; ES2022 target |
| Winston | 3.17.0 | Structured logging | Already in use for logging validation errors |
| Jest | 29.7.0 | Testing framework | Already in use for unit tests |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| googleapis | 144.0.0 | Google API types | Already in use; provides TypeScript definitions for API responses |
| @types/node | 22 | Node.js type definitions | Already in use for Buffer, Error types |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Inline validation | Zod | User decision: no libraries, keep it lightweight. Zod adds 57KB bundle size and learning curve |
| Inline validation | io-ts | User decision: no libraries. io-ts requires functional programming patterns |
| Standard Error | Custom ValidationError | User decision: use standard Error class for simplicity |
| Inline validation | AJV / Yup | Runtime schema validators add dependencies and complexity |

**Installation:**
No new packages required - use existing TypeScript and standard library features.

## Architecture Patterns

### Recommended Project Structure
```
src/
├── modules/
│   ├── gmail/
│   │   ├── utils.ts          # Existing: security validation
│   │   ├── validation.ts     # NEW: runtime validation helpers
│   │   ├── read.ts           # Update: replace ! with validation
│   │   ├── labels.ts         # Update: replace ! with validation
│   │   └── list.ts           # Update: replace ! with validation
│   └── calendar/
│       ├── validation.ts     # NEW: runtime validation helpers
│       ├── freebusy.ts       # Update: replace ! with validation
│       └── list.ts           # Update: replace ! with validation
```

### Pattern 1: Type Guard Functions
**What:** Boolean predicates that narrow types through control flow analysis
**When to use:** When checking optional fields or discriminating union types
**Example:**
```typescript
// Type guard with narrowing
function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

// Usage - TypeScript knows the type after check
if (isDefined(response.data.id)) {
  const id: string = response.data.id; // No assertion needed
}
```

### Pattern 2: Assertion Functions
**What:** Functions that throw on validation failure, using `asserts` keyword
**When to use:** For required fields that must exist or execution cannot continue
**Example:**
```typescript
// Assertion function with contextual error
function assertDefined<T>(
  value: T | null | undefined,
  fieldName: string,
  context: string
): asserts value is T {
  if (value === null || value === undefined) {
    throw new Error(`${context}: ${fieldName} is ${value === null ? 'null' : 'undefined'}`);
  }
}

// Usage - throws descriptive error on failure
const response = await gmail.users.messages.get({ id: '123' });
assertDefined(response.data.id, 'response.id', `getMessage(messageId='123')`);
// TypeScript knows response.data.id is defined after assertion
```

### Pattern 3: Validation with Default Values
**What:** Nullish coalescing for safe defaults on optional fields
**When to use:** When empty arrays or default values are acceptable
**Example:**
```typescript
// Safe array handling (no assertion needed)
const labelIds = response.data.labelIds ?? [];
const messages = response.data.messages ?? [];

// Safe string defaults
const snippet = response.data.snippet ?? '';
const historyId = response.data.historyId ?? '';
```

### Pattern 4: Field Validation at Point of Use
**What:** Validate fields just before they're accessed, not at API boundary
**When to use:** Following user decision for validation location
**Example:**
```typescript
// Validate when parsing, not when receiving API response
function parseMessage(message: gmail_v1.Schema$Message): MessageResult {
  // Validate required fields before use
  assertDefined(message.id, 'message.id', 'parseMessage');
  assertDefined(message.threadId, 'message.threadId', 'parseMessage');

  return {
    id: message.id,              // Now safe - TypeScript knows it's defined
    threadId: message.threadId,  // Now safe - TypeScript knows it's defined
    labelIds: message.labelIds ?? [],  // Default for optional array
    // ...
  };
}
```

### Anti-Patterns to Avoid
- **Using `any` type:** Bypasses all type safety. Use `unknown` and narrow instead
- **Non-null assertion (`!`):** Bypasses runtime validation. Use assertion functions instead
- **Type assertions (`as`):** Tells TypeScript to trust without checking. Use type guards
- **Collecting all validation errors:** User decided "fail fast" - throw on first error
- **Validating at API boundary:** User decided to validate "just before field usage"
- **Silent failures:** Always throw errors with context, never return null on validation failure
- **Over-validation:** Don't validate nested objects deeply unless accessed (Claude's discretion)

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Email validation | Custom regex | Existing `isValidEmailAddress` in utils.ts | Already tested, RFC 5322 compliant |
| PII redaction | Custom string replace | Regex patterns + Winston formatter | Proven patterns, consistent across logs |
| Base64 encoding | Custom implementation | Buffer.from + toString | Node.js built-in, handles edge cases |
| Array validation | Custom isEmpty checks | Nullish coalescing `?? []` | TypeScript-aware, token efficient |

**Key insight:** The codebase already has validation utilities (gmail/utils.ts) that should be the pattern. Build similar lightweight helpers, don't introduce heavy frameworks.

## Common Pitfalls

### Pitfall 1: Over-trusting TypeScript Types for External Data
**What goes wrong:** TypeScript types for Google API responses are generated from specs, but actual API responses may have missing fields due to partial responses, API changes, or errors.
**Why it happens:** TypeScript is a compile-time tool - it cannot validate runtime data. Non-null assertions (`!`) tell TypeScript "trust me, this exists" but provide no runtime safety.
**How to avoid:** Always validate external API data with runtime checks using assertion functions or type guards.
**Warning signs:**
- Production errors: "Cannot read property 'id' of undefined"
- Non-null assertions (`!`) on API response fields
- Type assertions (`as Type`) without validation

### Pitfall 2: Incorrect Null/Undefined Semantics
**What goes wrong:** Treating `null` and `undefined` differently when both mean "missing data" for API responses, or vice versa.
**Why it happens:** JavaScript has both `null` and `undefined`, and Google APIs may return either. TypeScript's `strictNullChecks` treats them as distinct types.
**How to avoid:** Use unified checks: `value == null` checks both null and undefined. Use nullish coalescing `??` for defaults (only triggers on null/undefined, not empty string/0).
**Warning signs:**
- Checking only `=== null` or only `=== undefined`
- Using `||` for defaults (incorrectly treats 0 and "" as missing)
- Type errors with `exactOptionalPropertyTypes: true` when using `undefined` explicitly

### Pitfall 3: Array Validation Edge Cases
**What goes wrong:** Not handling `null`, `undefined`, or empty arrays consistently. Token waste throwing errors for empty lists.
**Why it happens:** Google APIs may return `null`, `undefined`, or `[]` for missing array data. Different endpoints have different semantics.
**How to avoid:** Follow user decision: empty array `[]` is valid for list operations, `null/undefined` is error. For token efficiency, prefer returning `[]` over throwing errors for empty results.
**Warning signs:**
- Throwing errors on empty arrays in list operations
- Not checking for null/undefined before accessing array methods
- Inconsistent handling across similar operations

### Pitfall 4: Poor Error Messages
**What goes wrong:** Generic errors like "Validation failed" or "Missing required field" without context.
**Why it happens:** Validation logic doesn't capture operation context or input parameters.
**How to avoid:** Always include operation name and input identifiers in error messages: `"getMessage: response.id is undefined for messageId 'abc123'"`
**Warning signs:**
- Error messages without operation context
- Missing input parameters in error details
- Logs that don't identify which API call failed

### Pitfall 5: Logging PII in Validation Errors
**What goes wrong:** Error logs expose email addresses, names, phone numbers in API response excerpts.
**Why it happens:** Validation errors include raw API responses for debugging, which contain PII.
**How to avoid:** Implement Winston formatter to redact PII before logging. Keep structure and IDs, redact personal data.
**Warning signs:**
- Email addresses visible in logs
- User names in error messages
- Phone numbers or addresses in log files

### Pitfall 6: Performance Impact of Validation
**What goes wrong:** Deep validation of nested objects on every access causes performance degradation.
**Why it happens:** Over-zealous validation without considering hot paths or frequency.
**How to avoid:** Validate at appropriate depth (Claude's discretion). Required fields always validated; nested objects validated only when accessed. Cache validation results where appropriate.
**Warning signs:**
- Validation taking >10% of operation time
- Repeated validation of same object
- Deep recursive validation of unchanged data

## Code Examples

Verified patterns from TypeScript official documentation and established practices:

### Type Guard Example
```typescript
// Source: TypeScript Handbook - Narrowing
// https://www.typescriptlang.org/docs/handbook/2/narrowing.html

function isNonEmptyArray<T>(value: T[] | null | undefined): value is T[] {
  return Array.isArray(value) && value.length > 0;
}

// Usage
const messages = response.data.messages;
if (isNonEmptyArray(messages)) {
  // TypeScript knows messages is T[] here
  messages.forEach(msg => console.log(msg.id));
}
```

### Assertion Function Example
```typescript
// Source: TypeScript Handbook - Assertion Functions
// https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-7.html#assertion-functions

function assertString(
  value: unknown,
  fieldName: string,
  context: string
): asserts value is string {
  if (typeof value !== 'string') {
    throw new Error(
      `${context}: ${fieldName} must be a string, got ${typeof value}`
    );
  }
}

// Usage with Google API
const response = await calendar.events.get({ calendarId: 'primary', eventId: '123' });
assertString(response.data.id, 'event.id', 'getEvent');
// TypeScript now knows response.data.id is string
const eventId: string = response.data.id;
```

### Nullish Coalescing for Safe Defaults
```typescript
// Source: TypeScript 3.7+ - Nullish Coalescing
// https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-7.html#nullish-coalescing

// Safe array handling - prefer [] over throwing
const labelIds = response.data.labelIds ?? [];
const attendees = event.attendees ?? [];

// Safe string defaults
const snippet = message.snippet ?? '';
const description = event.description ?? '';

// Careful: || would incorrectly trigger on 0 or ''
// ✅ Correct: ?? only triggers on null/undefined
const count = response.data.resultSizeEstimate ?? 0;

// ❌ Wrong: || triggers on 0
// const count = response.data.resultSizeEstimate || 0;
```

### Combined Pattern: Required Field Assertion
```typescript
// Validation helper for required string fields
function assertRequiredString(
  value: string | null | undefined,
  fieldName: string,
  operationName: string,
  ...contextArgs: Array<[string, string]>
): asserts value is string {
  if (value == null) {
    const context = contextArgs
      .map(([key, val]) => `${key}='${val}'`)
      .join(', ');
    throw new Error(
      `${operationName}: ${fieldName} is ${value === null ? 'null' : 'undefined'}${
        context ? ` for ${context}` : ''
      }`
    );
  }
}

// Usage in getMessage
const response = await gmail.users.messages.get({ userId: 'me', id: messageId });
assertRequiredString(
  response.data.id,
  'response.id',
  'getMessage',
  ['messageId', messageId]
);
// Error would be: "getMessage: response.id is undefined for messageId='abc123'"
```

### PII Redaction Pattern
```typescript
// Source: Community best practices for Winston
// https://betterstack.com/community/guides/logging/sensitive-data/

// Winston format for PII redaction
import { format } from 'winston';

const redactPII = format((info) => {
  // Redact email addresses
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
  const stringified = JSON.stringify(info);
  const redacted = stringified.replace(emailRegex, '[EMAIL_REDACTED]');
  return JSON.parse(redacted);
});

// Add to Winston logger
const logger = winston.createLogger({
  format: format.combine(
    redactPII(),
    format.json()
  ),
  // ...
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Non-null assertion (`!`) | Assertion functions with `asserts` keyword | TypeScript 3.7 (2019) | Explicit validation at compile time + runtime safety |
| `any` type for external data | `unknown` with type guards | TypeScript 3.0 (2018) | Forces validation before use |
| Manual null checks everywhere | Nullish coalescing `??` and optional chaining `?.` | TypeScript 3.7 (2019) | Cleaner code, fewer bugs |
| Type assertions `as Type` | Type guards with `is` predicates | TypeScript 1.6+ | Runtime safety + compile-time narrowing |
| Runtime validation libraries | Native TypeScript patterns | Trend in 2025 | Lighter bundle, no dependencies, better integration |

**Deprecated/outdated:**
- `@ts-ignore` and `@ts-expect-error` for validation: Use proper type guards instead
- Checking `typeof value === 'object'` for null: In JavaScript, `typeof null === 'object'` (use `== null` check)
- Using `||` for default values: Use `??` to avoid incorrectly treating `0` or `''` as missing

## Open Questions

Things that couldn't be fully resolved:

1. **Specific redaction patterns for Gmail vs Calendar**
   - What we know: Email addresses should be redacted; Winston can use custom formatters
   - What's unclear: Exact regex patterns for Calendar attendee names, phone numbers in event descriptions
   - Recommendation: Start with email regex, expand based on actual log review (Claude's discretion per user decision)

2. **Optimal validation depth for nested objects**
   - What we know: User wants validation "just before field usage," not at API boundary; shallow validation preferred
   - What's unclear: When accessing nested structures like `message.payload.headers[0].value`, how deep to validate?
   - Recommendation: Validate the path to the field being accessed (e.g., check headers array exists, then check header.value), but don't validate sibling fields (Claude's discretion per user decision)

3. **modifyLabels label ID validation with listLabels**
   - What we know: User wants pre-validation of label IDs by checking against listLabels results
   - What's unclear: Should validation cache listLabels results? Performance impact of calling listLabels on every modifyLabels?
   - Recommendation: Call listLabels (which is already cached), check IDs against result. Acceptable performance since cache hit is fast.

## Sources

### Primary (HIGH confidence)
- [TypeScript Official Documentation - Narrowing](https://www.typescriptlang.org/docs/handbook/2/narrowing.html) - Type guards and narrowing
- [TypeScript 3.7 Release Notes - Assertion Functions](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-7.html#assertion-functions) - Assertion function patterns
- [Better Stack - Node.js Logging Best Practices](https://betterstack.com/community/guides/logging/nodejs-logging-best-practices/) - Logging security
- [Better Stack - TypeScript Type Guards](https://betterstack.com/community/guides/scaling-nodejs/typescript-type-guards/) - Type guard patterns
- [Better Stack - Optional Properties and Null Handling](https://betterstack.com/community/guides/scaling-nodejs/typescript-optional-properties/) - Null/undefined semantics

### Secondary (MEDIUM confidence)
- [smoleycodes - Using TypeScript type guards to validate API responses](https://smoleycodes.com/blog/validating-api-responses/) - API validation patterns (2025)
- [DEV Community - Type Guards in TypeScript 2025](https://dev.to/paulthedev/type-guards-in-typescript-2025-next-level-type-safety-for-ai-era-developers-6me) - Modern type guard practices
- [Better Stack - Best Logging Practices for Safeguarding Sensitive Data](https://betterstack.com/community/guides/logging/sensitive-data/) - PII redaction strategies
- [Medium - Masking of Sensitive Data in Logs](https://medium.com/@jaiprajapati3/masking-of-sensitive-data-in-logs-700850e233f5) - Winston PII masking
- [ceos3c - TypeScript Assertion Functions Complete Guide](https://www.ceos3c.com/typescript/typescript-assertion-functions-complete-guide-to/) - Assertion function best practices

### Tertiary (LOW confidence)
- [GitHub Issue - winstonjs/winston #2116](https://github.com/winstonjs/winston/issues/2116) - Community discussion on PII redaction in Winston
- [Medium - Fatal TypeScript Patterns](https://medium.com/@sohail_saifi/the-fatal-typescript-patterns-that-make-senior-developers-question-your-experience-8d7f10a3be42) - Anti-patterns to avoid
- [Treblle - REST API Error Handling](https://treblle.com/blog/rest-api-error-handling) - API error best practices

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Using existing dependencies, well-established TypeScript patterns
- Architecture: HIGH - TypeScript official patterns from documentation, widely adopted in 2025
- Pitfalls: MEDIUM-HIGH - Based on official docs + community experience, specific to Google API context

**Research date:** 2026-01-26
**Valid until:** 2026-04-26 (90 days - TypeScript/validation patterns are stable)
