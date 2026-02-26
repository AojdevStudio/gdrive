# Coding Conventions

**Analysis Date:** 2026-02-25

## Naming Patterns

**Files:**
- Domain operations use lowercase concise names in service folders (`src/modules/drive/search.ts`, `src/modules/docs/text.ts`)
- Manager classes use PascalCase filenames (`src/auth/AuthManager.ts`, `src/auth/TokenManager.ts`)
- Tests follow `*.test.ts` naming under `__tests__/`

**Functions:**
- Exported functions use camelCase verb phrases (`createSheet`, `checkFreeBusy`, `sendMessage`)
- Internal helper functions are lowercase camelCase (`escapeQueryValue`, `validateOrderBy`)

**Variables:**
- camelCase for local variables and option destructuring (`cacheKey`, `sheetProperties`, `oauthPath`)
- UPPER_SNAKE_CASE for constant allowlists (`VALID_ORDER_BY_FIELDS`)

**Types:**
- Interfaces and exported types use PascalCase (`DriveContext`, `CreateSheetOptions`, `FreeBusyResult`)
- Enums are PascalCase with uppercase members when needed (`AuthState`)

## Code Style

**Formatting:**
- TypeScript strict mode with modern ES module output in `tsconfig.json`
- No standalone formatter config detected; style is enforced via lint + TypeScript checks

**Linting:**
- ESLint with `@typescript-eslint` in `eslint.config.js`
- Key enforced rules: no explicit `any` (except test overrides), `eqeqeq`, `curly`, `prefer-const`, `no-var`, `no-throw-literal`
- Console usage is warning-level in production code, disabled in tests

## Import Organization

**Order:**
1. Third-party imports (`googleapis`, `winston`, SDK types)
2. Internal absolute-relative imports (`./...`)
3. Type-only imports using `import type`

**Path Aliases:**
- Not detected; code uses relative imports
- ES module `.js` extension is used in TypeScript import paths (`from './types.js'`)

## Error Handling

**Patterns:**
- Throw explicit `Error` instances with actionable messages (`src/modules/*`, `index.ts`)
- Convert unknown errors to messages with helper patterns (`src/modules/types.ts`)
- Log context before throwing for API and cache failures (`src/drive/drive-handler.ts`, `index.ts`)

## Logging

**Framework:** `winston`

**Patterns:**
- Structured logger with JSON output and timestamp (`index.ts`)
- Error serialization normalizes nested `Error` objects (`index.ts`)
- Modules log operation-specific metadata (`src/modules/sheets/manage.ts`, `src/modules/gmail/send.ts`)

## Comments

**When to Comment:**
- JSDoc used on exported interfaces/functions for behavior and examples (`src/modules/drive/search.ts`)
- Inline comments explain nuanced behavior (cache TTL constraints, exact optional typing)

**JSDoc/TSDoc:**
- Widely used in operation modules and handlers
- Includes parameter docs and usage examples in most service modules

## Function Design

**Size:**
- Operation functions are generally single-purpose and colocated by capability (`search`, `read`, `create`, `update`)

**Parameters:**
- Standardized pattern: `(options, context)` for modules under `src/modules/*`
- Router-level handlers use `{ operation, params }` shape from MCP tool args in `index.ts`

**Return Values:**
- Strongly typed result interfaces returned from module operations
- Router serializes results into MCP text content payload

## Module Design

**Exports:**
- Barrel exports in each service `index.ts` for discoverability and centralized typing

**Barrel Files:**
- Consistent use in `src/modules/drive/index.ts`, `src/modules/sheets/index.ts`, `src/modules/gmail/index.ts`, and others

---

*Convention analysis: 2026-02-25*
