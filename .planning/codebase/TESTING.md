# Testing Patterns

**Analysis Date:** 2026-01-25

## Test Framework

**Runner:**
- Jest 29.7.0
- Config: `jest.config.js` (ESM preset: `ts-jest/presets/default-esm`)
- TypeScript support via ts-jest with ESM compatibility

**Assertion Library:**
- Jest built-in expect() assertions
- No additional assertion libraries (Chai, Sinon, etc.)

**Run Commands:**
```bash
npm test              # Run all tests
npm run test:watch   # Watch mode
npm run test:coverage # Coverage report
npm run test:integration # Integration tests only
npm run test:e2e     # End-to-end tests only
```

## Test File Organization

**Location:**
- Co-located with source: `src/__tests__/` directory mirrors module structure
- Examples:
  - `src/__tests__/auth/AuthManager.test.ts` tests `src/auth/AuthManager.ts`
  - `src/__tests__/sheets/createSheet.test.ts` tests sheets functionality
  - `src/modules/calendar/__tests__/read.test.ts` tests `src/modules/calendar/read.ts`

**Naming:**
- Pattern: `{filename}.test.ts` for unit tests
- Pattern: `*.benchmark.test.ts` for performance tests (e.g., `KeyDerivation.benchmark.test.ts`)
- No separate spec files; .test.ts is convention

**Structure:**
```
src/
├── __tests__/
│   ├── auth/
│   │   ├── AuthManager.test.ts
│   │   ├── TokenManager.test.ts
│   │   ├── KeyRotationManager.test.ts
│   │   ├── KeyDerivation.test.ts
│   │   └── KeyDerivation.benchmark.test.ts
│   ├── sheets/
│   │   ├── createSheet.test.ts
│   │   ├── advancedFeatures.test.ts
│   │   └── formatCells-helpers.test.ts
│   ├── forms/
│   │   └── addQuestion.test.ts
│   ├── security/
│   │   └── key-security.test.ts
│   ├── integration/
│   │   ├── migration-comprehensive.test.ts
│   │   └── createSheet-integration.test.ts
│   └── performance/
│       └── key-rotation-performance.test.ts
├── modules/
│   └── calendar/
│       └── __tests__/
│           └── read.test.ts
└── ...
```

## Test Structure

**Suite Organization:**
```typescript
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

describe('AuthManager', () => {
  let authManager: AuthManager;

  beforeEach(() => {
    jest.clearAllMocks();
    // Setup fixtures
  });

  afterEach(() => {
    jest.restoreAllMocks();
    // Cleanup
  });

  describe('Initialization', () => {
    it('should initialize with OAuth2Client', async () => {
      // Test implementation
    });
  });
});
```

**Patterns:**
- `describe()` for test suites (nested for logical grouping)
- `it()` for individual test cases
- `beforeEach()` for test setup (runs before each test)
- `afterEach()` for cleanup (runs after each test)
- `beforeAll()` for one-time setup (less common)
- `afterAll()` for one-time cleanup (less common)

## Mocking

**Framework:** Jest mocking built-in
- `jest.mock()` for module mocking at top of file
- `jest.fn()` for function mocks
- `jest.spyOn()` for spy on existing functions

**Patterns:**

Module mocking pattern (`src/__tests__/auth/AuthManager.test.ts`):
```typescript
jest.mock('google-auth-library');
jest.mock('../../auth/TokenManager.js');

const mockOAuth2Client = {
  setCredentials: jest.fn().mockImplementation((credentials: any) => {
    (mockOAuth2Client as any).credentials = credentials;
  }),
  getAccessToken: jest.fn(),
  on: jest.fn().mockReturnValue({} as OAuth2Client),
  credentials: {},
} as unknown as jest.Mocked<OAuth2Client>;

const mockTokenManager = {
  loadTokens: jest.fn(),
  saveTokens: jest.fn(),
  isTokenExpired: jest.fn(),
} as unknown as jest.Mocked<TokenManager>;
```

Context builder pattern (`src/__tests__/sheets/advancedFeatures.test.ts`):
```typescript
const buildContext = () => ({
  sheets: mockSheets,
  cache: mockCache,
  performance: mockPerformance,
  logger: mockLogger,
});
```

Function mocking pattern:
```typescript
const mockFn = jest.fn((arg: string) => {
  return `result: ${arg}`;
});

expect(mockFn).toHaveBeenCalledWith('test');
expect(mockFn.mock.calls.length).toBe(1);
```

Spy pattern:
```typescript
const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(2000);
// Use in test
nowSpy.mockRestore();
```

**What to Mock:**
- External APIs (Google APIs, Redis client)
- File system operations
- Winston logger
- Date.now() for time-dependent tests
- HTTP requests
- Singleton dependencies (TokenManager, AuthManager)

**What NOT to Mock:**
- Business logic functions being tested
- Utility functions (pure functions)
- Error constructors (Error, TypeError)
- Core module behavior you're testing

## Fixtures and Factories

**Test Data:**

Token data fixture (`src/__tests__/auth/AuthManager.test.ts`):
```typescript
const validTokenData: TokenData = {
  access_token: 'test_access_token',
  refresh_token: 'test_refresh_token',
  expiry_date: Date.now() + 3600000, // 1 hour from now
  token_type: 'Bearer',
  scope: 'https://www.googleapis.com/auth/drive',
};
```

OAuth keys fixture:
```typescript
const testOAuthKeys = {
  client_id: 'test_client_id',
  client_secret: 'test_client_secret',
  redirect_uris: ['http://localhost:3000/callback'],
};
```

