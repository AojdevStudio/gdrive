# External Integrations

**Analysis Date:** 2026-01-25

## APIs & External Services

**Google Workspace APIs:**

- **Google Drive API (v3)** - File and folder management
  - SDK/Client: `googleapis` package, instantiated as `google.drive("v3")`
  - Auth: OAuth2 via `@google-cloud/local-auth`
  - Entry point: `index.ts` line 89
  - Scope: `https://www.googleapis.com/auth/drive`
  - Operations: search, read, create files/folders, update, batch operations
  - Location: `src/modules/drive/` (search.ts, read.ts, create.ts, update.ts, batch.ts)

- **Google Sheets API (v4)** - Spreadsheet operations
  - SDK/Client: `googleapis` package, instantiated as `google.sheets("v4")`
  - Auth: OAuth2 via `@google-cloud/local-auth`
  - Entry point: `index.ts` line 90
  - Scope: `https://www.googleapis.com/auth/spreadsheets`
  - Operations: list, read, create sheets, update cells, formatting, append rows
  - Location: `src/modules/sheets/` (list.ts, read.ts, manage.ts, update.ts, format.ts, advanced.ts)

- **Google Forms API (v1)** - Form creation and response collection
  - SDK/Client: `googleapis` package, instantiated as `google.forms("v1")`
  - Auth: OAuth2 via `@google-cloud/local-auth`
  - Entry point: `index.ts` line 91
  - Operations: create forms, add questions, list responses, read form structure
  - Location: `src/modules/forms/` (create.ts, questions.ts, responses.ts, read.ts)

- **Google Docs API (v1)** - Document creation and manipulation
  - SDK/Client: `googleapis` package, instantiated as `google.docs("v1")`
  - Auth: OAuth2 via `@google-cloud/local-auth`
  - Entry point: `index.ts` line 92
  - Operations: create documents, insert/replace text, apply formatting, insert tables
  - Location: `src/modules/docs/` (create.ts, text.ts, style.ts, table.ts)

- **Gmail API (v1)** - Email operations
  - SDK/Client: `googleapis` package, instantiated as `google.gmail("v1")`
  - Auth: OAuth2 via `@google-cloud/local-auth`
  - Entry point: `index.ts` line 93
  - Scope: `https://www.googleapis.com/auth/gmail.modify`
  - Operations: list messages/threads, read, search, compose, send, manage labels
  - Location: `src/modules/gmail/` (list.ts, read.ts, search.ts, compose.ts, send.ts, labels.ts)
  - Version: 3.2.0+

- **Google Calendar API (v3)** - Calendar and event management
  - SDK/Client: `googleapis` package, instantiated as `google.calendar("v3")`
  - Auth: OAuth2 via `@google-cloud/local-auth`
  - Entry point: `index.ts` line 94
  - Operations: list calendars/events, create/update/delete events, check free/busy, natural language quick add
  - Location: `src/modules/calendar/` (list.ts, read.ts, create.ts, update.ts, delete.ts, freebusy.ts)
  - Contact resolution: Optional via `PAI_CONTACTS_PATH` env var (`src/modules/calendar/contacts.ts`)
  - Version: 3.3.0+

## Data Storage

**Databases:**
- None - This is a stateless MCP server. Google Workspace is the data source.

**Token Storage:**
- Local file system encryption instead of database
  - Path: `GDRIVE_TOKEN_STORAGE_PATH` (default: `~/.gdrive-mcp-tokens.json`)
  - Encryption: AES-256-GCM with PBKDF2 key derivation
  - Manager: `src/auth/TokenManager.ts`
  - Audit logging: `GDRIVE_TOKEN_AUDIT_LOG_PATH`

**File Storage:**
- Google Drive - All files stored and managed via Google Drive API
- Local temporary data directory: `./data/` (Docker/docker-compose only)
- Local logs directory: `./logs/` (Docker/docker-compose only)

**Caching:**
- Redis (optional but recommended)
  - Connection: `REDIS_URL` environment variable (default: `redis://localhost:6379`)
  - Package: `redis` v5.6.1
  - Manages: Cache hit/miss tracking
  - Implementation: Abstract `CacheManagerLike` interface in `src/modules/types.ts`
  - Usage: Search results, file reads cached with configurable TTL
  - Graceful fallback if unavailable

## Authentication & Identity

**Auth Provider:**
- Google OAuth2 (local auth flow)
  - Implementation: `@google-cloud/local-auth` v3.0.1
  - Manager: `src/auth/AuthManager.ts`
  - Token manager: `src/auth/TokenManager.ts`
  - Key rotation: `src/auth/KeyRotationManager.ts`
  - Key derivation: `src/auth/KeyDerivation.ts`

