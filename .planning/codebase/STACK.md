# Technology Stack

**Analysis Date:** 2026-02-25

## Languages

**Primary:**
- TypeScript 5.6 - Core implementation in `index.ts` and `src/**/*.ts`

**Secondary:**
- JavaScript (ES modules) - Tooling/config in `jest.config.js`, `eslint.config.js`, and runtime scripts under `scripts/`
- Bash - Operational scripts in `scripts/auth.sh`

## Runtime

**Environment:**
- Node.js >=22.0.0 (declared in `package.json` engines)

**Package Manager:**
- npm (lockfile present)
- Lockfile: present (`package-lock.json`)

## Frameworks

**Core:**
- `@modelcontextprotocol/sdk` - MCP server transport and request schemas in `index.ts`
- `googleapis` - Google Workspace API clients (`drive`, `sheets`, `forms`, `docs`, `gmail`, `calendar`) in `index.ts`

**Testing:**
- `jest` + `ts-jest` - Unit/integration test execution configured in `jest.config.js`

**Build/Dev:**
- TypeScript compiler (`tsc`) - Build pipeline from `src/` to `dist/` via `npm run build`
- ESLint (`@typescript-eslint`) - Linting rules in `eslint.config.js`
- `shx` - Cross-platform chmod during build (`package.json` build script)

## Key Dependencies

**Critical:**
- `@modelcontextprotocol/sdk` - Defines MCP server protocol behavior in `index.ts`
- `googleapis` - Required for all Google service operations in `src/modules/*`
- `winston` - Structured logging for server and auth lifecycle in `index.ts`, `src/health-check.ts`

**Infrastructure:**
- `redis` - Optional cache backing in `index.ts` (`CacheManager`)
- `isolated-vm` - Native dependency installed for runtime isolation (build deps documented in `Dockerfile`)
- `@google-cloud/local-auth` - OAuth bootstrap during `auth` flow in `index.ts`

## Configuration

**Environment:**
- Runtime configuration is environment-variable driven in `index.ts`, `src/auth/AuthManager.ts`, and `src/auth/TokenManager.ts`
- Token encryption key is mandatory (`GDRIVE_TOKEN_ENCRYPTION_KEY`) for startup and auth flows
- OAuth credentials path is configurable via `GDRIVE_OAUTH_PATH`

**Build:**
- TypeScript config in `tsconfig.json`
- Jest config in `jest.config.js`
- ESLint config in `eslint.config.js`
- Docker build/runtime config in `Dockerfile`

## Platform Requirements

**Development:**
- Node.js 22+
- Native build tooling for `isolated-vm` (`python3`, `make`, `g++`) as shown in `Dockerfile`
- OAuth credential file in `credentials/gcp-oauth.keys.json` (used by `scripts/auth.sh`)

**Production:**
- Containerized deployment target on `node:22-slim` (`Dockerfile`)
- Optional Redis service for cache acceleration (configured in `index.ts` via `REDIS_URL`)
- StdIO MCP transport process started via `dist/index.js`

---

*Stack analysis: 2026-02-25*
