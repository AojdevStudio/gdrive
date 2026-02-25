# Phase 2: Security Fixes - Research

**Researched:** 2026-01-25
**Domain:** Input validation, injection prevention, security hardening
**Confidence:** HIGH

## Summary

Phase 2 addresses two HIGH-priority security vulnerabilities in the gdrive MCP server:

1. **SEC-01**: Google Drive search query injection vulnerability - User input containing single quotes is directly interpolated into Drive API queries without escaping, potentially breaking query structure or causing unexpected behavior.

2. **SEC-02**: Gmail `compose.ts` missing security validation - The draft creation function lacks the comprehensive validation, sanitization, and encoding present in `send.ts`, creating an inconsistency where malformed drafts can be created but fail when sent.

The research confirms that both issues follow well-established security patterns with standardized solutions. Google's official documentation provides clear escaping requirements, and the codebase already implements proper email security validation in `send.ts` that can be extracted and reused.

**Primary recommendation:** Fix Drive query escaping using backslash escaping per Google's official documentation, and extract existing security functions from `send.ts` into a shared `gmail/utils.ts` module used by both compose and send operations.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js Buffer | Built-in | String to Buffer conversion for base64url encoding | Native Node.js crypto module for email encoding |
| TypeScript | 5.x | Type safety for validation functions | Provides compile-time type checking for security functions |
| Jest | 30.x | Security testing framework | Current testing standard in 2026, improved TypeScript support |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @jest/globals | Latest | Test imports for ESM modules | Required for ESM TypeScript test files |
| ts-jest | Latest | TypeScript Jest transform | Required for running TypeScript tests with ESM |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Manual escaping | Parameterized queries | Google Drive API uses query language, not SQL - no parameterization available |
| Third-party validation | Built-in validation | Email validation is already implemented in codebase, extraction is simpler than adding dependency |
| Zod validation | Custom validation | Zod adds dependency overhead; existing validation is sufficient for current needs |

**Installation:**
No new dependencies required - all functionality uses existing Node.js built-ins and testing infrastructure.

## Architecture Patterns

### Recommended Project Structure
```
src/modules/
├── drive/
│   └── search.ts               # Query escaping
├── gmail/
│   ├── utils.ts                # NEW: Shared validation utilities
│   ├── compose.ts              # Uses utils
│   └── send.ts                 # Uses utils
└── __tests__/
    ├── drive/
    │   └── search.test.ts      # NEW: Injection tests
    └── gmail/
        ├── utils.test.ts       # NEW: Validation tests
        └── compose.test.ts     # Enhanced security tests
```

### Pattern 1: Query String Escaping

**What:** Escape special characters in user input before interpolation into query strings
**When to use:** Any time user input is inserted into Google Drive API query language strings

**Example:**
```typescript
// Source: Google Drive API official documentation
// https://developers.google.com/workspace/drive/api/guides/ref-search-terms

function escapeQueryValue(value: string): string {
  // Google Drive API requires backslash escaping for single quotes
  // Example: "John's Document" becomes "John\'s Document"
  return value.replace(/'/g, "\\'");
}

// Usage in search.ts
const escapedQuery = escapeQueryValue(query);
const q = `name contains '${escapedQuery}' and trashed = false`;
```

### Pattern 2: Shared Validation Utilities

**What:** Extract security validation functions into shared utility module
**When to use:** When multiple modules need the same validation logic (DRY principle)

**Example:**
```typescript
// Source: Existing implementation in src/modules/gmail/send.ts

// src/modules/gmail/utils.ts
export function sanitizeHeaderValue(value: string): string {
  // Remove CR/LF to prevent header injection
  return value.replace(/[\r\n]/g, '');
}

export function isValidEmailAddress(email: string): boolean {
  const match = email.match(/<([^>]+)>/) || [null, email];
  const address = match[1]?.trim() || email.trim();
  const pattern = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  return pattern.test(address);
}

export function encodeSubject(subject: string): string {
  const hasNonAscii = [...subject].some(char => char.charCodeAt(0) > 127);
  if (!hasNonAscii) return sanitizeHeaderValue(subject);
  const encoded = Buffer.from(subject, 'utf-8').toString('base64');
  return `=?UTF-8?B?${encoded}?=`;
}

export function validateAndSanitizeRecipients(
  emails: string[],
  fieldName: string
): string[] {
  return emails.map(email => {
    const sanitized = sanitizeHeaderValue(email);
    if (!isValidEmailAddress(sanitized)) {
      throw new Error(`Invalid email address in ${fieldName}: ${sanitized}`);
    }
    return sanitized;
  });
}

export function encodeToBase64Url(content: string): string {
  return Buffer.from(content)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}
```

