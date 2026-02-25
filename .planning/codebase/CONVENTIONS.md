# Coding Conventions

**Analysis Date:** 2026-01-25

## Naming Patterns

**Files:**
- kebab-case for filenames: `sheets-handler.ts`, `drive-schemas.ts`, `conditional-formatting.ts`
- Index files: `index.ts` at module roots for exports
- Test files: `*.test.ts` suffix (e.g., `AuthManager.test.ts`)
- Type/Interface files: `types.ts` for interface/type definitions in modules

**Functions:**
- camelCase for function names: `createFile()`, `readSheet()`, `parseContactsFile()`
- Async functions return `Promise<T>`: `async function readSheet(...): Promise<ReadSheetResult>`
- Private/internal functions start with `_` (convention in constructor patterns): `_instance` for singletons

**Variables:**
- camelCase for variables and constants: `const spreadsheetId = 'abc123'`
- UPPERCASE for constants: None observed - use camelCase even for module-level constants
- Underscore prefix for unused parameters: `(_value: unknown)` per ESLint rule

**Types:**
- PascalCase for interfaces and types: `CreateFileOptions`, `ReadSheetResult`, `TokenData`
- PascalCase for enums: `AuthState` with UPPER_SNAKE_CASE members: `AUTHENTICATED`, `TOKEN_EXPIRED`
- Suffix pattern for options: `*Options` interface (e.g., `CreateFileOptions`, `ReadSheetOptions`)
- Suffix pattern for results: `*Result` interface (e.g., `CreateFileResult`, `ReadSheetResult`)

## Code Style

**Formatting:**
- No Prettier configuration detected; ESLint enforces style
- 2-space indentation (inferred from codebase)
- Curly braces required for all blocks (ESLint rule: `curly: error`)
- No semicolons explicit policy (ES modules style)

**Linting:**
- Tool: ESLint with TypeScript plugin (`@typescript-eslint/eslint-plugin`)
- Config file: `eslint.config.js` (flat config format)
- Key rules:
  - `@typescript-eslint/no-unused-vars`: error (with `argsIgnorePattern: '^_'`)
  - `@typescript-eslint/no-explicit-any`: error (strict no-any policy)
  - `no-console`: warn (allowed but discouraged)
  - `no-debugger`: error (strict)
  - `prefer-const`: error (require const over let)
  - `no-var`: error (ES6 const/let required)
  - `eqeqeq`: error (strict equality only)
  - `no-throw-literal`: error (only throw Error instances)

**Type Safety:**
- TypeScript strict mode enabled: `"strict": true` in tsconfig.json
- Additional strict settings:
  - `noUnusedLocals: true` - local variables must be used
  - `noUnusedParameters: true` - parameters must be used
  - `noImplicitReturns: true` - all code paths must return
  - `noUncheckedIndexedAccess: true` - array access requires bounds check
  - `exactOptionalPropertyTypes: true` - optional fields cannot be `undefined`
- No implicit any: `@typescript-eslint/no-explicit-any: error`
- Unsafe operations are warnings, not errors: `no-unsafe-*` rules set to warn

## Import Organization

**Order:**
1. Node.js built-ins: `import * as fs from 'fs'`
2. External packages: `import { google } from 'googleapis'`
3. Type imports: `import type { AuthManager } from './auth/AuthManager.js'`
4. Relative imports: `import { createFile } from '../modules/drive/create.js'`

**Path Aliases:**
- No path aliases configured in tsconfig.json
- Relative paths use `.js` extension for ES modules: `from './auth/AuthManager.js'`
- Type imports use `import type` syntax

**Module Pattern:**
- ES modules (ESM) throughout: `"type": "module"` in package.json
- All imports/exports use ES6 syntax
- .js extensions required in relative imports for Node.js compatibility

## Error Handling

**Patterns:**
- Throw `Error` instances only: `throw new Error('message')`
- Never throw literals: ESLint enforces `no-throw-literal`
- Error messages are descriptive and context-specific:
  ```typescript
  throw new Error(`Sheet "${sheetName}" not found`);
  throw new Error('Event end time must be after start time');
  ```
- Errors in async operations are caught with try/catch:
  ```typescript
  try {
    const content = await fs.readFile(contactsPath, 'utf-8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      logger.warn('File not found', { path: contactsPath });
    }
  }
  ```
- Error type narrowing: `error instanceof Error` or cast with `as Error`
- NodeJS-specific errors: Cast to `NodeJS.ErrnoException` to access `code` property

**API Contract Errors:**
- Validation errors throw immediately with descriptive message
- Example from `src/modules/forms/questions.ts`:
  ```typescript
  throw new Error("Options required for multiple choice questions");
  ```
- Caller responsible for handling throws

## Logging

**Framework:** Winston (v3.17.0)
- Logger instance passed via context: `context.logger`
- Singleton pattern: `Logger.getInstance()`

