# Codebase Structure

**Analysis Date:** 2026-01-25

## Directory Layout

```
gdrive/
├── index.ts                    # Main MCP server entry point
├── src/
│   ├── auth/                   # Authentication and token management
│   │   ├── AuthManager.ts      # OAuth2 lifecycle management
│   │   ├── TokenManager.ts     # Encrypted token storage
│   │   ├── KeyRotationManager.ts
│   │   └── KeyDerivation.ts
│   ├── health-check.ts         # Health check endpoint
│   ├── tools/
│   │   └── listTools.ts        # Progressive tool discovery resource
│   ├── modules/                # Service layer organized by API
│   │   ├── index.ts            # Main module re-exports
│   │   ├── types.ts            # Shared context interfaces
│   │   ├── drive/              # Google Drive operations
│   │   │   ├── index.ts
│   │   │   ├── search.ts
│   │   │   ├── read.ts
│   │   │   ├── create.ts
│   │   │   ├── update.ts
│   │   │   └── batch.ts
│   │   ├── sheets/             # Google Sheets operations
│   │   │   ├── index.ts
│   │   │   ├── list.ts
│   │   │   ├── read.ts
│   │   │   ├── manage.ts
│   │   │   ├── update.ts
│   │   │   ├── format.ts
│   │   │   └── advanced.ts
│   │   ├── forms/              # Google Forms operations
│   │   │   ├── index.ts
│   │   │   ├── create.ts
│   │   │   ├── read.ts
│   │   │   ├── questions.ts
│   │   │   └── responses.ts
│   │   ├── docs/               # Google Docs operations
│   │   │   ├── index.ts
│   │   │   ├── create.ts
│   │   │   ├── text.ts
│   │   │   ├── style.ts
│   │   │   └── table.ts
│   │   ├── gmail/              # Gmail operations
│   │   │   ├── index.ts
│   │   │   ├── list.ts
│   │   │   ├── read.ts
│   │   │   ├── search.ts
│   │   │   ├── compose.ts
│   │   │   ├── send.ts
│   │   │   ├── labels.ts
│   │   │   └── types.ts
│   │   └── calendar/           # Google Calendar operations
│   │       ├── index.ts
│   │       ├── list.ts
│   │       ├── read.ts
│   │       ├── create.ts
│   │       ├── update.ts
│   │       ├── delete.ts
│   │       ├── freebusy.ts
│   │       ├── contacts.ts
│   │       ├── types.ts
│   │       └── utils.ts
│   ├── drive/                  # Legacy handlers (pre-v3.0)
│   │   ├── drive-handler.ts
│   │   └── drive-schemas.ts
│   ├── sheets/                 # Legacy handlers (pre-v3.0)
│   │   ├── sheets-handler.ts
│   │   ├── sheets-schemas.ts
│   │   ├── helpers.ts
│   │   ├── conditional-formatting.ts
│   │   ├── advanced-tools.ts
│   │   └── layoutHelpers.ts
│   ├── forms/                  # Legacy handlers (pre-v3.0)
│   │   ├── forms-handler.ts
│   │   └── forms-schemas.ts
│   ├── docs/                   # Legacy handlers (pre-v3.0)
│   │   ├── docs-handler.ts
│   │   └── docs-schemas.ts
│   └── __tests__/              # All test files
│       ├── sheets/
│       ├── calendar/
│       ├── integration/
│       └── types/
├── dist/                       # Compiled JavaScript (gitignored)
├── scripts/                    # Build and utility scripts
├── logs/                       # Runtime logs (gitignored)
├── credentials/                # OAuth keys and tokens (gitignored)
├── jest.config.js              # Test configuration
├── tsconfig.json               # TypeScript configuration
├── package.json                # Dependencies and scripts
└── docker-compose.yml          # Redis + MCP server setup
```

## Directory Purposes

**`index.ts`:**
- Purpose: Main MCP server implementation
- Contains: Server initialization, authentication, tool dispatch, context managers
- Key sections: Logger setup (lines 196-229), CacheManager (282-377), PerformanceMonitor (233-273), request handlers (399-833), CLI commands (952-1111)