### Pattern 3: Security Test Coverage

**What:** Comprehensive test cases covering attack vectors and edge cases
**When to use:** For all security-sensitive input validation and sanitization

**Example:**
```typescript
// Source: Existing pattern from src/__tests__/security/key-security.test.ts

describe('Drive Search Query Injection', () => {
  test('escapes single quotes in search queries', async () => {
    const result = await search({
      query: "John's Document"
    }, context);

    // Should not break query structure
    expect(result.totalResults).toBeGreaterThanOrEqual(0);
  });

  test('handles multiple single quotes', async () => {
    const result = await search({
      query: "It's O'Brien's file"
    }, context);

    expect(result.totalResults).toBeGreaterThanOrEqual(0);
  });

  test('prevents query structure manipulation', async () => {
    // Attack vector: try to inject additional query terms
    const maliciousQuery = "test' or name contains '";

    const result = await search({
      query: maliciousQuery
    }, context);

    // Should escape and treat entire string as literal search
    expect(result.query).toContain("\\'");
  });
});
```

### Anti-Patterns to Avoid

- **Direct string interpolation without escaping:** Always escape user input before inserting into query strings
- **Inconsistent security validation:** Don't have some functions validate while others don't - extract to shared utilities
- **Skipping security tests:** Security fixes without tests are incomplete and may regress

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Email validation regex | Custom regex from scratch | RFC 5322 compliant pattern (already in codebase) | RFC 5322 email validation is complex with many edge cases (quoted strings, comments, etc.) |
| Base64URL encoding | Custom base64 conversion | Buffer with replace operations (already in codebase) | Standard approach, handles character encoding properly |
| CRLF sanitization | Manual character removal | Established `replace(/[\r\n]/g, '')` pattern | Header injection is a known attack - use proven solution |
| Query escaping | Custom escape logic | Google's documented backslash escaping | Google Drive API has specific escaping requirements |

**Key insight:** Security validation is well-trodden ground. The codebase already has correct implementations in `send.ts` - extraction and reuse is safer than reimplementation.

## Common Pitfalls

### Pitfall 1: Incomplete Escaping

**What goes wrong:** Only escaping some special characters or only in some code paths
**Why it happens:** Developer focuses on obvious case (single quote) but misses other contexts or code paths
**How to avoid:**
- Centralize escaping logic in one function
- Test multiple special character combinations
- Apply consistently in all code paths that build queries
**Warning signs:**
- Search works for most queries but fails with certain characters
- Inconsistent behavior between similar functions

### Pitfall 2: Validation-Bypass Through Alternative Code Paths

**What goes wrong:** Validation exists in `sendMessage` but `createDraft` bypasses it, allowing invalid drafts to be created
**Why it happens:** Code duplication leads to inconsistent validation - one path gets updated, others don't
**How to avoid:**
- Extract validation to shared utilities
- Both code paths import and use the same validation functions
- Add tests for both code paths
**Warning signs:**
- "Works in production but tests fail" - indicates bypass path
- Users report "draft created but won't send"

### Pitfall 3: Over-Escaping or Double-Escaping

**What goes wrong:** Escaping already-escaped strings, leading to literal backslashes in output
**Why it happens:** Defensive programming gone wrong - escaping at multiple layers
**How to avoid:**
- Escape once at the point of use (query construction)
- Don't pre-escape data in storage or intermediate layers
- Document where escaping happens
**Warning signs:**
- Search results show literal backslashes
- Query strings have `\\'` instead of `\'`

### Pitfall 4: Testing Happy Paths Only

**What goes wrong:** Tests pass with normal input but security vulnerabilities remain
**Why it happens:** Developers test expected usage, not attack scenarios
**How to avoid:**
- Include malicious input test cases
- Test edge cases (empty strings, very long strings, special characters)
- Test the "attacker mindset" scenarios
**Warning signs:**
- High test coverage but security issues slip through
- No tests with special characters or injection attempts

## Code Examples

Verified patterns from official sources and existing codebase:

### Google Drive Query Escaping

```typescript
// Source: https://developers.google.com/workspace/drive/api/guides/ref-search-terms
// Official Google documentation states: "Escape single quotes in queries with \'"

/**
 * Escape special characters for Google Drive query language
 * @param value User input to escape
 * @returns Escaped string safe for query interpolation
 */
function escapeQueryValue(value: string): string {
  // Single quotes are the only character requiring escaping in Drive queries
  // Other characters (backslash, quotes in field values) are handled by API
  return value.replace(/'/g, "\\'");
}

// Usage in search operation
export async function search(
  options: SearchOptions,
  context: DriveContext
): Promise<SearchResult> {
  const { query, pageSize = 10 } = options;

  // Escape query before interpolation
  const escapedQuery = escapeQueryValue(query);

  const response = await context.drive.files.list({
    q: `name contains '${escapedQuery}' and trashed = false`,
    pageSize: Math.min(pageSize, 100),
    fields: "files(id, name, mimeType, createdTime, modifiedTime, webViewLink)",
  });

  // ... rest of implementation
}
```