**Authentication Flow:**
1. User runs `node ./dist/index.js auth` to obtain credentials
2. Requires `gcp-oauth.keys.json` file (GCP OAuth client credentials)
3. Opens browser for Google login/consent
4. Saves credentials to `~/.gdrive-server-credentials.json`
5. Token refreshed automatically every 30 minutes (configurable via `GDRIVE_TOKEN_REFRESH_INTERVAL`)
6. Preemptive refresh 10 minutes before expiry (configurable via `GDRIVE_TOKEN_PREEMPTIVE_REFRESH`)

**Security:**
- Tokens encrypted with AES-256-GCM at rest in `src/auth/TokenManager.ts`
- Encryption key must be 32-byte base64-encoded (via `GDRIVE_TOKEN_ENCRYPTION_KEY`)
- Key rotation support with versioning (V1, V2, V3, V4)
- PBKDF2 salt-based key derivation
- Token audit logging with event types (TOKEN_ACQUIRED, TOKEN_REFRESHED, TOKEN_REFRESH_FAILED, etc.)

**Auth States:**
- Defined in `AuthManager.ts`: UNAUTHENTICATED, AUTHENTICATED, TOKEN_EXPIRED, REFRESH_FAILED, TOKENS_REVOKED

## Monitoring & Observability

**Error Tracking:**
- Health check module: `src/health-check.ts`
- Health status types: HealthStatus interface
- Endpoint: `node ./dist/health-check.js` (called by Docker health checks)
- Interval: Every 5 minutes in production (configurable)

**Logs:**
- Winston-based structured logging
  - Config in `index.ts` (lines ~122-150)
  - Transports: console and file
  - Levels: error, warn, info, debug, verbose (set via `LOG_LEVEL` env var, default: info)
  - Error serialization: Custom errorSerializer format in `index.ts`
  - Audit logging: `GDRIVE_TOKEN_AUDIT_LOG_PATH` for authentication events

**Performance Monitoring:**
- Implementation: `PerformanceMonitorLike` interface in `src/modules/types.ts`
- Tracks: operation count, average duration, error rate
- Stats interface: `PerformanceStats` in `index.ts` (lines 97-109)
- Metrics: Cache hit/miss ratios, uptime, per-operation statistics
- Interval: Stats logged every 30 seconds (configurable)

## CI/CD & Deployment

**Hosting:**
- Docker containerization supported
  - Dockerfile: Multi-stage build with Node 22-slim base
  - Docker Compose: Includes gdrive-mcp service + Redis service
  - Volumes: credentials/, data/, logs/
  - Network: mcp-network (bridge driver)

**CI Pipeline:**
- GitHub Actions (reference in CLAUDE.md)
- ESLint compliance required
- Jest test coverage thresholds:
  - Branches: 25%
  - Functions: 40%
  - Lines: 35%
  - Statements: 35%
- Build verification in CI

**Deployment:**
- MCP server runs on stdio transport (standard input/output)
- No HTTP listening (purely process-based communication)
- Health check: `node dist/health-check.js`
- Restart policy: unless-stopped (docker-compose)
- Process timeout/retry configuration in env vars

## Environment Configuration

**Required env vars:**
- `GDRIVE_TOKEN_ENCRYPTION_KEY` - 32-byte base64-encoded encryption key (generate with `openssl rand -base64 32`)

**Secrets location:**
- `gcp-oauth.keys.json` - GCP OAuth credentials (host machine, Docker mounts to `/credentials/`)
- `.gdrive-server-credentials.json` - Server-saved credentials (host machine)
- `.gdrive-mcp-tokens.json` - Encrypted token storage (host machine)
- `.gdrive-mcp-audit.log` - Audit trail of authentication events

**Docker-specific paths:**
- Credentials: `/credentials/` (volume mount)
- Logs: `/app/logs/` (volume mount)
- Data: `/data/` (volume mount)
- OAuth keys: `/credentials/gcp-oauth.keys.json`
- Token storage: `/credentials/.gdrive-mcp-tokens.json`
- Audit log: `/app/logs/gdrive-mcp-audit.log`

## Webhooks & Callbacks

**Incoming:**
- None - This is a request/response MCP server, not a webhook receiver

**Outgoing:**
- None - All operations are initiated by client requests through MCP protocol

**OAuth Callback:**
- Local callback: Uses `@google-cloud/local-auth` which handles OAuth2 redirect locally
- Default redirect URI: http://localhost:3000/oauth2callback (configured in GCP OAuth app)
- No external webhook endpoint required

---

*Integration audit: 2026-01-25*