**`src/auth/`:**
- Purpose: OAuth2 and token management
- Contains: AuthManager (lifecycle), TokenManager (encryption), KeyRotationManager, KeyDerivation
- Files: `AuthManager.ts` (OAuth2 client creation, token refresh), `TokenManager.ts` (AES-256 encryption, storage)

**`src/modules/`:**
- Purpose: Service-layer operations organized by Google Workspace API
- Pattern: Each API gets a subdirectory with CRUD operations
- Key file: `types.ts` defines context interfaces (DriveContext, SheetsContext, etc.)
- Index files re-export all operations from subdirectories

**`src/modules/{drive,sheets,forms,docs,gmail,calendar}/`:**
- Purpose: Domain-specific operations for each API
- Files follow pattern: `create.ts`, `read.ts`, `update.ts`, `list.ts`, `search.ts`, etc.
- Each operation function: `async function operationName(options, context): Promise<Result>`
- Types defined inline with JSDoc examples

**`src/tools/`:**
- Purpose: Tool discovery resource
- Files: `listTools.ts` provides hardcoded operation documentation
- Used by: ReadResource handler for `gdrive://tools` requests

**`src/health-check.ts`:**
- Purpose: Health status endpoint
- Contains: Token validation, refresh capability check, memory metrics
- Used by: CLI `health` command for monitoring

**Legacy handlers (`src/{drive,sheets,forms,docs}/`):**
- Purpose: Pre-v3.0 architecture (being phased out)
- Status: Deprecated; modules/ layer is the current implementation
- Retained for: Backward compatibility during transition

**`src/__tests__/`:**
- Purpose: Jest test suites for modules
- Organized by: API (sheets/, calendar/) and integration tests
- Location: `src/__tests__/{sheets,calendar,integration}/`

## Key File Locations

**Entry Points:**
- `index.ts`: Main server (no arguments or default startup)
- `index.ts`: Authentication flow (`node dist/index.js auth`)
- `index.ts`: Health check (`node dist/index.js health`)
- `index.ts`: Key management commands (`rotate-key`, `migrate-tokens`, `verify-keys`)

**Configuration:**
- `package.json`: Dependencies, build scripts (npm run build, watch)
- `tsconfig.json`: TypeScript compiler options (ES2022 target, ES modules)
- `jest.config.js`: Test runner configuration
- `.env.example`: Template for environment variables
- `docker-compose.yml`: Redis + server stack configuration

**Core Logic:**
- `src/modules/drive/`: File operations (search, read, create, update, batch)
- `src/modules/sheets/`: Spreadsheet operations (read, update, format, conditional formatting)
- `src/modules/forms/`: Form creation and response handling
- `src/modules/docs/`: Document creation and text/table manipulation
- `src/modules/gmail/`: Email operations (list, read, search, send, draft, labels)
- `src/modules/calendar/`: Calendar and event management

**Testing:**
- `src/__tests__/sheets/`: Sheets module tests (createSheet, formatCells, etc.)
- `src/__tests__/calendar/`: Calendar module tests
- `src/__tests__/integration/`: Integration tests (e.g., createSheet-integration.test.ts)
- `jest.config.js`: Test runner setup
- `jest.setup.js`: Global test configuration

**Authentication:**
- `src/auth/AuthManager.ts`: OAuth2 state machine
- `src/auth/TokenManager.ts`: Token encryption/decryption with key rotation
- `src/auth/KeyRotationManager.ts`: Key version management
- `src/auth/KeyDerivation.ts`: PBKDF2 key derivation

**Utilities:**
- `src/tools/listTools.ts`: Tool discovery documentation
- `src/health-check.ts`: Health check implementation
- `src/modules/types.ts`: Shared context interfaces and type utilities

## Naming Conventions

**Files:**
- Operation files: `{action}.ts` (search.ts, read.ts, create.ts, update.ts, delete.ts)
- Manager classes: `{Domain}Manager.ts` (AuthManager.ts, TokenManager.ts)
- Handlers: `{domain}-handler.ts` (sheets-handler.ts, forms-handler.ts - legacy)
- Schemas: `{domain}-schemas.ts` (forms-schemas.ts - legacy)
- Types/Interfaces: Inline in operation files or `types.ts`
- Test files: `{subject}.test.ts` or `{subject}.spec.ts`
- Index files: `index.ts` (re-exports all from directory)

