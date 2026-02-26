# Testing Patterns

**Analysis Date:** 2026-02-25

## Test Framework

**Runner:**
- Jest 29 with `ts-jest` ESM preset
- Config: `jest.config.js`

**Assertion Library:**
- Jest built-in `expect` assertions (`@jest/globals` imports in test files)

**Run Commands:**
```bash
npm test                 # Run all tests
npm run test:watch       # Watch mode
npm run test:coverage    # Coverage report
npm run test:integration # Integration subset
npm run test:e2e         # E2E subset
```

## Test File Organization

**Location:**
- Separate test tree under `src/__tests__/`
- Module-local tests under `src/modules/**/__tests__/`
- Additional E2E tests under `tests/e2e/`

**Naming:**
- `*.test.ts` naming across all suites

**Structure:**
```
src/__tests__/<domain>/*.test.ts
src/modules/<service>/__tests__/*.test.ts
tests/e2e/*.test.ts
```

## Test Structure

**Suite Organization:**
```typescript
describe('feature', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('behavior', async () => {
    await expect(fn(input, mockContext)).resolves.toBeDefined();
  });
});
```

**Patterns:**
- Setup in `beforeEach` with mock clients/context objects
- Validation failures tested with `rejects.toThrow(...)`
- Positive-path assertions validate payload shape and side effects

## Mocking

**Framework:** Jest mocks (`jest.fn`, manual stubs, and typed casts)

**Patterns:**
```typescript
const mockContext = {
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
  cacheManager: { get: jest.fn(), set: jest.fn(), invalidate: jest.fn() },
  performanceMonitor: { track: jest.fn() },
};
```

**What to Mock:**
- Google API clients (`google.sheets`, `calendar.freebusy.query`, `gmail.users.*`)
- Cache manager and performance monitor dependencies
- Logger side effects

**What NOT to Mock:**
- Local validation logic and transformation behavior under test (for example email validation and range parsing)

## Fixtures and Factories

**Test Data:**
```typescript
const mockResponse = {
  data: { id: 'id-123', threadId: 'thread-123' },
};
```

**Location:**
- Inline fixtures per suite are common
- Some auth/security tests use temp filesystem paths and environment setup in `src/__tests__/auth/*.test.ts`

## Coverage

**Requirements:**
- Global thresholds in `jest.config.js`:
- Branches: 25%
- Functions: 40%
- Lines: 35%
- Statements: 35%

**View Coverage:**
```bash
npm run test:coverage
```

## Test Types

**Unit Tests:**
- Operation-level behavior and validation in `src/modules/**/__tests__/`

**Integration Tests:**
- End-to-end logic with mocked API interactions in `src/__tests__/integration/`

**E2E Tests:**
- CLI/auth persistence smoke path in `tests/e2e/auth-persistence.test.ts`

## Common Patterns

**Async Testing:**
```typescript
await expect(operation(args, context)).rejects.toThrow('message');
```

**Error Testing:**
```typescript
mockApi.method.mockRejectedValue(new Error('api failure'));
await expect(call()).rejects.toThrow('api failure');
```

---

*Testing analysis: 2026-02-25*