**Patterns:**
- Info level for operation success: `logger.info('File created', { fileId, name })`
- Warning level for expected issues: `logger.warn('PAI contacts file not found')`
- Error level for failures: `logger.error('Failed to initialize AuthManager', { error })`
- Debug level for detailed traces: `logger.debug('AuthManager initialized')`
- Metadata object as second parameter: `{ fileId: id, name: name }`

**What to Log:**
- Operation completion with key identifiers
- Configuration details during initialization
- Errors with context object
- Authentication state changes
- Avoid logging sensitive data (tokens, passwords)

**What NOT to Log:**
- console.log() in production code (ESLint warns: `no-console: warn`)
- Raw request/response bodies with sensitive data
- Line-by-line debug traces (use `logger.debug()` instead)

## Comments

**When to Comment:**
- JSDoc for public functions and interfaces (required)
- Complex algorithms or non-obvious logic
- Workarounds or temporary solutions
- Important gotchas or surprising behavior

**JSDoc/TSDoc Pattern:**
```typescript
/**
 * Create a new file in Google Drive
 *
 * @param options File creation parameters
 * @param context Drive API context
 * @returns Created file metadata
 *
 * @example
 * ```typescript
 * const file = await createFile({
 *   name: 'report.txt',
 *   content: 'Q1 Sales Report...',
 * }, context);
 * ```
 */
export async function createFile(
  options: CreateFileOptions,
  context: DriveContext
): Promise<CreateFileResult>
```

**Documentation style:**
- First line is summary (no period)
- Blank line before @param tags
- Include @example blocks for public APIs
- Include @returns for return values
- Use markdown code blocks in examples

## Function Design

**Size:** No strict line limit, but complex functions should be broken down
- Largest function: `sheets-handler.ts:948` lines total (handler with many cases)
- Typical public functions: 40-100 lines
- Async operations wrap in try/catch for error handling

**Parameters:**
- Options object pattern: Single `options: OperationOptions` parameter
- Context object always passed: `context: ContextType`
- Example: `async function createFile(options: CreateFileOptions, context: DriveContext)`
- No parameter destructuring in signatures (use object patterns in function body)

**Return Values:**
- Named result interfaces: `CreateFileResult`, `ReadSheetResult`
- Consistent shape: `{ success: boolean; data?: T; error?: ErrorInfo }`
- Async functions return `Promise<ResultType>`
- All code paths must return a value (TypeScript noImplicitReturns enforced)

## Module Design

**Exports:**
- Barrel files at `src/modules/{module}/index.ts` export types and default functions
- Example: `src/modules/drive/index.ts` exports all drive operations and types
- Type exports use `export type`: `export type DriveContext = ...`
- Functions use default export or named exports: `export function createFile() {}`

**Barrel Files:**
- `src/modules/{module}/index.ts` exports all public APIs
- Centralized type definitions in `types.ts`
- Separate handler files for legacy code (gradual migration to modular pattern)

**Module Structure:**
- `src/modules/` - Modern modular code with small, focused functions
- `src/{legacy}/` - Legacy handler-based code (`sheets/`, `drive/`, `forms/`, `docs/`)
- `src/auth/` - Authentication and security
- `src/tools/` - MCP tool definitions

**Context Pattern:**
- All operations receive a context object with:
  - `logger: Logger` - Winston logger instance
  - `cacheManager: CacheManagerLike` - Cache operations
  - `performanceMonitor: PerformanceMonitorLike` - Performance tracking
  - `startTime: number` - For duration calculation
  - Specific API client: `drive`, `sheets`, `gmail`, etc.

## Validation Patterns

**Input Validation:**
- Type-level via TypeScript interfaces
- Runtime checks in functions before API calls
- Example: Email validation in gmail/send.ts uses regex validation
- Throw descriptive errors immediately on validation failure

**Constant Validation:**
- ESLint enforces `prefer-const` and `no-var`
- All module-scope values are const unless reassigned
- Singletons use private static _instance pattern

## Architectural Patterns

**Singleton Pattern:**
- Used for managers: `AuthManager`, `TokenManager`, `KeyRotationManager`
- Pattern:
  ```typescript
  private static _instance: AuthManager;
  public static getInstance(oauthKeys: OAuthKeys, logger: Logger): AuthManager {
    if (!AuthManager._instance) {
      AuthManager._instance = new AuthManager(oauthKeys, logger);
    }
    return AuthManager._instance;
  }
  ```

**Context Injection:**
- All operations receive context object
- Enables testing via mock injection
- Consistent logging, caching, performance tracking

**Options Interface Pattern:**
- Public functions accept single `options` object
- Separates API from implementation details
- Makes function signatures stable as features grow

---

*Convention analysis: 2026-01-25*
