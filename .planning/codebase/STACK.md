# Technology Stack

**Analysis Date:** 2026-01-25

## Languages

**Primary:**
- TypeScript 5.6.2 - All source code in `src/`
- JavaScript (ES2022 target/module) - Compiled output and config files

**Secondary:**
- Bash - Build scripts and deployment automation
- Python - Historical changelog generation (scripts/)

## Runtime

**Environment:**
- Node.js 22.0.0+ (engine requirement: `>=22.0.0`)
- Current version: v25.2.1

**Package Manager:**
- npm (no lockfile specification, uses standard npm)
- Lockfile: package-lock.json (automatically managed)

## Frameworks

**Core:**
- @modelcontextprotocol/sdk 1.25.1 - MCP server implementation
  - Provides `Server`, `StdioServerTransport`, schema types
  - Location: `index.ts` main server setup
- googleapis 144.0.0 - Google Workspace API client library
  - Includes Drive v3, Sheets v4, Forms v1, Docs v1, Gmail v1, Calendar v3 APIs
  - Instantiated at top level in `index.ts`

**Authentication & Security:**
- @google-cloud/local-auth 3.0.1 - OAuth2 local authentication flow
  - Used in `AuthManager.ts` for token acquisition
- crypto (Node.js built-in) - Token encryption with AES-256-GCM
  - Location: `src/auth/KeyDerivation.ts`, `src/auth/TokenManager.ts`

**Data Management:**
- redis 5.6.1 - In-memory caching
  - Optional but recommended for production
  - Connected via `REDIS_URL` environment variable
  - Cache manager implemented in main `index.ts`
- isolated-vm 6.0.2 - Secure JavaScript execution context (if used)
  - Available as optional capability

**Logging & Monitoring:**
- winston 3.17.0 - Structured logging framework
  - Configured with console and file transports
  - Used throughout codebase via logger instance
  - Location: `index.ts` logger setup
  - Custom error serializer for Error objects in metadata

**Testing:**
- jest 29.7.0 - Test runner and assertion library
  - Config: `jest.config.js`
  - Test setup: `jest.setup.js`
  - ts-jest 29.1.2 - TypeScript support for Jest
  - @types/jest 29.5.12 - Type definitions
  - Run tests with `npm test`, watch with `npm test:watch`, coverage with `npm test:coverage`

**Build & Development:**
- TypeScript 5.6.2 - Compilation and type checking
  - Config: `tsconfig.json` with ES2022 target/module
  - Strict mode enabled, noImplicitAny, declaration maps
  - Exclude: test files, node_modules, dist/
- shx 0.3.4 - Cross-platform shell commands
  - Used in build script for chmod operations on compiled files
- eslint 9.21.0 - Code linting
  - Config: `eslint.config.js` (flat config format)
  - @eslint/js 9.21.0 - ESLint core rules
  - @typescript-eslint/eslint-plugin 8.20.0 - TypeScript-specific rules
  - @typescript-eslint/parser 8.20.0 - TypeScript parser
  - Enforces strict typing, no var, const preference, no console warnings

## Key Dependencies

**Critical:**
- googleapis 144.0.0 - Why it matters: Entire server is built on accessing Google Workspace APIs (Drive, Sheets, Forms, Docs, Gmail, Calendar)
- @modelcontextprotocol/sdk 1.25.1 - Why it matters: Enables MCP protocol implementation for Claude integration
- @google-cloud/local-auth 3.0.1 - Why it matters: Handles OAuth2 flow for Google authentication without requiring service accounts

**Infrastructure:**
- redis 5.6.1 - Performance caching and hit-rate optimization
- winston 3.17.0 - Production-grade logging with file rotation
- isolated-vm 6.0.2 - Secure sandboxed execution (optional capability)

**Security:**
- crypto (Node.js built-in) - AES-256-GCM encryption for token storage
- Key derivation via PBKDF2 with salt - `src/auth/KeyDerivation.ts`
- Key rotation manager - `src/auth/KeyRotationManager.ts`

## Configuration

**Environment:**
- Loaded via `.env` file or environment variables
- Required keys:
  - `GDRIVE_TOKEN_ENCRYPTION_KEY` - Base64-encoded 32-byte encryption key (required)
  - `GDRIVE_OAUTH_PATH` - Path to GCP OAuth client credentials file (default: `./gcp-oauth.keys.json`)
  - `GDRIVE_CREDENTIALS_PATH` - Path to saved server credentials (default: `~/.gdrive-server-credentials.json`)

- Optional configuration:
  - `GDRIVE_TOKEN_STORAGE_PATH` - Token storage location (default: `~/.gdrive-mcp-tokens.json`)
  - `GDRIVE_TOKEN_AUDIT_LOG_PATH` - Audit log location (default: `~/.gdrive-mcp-audit.log`)
  - `GDRIVE_TOKEN_REFRESH_INTERVAL` - Token refresh interval in ms (default: 1800000 = 30 min)
  - `GDRIVE_TOKEN_PREEMPTIVE_REFRESH` - Preemptive refresh before expiry in ms (default: 600000 = 10 min)
  - `GDRIVE_TOKEN_MAX_RETRIES` - Max retry attempts (default: 3)
  - `GDRIVE_TOKEN_RETRY_DELAY` - Initial retry delay in ms (default: 1000)
  - `GDRIVE_TOKEN_HEALTH_CHECK` - Enable health checks (default: true)
  - `GDRIVE_TOKEN_ENCRYPTION_KEY_V2`, `V3`, `V4` - Additional keys for rotation
  - `GDRIVE_TOKEN_CURRENT_KEY_VERSION` - Current key version (default: v1)
  - `REDIS_URL` - Redis connection string (default: `redis://localhost:6379`)
  - `LOG_LEVEL` - Winston logging level: error, warn, info, debug, verbose (default: info)
  - `NODE_ENV` - Environment: development or production
  - `PAI_CONTACTS_PATH` - Optional path to CONTACTS.md for calendar attendee resolution

**Build:**
- `tsconfig.json` - Compilation target ES2022, module ES2022, strict mode
- `.eslintrc` patterns defined in `eslint.config.js`
- No `.prettierrc` found (formatting managed via ESLint)

## Platform Requirements

**Development:**
- Node.js 22.0.0 or higher
- npm (any recent version)
- Bash-compatible shell for scripts
- GCP OAuth credentials file (`gcp-oauth.keys.json`)

**Production:**
- Node.js 22+ runtime
- Redis server (recommended, optional)
- Docker support: `Dockerfile` and `docker-compose.yml` provided
- Volume requirements: credentials/, data/, logs/ directories

**Docker:**
- Base image: node:22-slim
- System dependencies: python3, make, g++ (for native module builds)
- Memory limit: 4096MB for TypeScript compilation
- Health check: runs `node dist/health-check.js` every 5 minutes
- Compose includes Redis 7-alpine service

---

*Stack analysis: 2026-01-25*
