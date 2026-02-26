# Codebase Structure

**Analysis Date:** 2026-02-25

## Directory Layout

```
[project-root]/
|-- index.ts                 # MCP server entrypoint and tool router
|-- src/                     # Core source code and tests
|   |-- auth/                # OAuth/token encryption and key rotation
|   |-- modules/             # Operation implementations by Google service
|   |-- tools/               # Tool discovery resource generation
|   |-- drive/               # Legacy drive handler path
|   |-- sheets/              # Legacy sheets handler path
|   |-- forms/               # Legacy forms handler path
|   |-- docs/                # Legacy docs handler path
|   `-- __tests__/           # Cross-cutting unit/integration/perf/security tests
|-- tests/e2e/               # End-to-end tests
|-- scripts/                 # Operational scripts and migrations
|-- docs/                    # Project documentation
|-- .planning/               # GSD planning state, roadmap, and codebase map
`-- .github/workflows/       # CI/CD and quality automation
```

## Directory Purposes

**`src/modules/`:**
- Purpose: Primary operation-based implementation consumed by `index.ts`
- Contains: Service folders (`drive`, `sheets`, `forms`, `docs`, `gmail`, `calendar`) with `index.ts` barrels and operation files
- Key files: `src/modules/types.ts`, `src/modules/calendar/index.ts`, `src/modules/drive/search.ts`

**`src/auth/`:**
- Purpose: Authentication and secure token management
- Contains: Auth manager, token encryption manager, key rotation manager, key derivation
- Key files: `src/auth/AuthManager.ts`, `src/auth/TokenManager.ts`

**`src/__tests__/`:**
- Purpose: Repository-level unit, integration, performance, and security tests
- Contains: auth/security/sheets/integration/performance test suites
- Key files: `src/__tests__/auth/TokenManager.test.ts`, `src/__tests__/security/key-security.test.ts`

**`src/{drive,sheets,forms,docs}/`:**
- Purpose: Legacy handler-style implementation path with schemas
- Contains: `*-handler.ts` plus `*-schemas.ts`
- Key files: `src/sheets/sheets-handler.ts`, `src/drive/drive-handler.ts`

## Key File Locations

**Entry Points:**
- `index.ts`: Main server bootstrap, request handlers, dynamic operation routing
- `src/health-check.ts`: Health-check CLI implementation

**Configuration:**
- `package.json`: Scripts, dependencies, Node engine
- `tsconfig.json`: TypeScript strict compiler settings
- `jest.config.js`: Jest + ts-jest setup
- `eslint.config.js`: Lint rules and ignore policy

**Core Logic:**
- `src/modules/*/*.ts`: Service operation implementations
- `src/auth/*.ts`: Token lifecycle and security
- `src/tools/listTools.ts`: MCP progressive tool-discovery resource

**Testing:**
- `src/__tests__/**/*.test.ts`: Main automated test suites
- `src/modules/**/__tests__/*.test.ts`: Module-local tests
- `tests/e2e/*.test.ts`: End-to-end tests

## Naming Conventions

**Files:**
- Service operation files use lowercase verb/object names: `search.ts`, `create.ts`, `freebusy.ts`
- Auth/security classes use PascalCase filenames: `AuthManager.ts`, `TokenManager.ts`
- Test files use `*.test.ts` naming under `__tests__/`

**Directories:**
- Domain-based organization: `src/modules/<service>/`
- Cross-cutting tests grouped under `src/__tests__/` with topic subfolders

## Where to Add New Code

**New Feature:**
- Primary code: `src/modules/<service>/<operation>.ts`
- Exports: `src/modules/<service>/index.ts`
- Tests: `src/modules/<service>/__tests__/` or `src/__tests__/`

**New Component/Module:**
- Implementation: `src/modules/<new-service>/`
- Routing: add tool/operation enum and dispatch branch in `index.ts`

**Utilities:**
- Shared helpers: `src/modules/types.ts` for cross-module context/types
- Service-specific helpers: co-locate under service folder (for example `src/modules/calendar/utils.ts`)

## Special Directories

**`dist/`:**
- Purpose: TypeScript build output
- Generated: Yes
- Committed: No (`*dist*` ignored by `.gitignore`)

**`credentials/`:**
- Purpose: Local OAuth credentials and encrypted token storage
- Generated: Runtime-managed
- Committed: No (`credentials/` ignored)

**`.planning/`:**
- Purpose: GSD workflow state, roadmap, and planning docs
- Generated: Workflow-managed
- Committed: Yes (project memory)

---

*Structure analysis: 2026-02-25*
