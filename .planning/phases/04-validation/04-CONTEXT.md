# Phase 4: Validation - Context

**Gathered:** 2026-01-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace unsafe non-null assertions (`!`) with proper runtime validation in Gmail and Calendar modules. Ensure all API responses are validated before field access, with clear error messages when validation fails.

Requirements covered: VAL-01 (Gmail assertions), VAL-02 (Calendar assertions), VAL-03 (modifyLabels validation)

</domain>

<decisions>
## Implementation Decisions

### Error Behavior
- Throw descriptive errors on validation failure (not return null)
- Error messages must include contextual operation details (e.g., "getMessage: response.id is undefined for messageId 'abc123'")
- Use standard `Error` class (no custom ValidationError)
- Fail fast on first missing required field (not collect-all-issues)

### Validation Strictness
- Validate all required fields per TypeScript type definitions
- Validation depth: Claude's discretion based on code path
- Validate just before field usage (not at API boundary)
- Array handling is context-dependent:
  - List operations: empty array `[]` is valid, `null/undefined` is error
  - Single-item lookups: `null` valid for "not found" semantics
- Token efficiency consideration: prefer `[]` over throwing errors for empty list results

### modifyLabels Specifics
- Throw error when both addLabelIds and removeLabelIds are empty ("no-op is invalid")
- Pre-validate label IDs with listLabels before API call (better error UX)
- Wrap Gmail API errors with context (e.g., "Message 'abc123' not found")
- Error on duplicate label IDs in add/remove arrays (strict validation)

### Logging & Debugging
- Log all validation errors at `error` level
- Include sanitized excerpts of failed API responses in logs
- Redact all PII (emails, names, addresses, phone numbers) - keep structure and IDs

### Claude's Discretion
- Validation depth for nested objects (shallow vs deep per code path)
- Specific redaction patterns for Gmail vs Calendar data
- Exact error message formatting within contextual guidelines

</decisions>

<specifics>
## Specific Ideas

- Token efficiency research (Anthropic 2025): return `[]` for empty lists is more token-efficient than throwing errors
- Reference: [Code execution with MCP](https://www.anthropic.com/engineering/code-execution-with-mcp) - 98.7% token reduction patterns
- Context-dependent null handling balances API contract clarity with token efficiency

</specifics>

<deferred>
## Deferred Ideas

None - discussion stayed within phase scope

</deferred>

---

*Phase: 04-validation*
*Context gathered: 2026-01-25*