### Gmail Validation Extraction

```typescript
// Source: Existing implementation in src/modules/gmail/send.ts (lines 18-68)

// Extract to src/modules/gmail/utils.ts
/**
 * Sanitize header field value by stripping CR/LF to prevent header injection
 */
export function sanitizeHeaderValue(value: string): string {
  return value.replace(/[\r\n]/g, '');
}

/**
 * Simple RFC 5322-like email address validation
 */
export function isValidEmailAddress(email: string): boolean {
  const match = email.match(/<([^>]+)>/) || [null, email];
  const address = match[1]?.trim() || email.trim();
  const emailPattern = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  return emailPattern.test(address);
}

/**
 * Encode subject using RFC 2047 MIME encoded-word for non-ASCII characters
 */
export function encodeSubject(subject: string): string {
  const hasNonAscii = [...subject].some(char => char.charCodeAt(0) > 127);
  if (!hasNonAscii) {
    return sanitizeHeaderValue(subject);
  }
  const encoded = Buffer.from(subject, 'utf-8').toString('base64');
  return `=?UTF-8?B?${encoded}?=`;
}

/**
 * Validate and sanitize email addresses
 */
export function validateAndSanitizeRecipients(
  emails: string[],
  fieldName: string
): string[] {
  return emails.map(email => {
    const sanitized = sanitizeHeaderValue(email);
    if (!isValidEmailAddress(sanitized)) {
      throw new Error(`Invalid email address in ${fieldName}: ${sanitized}`);
    }
    return sanitized;
  });
}

/**
 * Encode message to base64url format for Gmail API
 */
export function encodeToBase64Url(content: string): string {
  return Buffer.from(content)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// Usage in compose.ts (update buildEmailMessage function)
function buildEmailMessage(options: CreateDraftOptions): string {
  const { to, cc, bcc, subject, body, isHtml = false, from, inReplyTo, references } = options;

  const lines: string[] = [];

  // Add headers with sanitization and validation
  if (from) {
    const sanitizedFrom = sanitizeHeaderValue(from);
    if (!isValidEmailAddress(sanitizedFrom)) {
      throw new Error(`Invalid from email address: ${sanitizedFrom}`);
    }
    lines.push(`From: ${sanitizedFrom}`);
  }

  // Validate and sanitize recipients
  const sanitizedTo = validateAndSanitizeRecipients(to, 'to');
  lines.push(`To: ${sanitizedTo.join(', ')}`);

  if (cc && cc.length > 0) {
    const sanitizedCc = validateAndSanitizeRecipients(cc, 'cc');
    lines.push(`Cc: ${sanitizedCc.join(', ')}`);
  }

  // Encode subject with RFC 2047
  lines.push(`Subject: ${encodeSubject(subject)}`);

  if (inReplyTo) {
    lines.push(`In-Reply-To: ${sanitizeHeaderValue(inReplyTo)}`);
  }
  if (references) {
    lines.push(`References: ${sanitizeHeaderValue(references)}`);
  }

  lines.push('MIME-Version: 1.0');
  lines.push(`Content-Type: ${isHtml ? 'text/html' : 'text/plain'}; charset="UTF-8"`);
  lines.push('');
  lines.push(body);

  return lines.join('\r\n');
}
```

### Security Test Patterns