Mock builders (`src/__tests__/sheets/advancedFeatures.test.ts`):
```typescript
const buildContext = () => ({
  sheets: {
    spreadsheets: {
      get: jest.fn(() => Promise.resolve({ data: { sheets: [...] } })),
      batchUpdate: jest.fn(() => Promise.resolve({})),
    },
  },
  cache: {
    invalidate: jest.fn(() => Promise.resolve(undefined)),
  },
  performance: { track: jest.fn() },
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
});
```

**Location:**
- Fixtures defined in test files directly (no separate fixtures directory)
- Reusable factories as const at top of describe block
- Factory functions for building complex test objects

## Coverage

**Requirements:**
```javascript
// jest.config.js
coverageThreshold: {
  global: {
    branches: 25,    // Branch coverage minimum
    functions: 40,   // Function coverage minimum
    lines: 35,       // Line coverage minimum
    statements: 35,  // Statement coverage minimum
  },
},
```

**View Coverage:**
```bash
npm run test:coverage
# Generates coverage/ directory with HTML report
```

**Coverage Configuration:**
- Collects from: `src/**/*.ts` (excluding test files and types)
- Excludes: `src/**/*.d.ts`, `src/**/__tests__/**`
- Report format: Specified in jest.config.js

## Test Types

**Unit Tests:**
- Test individual functions in isolation
- Mock external dependencies (APIs, file system, loggers)
- Located: `src/__tests__/{module}/{function}.test.ts`
- Example: `src/__tests__/forms/addQuestion.test.ts` (21 test cases)
- Scope: Function behavior, error cases, edge cases

**Integration Tests:**
- Test module interactions (without external APIs)
- Some mocked APIs, but multiple functions working together
- Located: `src/__tests__/integration/`
- Examples:
  - `createSheet-integration.test.ts` - Tests sheet creation flow
  - `migration-comprehensive.test.ts` - Tests token migration process
- Scope: Feature workflows, data flow across modules

**E2E Tests:**
- Test full server scenarios
- Located: `tests/e2e/`
- Example: `auth-persistence.test.ts`
- Note: Requires authentication setup, slower to run
- Run with: `npm run test:e2e`

**Performance Tests:**
- Benchmark-focused tests for critical operations
- Named: `*.benchmark.test.ts`
- Located: `src/__tests__/performance/`
- Example: `key-rotation-performance.test.ts`
- Measures: Duration, iterations, memory usage

## Common Patterns

**Async Testing:**
```typescript
it('should create file successfully', async () => {
  const result = await createFile({
    name: 'test.txt',
    content: 'content',
  }, mockContext);

  expect(result.fileId).toBeDefined();
  expect(mockDrive.files.create).toHaveBeenCalled();
});
```

**Error Testing:**
```typescript
it('should throw error for invalid email', () => {
  expect(() => {
    validateEmail('invalid-email');
  }).toThrow('Invalid email format');
});

it('should handle API errors gracefully', async () => {
  mockSheets.spreadsheets.get.mockRejectedValueOnce(
    new Error('API error')
  );

  await expect(readSheet({...}, context))
    .rejects.toThrow('API error');
});
```

**Mock Assertion Patterns:**
```typescript
expect(mockFn).toHaveBeenCalled();
expect(mockFn).toHaveBeenCalledWith(expectedArg);
expect(mockFn).toHaveBeenCalledTimes(2);
expect(mockFn.mock.calls[0][0]).toBe(expectedFirstArg);
expect(mockLogger.info).toHaveBeenCalledWith('Message', { key: 'value' });
```

**Singleton Reset:**
```typescript
beforeEach(() => {
  // Reset singleton instances
  (AuthManager as any)._instance = undefined;
  (TokenManager as any)._instance = undefined;
});
```

## Test Environment

**Setup file:** `jest.setup.js`
- Runs before all tests
- Mocks Winston logger globally
- Mocks Google APIs globally
- Mocks Redis client globally
- Sets test environment variables:
  - `NODE_ENV=test`
  - `LOG_LEVEL=error` (reduces test output noise)
  - `GDRIVE_TOKEN_ENCRYPTION_KEY` (random key for each test run)
- Global timeout: 10 seconds per test
- Timer cleanup after each test to prevent hanging processes

**Global Helpers:**
```typescript
global.createMockFunction = (implementation) => jest.fn(implementation);

global.mockLogger = () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
});
```

## Best Practices

**Naming:**
- Test names describe behavior: `"should create file successfully"` not `"test createFile"`
- Use "when" for conditional tests: `"should throw when email is invalid"`
- Be specific: `"should invalidate search cache after file creation"` not `"should work"`

**Isolation:**
- Each test should be independent
- Use `beforeEach()` to reset mocks and fixtures
- Avoid test interdependencies
- Clean up in `afterEach()`

**Assertions:**
- One logical assertion per test (but multiple expect() calls OK if related)
- Include context in error messages: `expect(id).toBeDefined()` better than just `expect(result)`
- Assert both success and side effects (e.g., mock calls)

**Mocking Strategy:**
- Mock at module level for global mocks (jest.mock())
- Create mock instances in beforeEach() for per-test mocks
- Clear mocks in beforeEach() with jest.clearAllMocks()
- Restore spies in afterEach() with jest.restoreAllMocks()

**Performance:**
- Test timeout: 10 seconds (per jest.setup.js)
- Async tests: Always await promises
- Benchmark tests: Measure cold and warm performance

## Running Tests

**Commands:**
```bash
npm test                 # All tests once
npm run test:watch     # Watch mode, re-run on changes
npm run test:coverage  # Coverage report
npm run test:integration # Integration tests only
npm run test:e2e       # E2E tests only

# Custom Jest options
npm test -- --testNamePattern="AuthManager"  # Single suite
npm test -- --testPathPattern="auth"         # Single directory
npm test -- --verbose                        # Verbose output
npm test -- --detectOpenHandles             # Find hanging processes
```

---

*Testing analysis: 2026-01-25*