**Directories:**
- API modules: `modules/{lowercase-api-name}` (drive, sheets, forms, docs, gmail, calendar)
- Internal systems: `{system}` (auth, tools, modules)
- Tests: `__tests__/{api}` or `__tests__/integration`

**Functions:**
- Operation functions: camelCase (search, readSheet, createForm)
- Handler methods: camelCase (initialize, connect, track)
- Interface/Type names: PascalCase (DriveContext, SearchResult, TokenData)

**Variables:**
- Constants: UPPER_SNAKE_CASE (LIST_TOOLS_RESOURCE, GDRIVE_TOKEN_ENCRYPTION_KEY)
- Private fields: _camelCase (private _instance: AuthManager)
- Configuration: camelCase with env prefix (process.env.REDIS_URL, process.env.LOG_LEVEL)

## Where to Add New Code

**New Google Workspace API:**
1. Create `src/modules/{api-name}/` directory
2. Create `index.ts` with module documentation and re-exports
3. Create `types.ts` with TypedContext interface (extends BaseContext)
4. Create operation files: `create.ts`, `read.ts`, `search.ts`, `update.ts`, `delete.ts`
5. Each operation: typed params, context injection, returns typed result
6. Add tool definition in `index.ts` lines 462-576 (ListToolsRequestSchema)
7. Add operation dispatcher in `index.ts` lines 582-815 (CallToolRequestSchema switch case)
8. Export from `src/modules/index.ts`

**New Operation in Existing API:**
1. Create `{action}.ts` in `src/modules/{api}/` (e.g., `src/modules/sheets/pivot.ts`)
2. Define interfaces: `ActionOptions`, `ActionResult`
3. Define function: `export async function action(options: ActionOptions, context: TypedContext): Promise<ActionResult>`
4. Add JSDoc with example usage
5. Use cache pattern: check cache, execute API, store cache (see search.ts lines 54-75)
6. Export from `src/modules/{api}/index.ts`
7. Add to operation enum in `index.ts` ListToolsRequestSchema
8. Add case in `index.ts` CallToolRequestSchema switch

**New Authentication Method:**
1. Extend `src/auth/AuthManager.ts` (or create new Manager class)
2. Implement state machine with AuthState enum
3. Set `oauth2Client` via `google.options({ auth: client })`
4. Add CLI command in `index.ts` (e.g., lines 1086-1110)
5. Export and call from `loadCredentialsAndRunServer()`

**New Test:**
1. Create `src/__tests__/{api}/{feature}.test.ts`
2. Use Jest describe/it blocks
3. Mock googleapis clients via context
4. Test operation with various param combinations
5. Test error cases
6. Include integration tests in `src/__tests__/integration/`

**Utility/Helper:**
1. Create in `src/modules/{api}/helpers.ts` (domain-specific) or `src/shared/` (cross-domain)
2. Export from module's `index.ts`
3. Import in operation files as needed
4. Document with JSDoc

## Special Directories

**`dist/`:**
- Purpose: Compiled JavaScript output
- Generated: Yes (by `npm run build`)
- Committed: No (gitignored)
- Content: TypeScript source compiled to ES modules with shebang added

**`credentials/`:**
- Purpose: OAuth keys and encrypted tokens
- Generated: Yes (by auth flow)
- Committed: No (gitignored)
- Files: `gcp-oauth.keys.json` (checked in by user), `.gdrive-server-credentials.json` (auto-generated encrypted)

**`logs/`:**
- Purpose: Winston log files
- Generated: Yes (by running server)
- Committed: No (gitignored)
- Files: `error.log`, `combined.log` (with rotation at 5MB)

**`src/__tests__/`:**
- Purpose: Jest test suites
- Generated: No (source files)
- Committed: Yes
- Pattern: Mirrors `src/modules/` structure for consistency

---

*Structure analysis: 2026-01-25*