```typescript
// Source: Existing pattern from src/__tests__/security/key-security.test.ts
// and security testing best practices

describe('Drive Search Security', () => {
  test('escapes single quotes to prevent query injection', async () => {
    const testQuery = "John's Document";
    const result = await search({ query: testQuery }, mockContext);

    // Should escape the quote
    expect(mockContext.drive.files.list).toHaveBeenCalledWith(
      expect.objectContaining({
        q: "name contains 'John\\'s Document' and trashed = false"
      })
    );
  });

  test('handles multiple single quotes', async () => {
    const testQuery = "It's O'Brien's file";
    const result = await search({ query: testQuery }, mockContext);

    expect(mockContext.drive.files.list).toHaveBeenCalledWith(
      expect.objectContaining({
        q: "name contains 'It\\'s O\\'Brien\\'s file' and trashed = false"
      })
    );
  });

  test('prevents query structure manipulation', async () => {
    const maliciousQuery = "test' or name contains '";
    const result = await search({ query: maliciousQuery }, mockContext);

    // Should escape both quotes, treating as literal search
    expect(mockContext.drive.files.list).toHaveBeenCalledWith(
      expect.objectContaining({
        q: "name contains 'test\\' or name contains \\'' and trashed = false"
      })
    );
  });
});

describe('Gmail Compose Security', () => {
  test('validates email addresses', async () => {
    await expect(createDraft({
      to: ['invalid-email'],
      subject: 'Test',
      body: 'Test body'
    }, mockContext)).rejects.toThrow('Invalid email address');
  });

  test('sanitizes CRLF in headers', async () => {
    const maliciousSubject = "Test\r\nBcc: attacker@evil.com";

    const result = await createDraft({
      to: ['user@example.com'],
      subject: maliciousSubject,
      body: 'Body'
    }, mockContext);

    // Subject should have CRLF removed
    const sentMessage = mockContext.gmail.users.drafts.create.mock.calls[0][0];
    const decoded = Buffer.from(sentMessage.requestBody.message.raw, 'base64').toString();
    expect(decoded).not.toContain('\r\n\r\n'); // No header injection
    expect(decoded).toContain('TestBcc: attacker@evil.com'); // CRLF removed
  });

  test('encodes non-ASCII subjects with RFC 2047', async () => {
    const unicodeSubject = "Café ☕ Meeting";

    await createDraft({
      to: ['user@example.com'],
      subject: unicodeSubject,
      body: 'Body'
    }, mockContext);

    const sentMessage = mockContext.gmail.users.drafts.create.mock.calls[0][0];
    const decoded = Buffer.from(sentMessage.requestBody.message.raw, 'base64').toString();
    expect(decoded).toContain('=?UTF-8?B?'); // RFC 2047 encoding
  });
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual regex validation | RFC 5322 compliant patterns with helper libraries | 2020+ | More accurate email validation, fewer false positives/negatives |
| Simple string replacement | Dedicated sanitization functions with security focus | 2021+ | Clearer intent, easier to audit, prevents bypass |
| Inline validation | Extracted utility modules | Modern TypeScript pattern | DRY, consistency, testability |
| Test-after-deployment | Security-first testing with attack scenarios | DevSecOps 2024+ | Catch vulnerabilities before production |

**Deprecated/outdated:**
- Overly permissive email regex that allows invalid addresses
- Direct string concatenation without escaping in query builders
- Duplicate validation code across modules

## Open Questions

None - all questions resolved through research.

## Sources

### Primary (HIGH confidence)

- [Google Drive API - Search query terms and operators](https://developers.google.com/workspace/drive/api/guides/ref-search-terms) - Official documentation on query escaping
- Existing codebase implementation in `src/modules/gmail/send.ts` - Proven security validation pattern
- Existing security test pattern in `src/__tests__/security/key-security.test.ts` - Established testing approach
- `specs/bugs.md` - Project-specific security issues (Issues #4 and #5)

### Secondary (MEDIUM confidence)

- [Imperva - CRLF Injection](https://www.imperva.com/learn/application-security/crlf-injection/) - CRLF injection prevention techniques
- [Snyk - Avoiding SMTP Injection](https://snyk.io/blog/avoiding-smtp-injection/) - Email security best practices
- [DMARC Report - RFC 5322 Email Security](https://dmarcreport.com/blog/rfc-5322-email-security-specifications-for-sender-policy-framework/) - Email validation standards
- [Rootstrap - Jest Security Testing](https://www.rootstrap.com/blog/how-to-use-jest-to-test-security-vulnerabilities-on-apis-part-1) - Security testing patterns with Jest
- [StackHawk - TypeScript SQL Injection Guide](https://www.stackhawk.com/blog/typescript-sql-injection-guide-examples-and-prevention/) - Injection testing patterns

### Tertiary (LOW confidence)

- [CVE-2026-23829](https://radar.offseq.com/threat/cve-2026-23829-cwe-93-improper-neutralization-of-c-0f5c2e2b) - Recent CRLF injection in Mailpit (demonstrates ongoing relevance)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Uses existing Node.js built-ins and established Jest testing
- Architecture: HIGH - Patterns derived from official Google docs and existing codebase
- Pitfalls: HIGH - Well-known injection vulnerabilities with established solutions

**Research date:** 2026-01-25
**Valid until:** 60 days (stable domain - injection prevention patterns don't change frequently)

**Key findings:**
1. Google Drive API requires backslash escaping for single quotes - officially documented
2. Gmail validation already correctly implemented in `send.ts` - extraction needed, not reimplementation
3. Existing security test infrastructure in place - can follow established patterns
4. No new dependencies required - all solutions use existing capabilities
5. Both fixes are well-understood security patterns with clear implementations
