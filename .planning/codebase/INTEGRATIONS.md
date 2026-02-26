# External Integrations

**Analysis Date:** 2026-02-25

## APIs & External Services

**Google Workspace APIs:**
- Google Drive API v3 - File search/read/create/update/batch operations via `index.ts` and `src/modules/drive/*`
  - SDK/Client: `googleapis`
  - Auth: OAuth credentials path from `GDRIVE_OAUTH_PATH`
- Google Sheets API v4 - Sheet list/read/manage/update/format/advanced operations in `src/modules/sheets/*`
  - SDK/Client: `googleapis`
  - Auth: OAuth2 client initialized in `src/auth/AuthManager.ts`
- Google Forms API v1 - Form create/read/questions/responses in `src/modules/forms/*`
  - SDK/Client: `googleapis`
  - Auth: OAuth scopes set in `index.ts`
- Google Docs API v1 - Document create/text/style/table operations in `src/modules/docs/*`
  - SDK/Client: `googleapis`
  - Auth: OAuth scopes set in `index.ts`
- Gmail API v1 - Message/thread/read/search/draft/send/label operations in `src/modules/gmail/*`
  - SDK/Client: `googleapis`
  - Auth: Gmail scopes declared in `index.ts`
- Google Calendar API v3 - Calendar/event CRUD and free/busy operations in `src/modules/calendar/*`
  - SDK/Client: `googleapis`
  - Auth: Calendar scopes declared in `index.ts`

**Caching Service:**
- Redis (optional) - Request-level cache in `CacheManager` (`index.ts`)
  - SDK/Client: `redis`
  - Auth: `REDIS_URL`

## Data Storage

**Databases:**
- Not detected (no relational/document DB integration in `src/`)

**File Storage:**
- Local filesystem for OAuth and token persistence (`credentials/` and home-directory token files managed by `src/auth/TokenManager.ts`)

**Caching:**
- Redis when available; graceful no-cache fallback when connection fails (`index.ts`)

## Authentication & Identity

**Auth Provider:**
- Google OAuth 2.0
  - Implementation: OAuth bootstrap using `@google-cloud/local-auth` in `index.ts`, token lifecycle managed by `src/auth/AuthManager.ts` and `src/auth/TokenManager.ts`

## Monitoring & Observability

**Error Tracking:**
- No external SaaS tracker detected

**Logs:**
- Structured JSON logging via Winston to `logs/error.log` and `logs/combined.log` in `index.ts`
- Console logging to stderr for MCP stdio safety

## CI/CD & Deployment

**Hosting:**
- Dockerized Node process defined by `Dockerfile` and `docker-compose.yml`

**CI Pipeline:**
- GitHub Actions workflows in `.github/workflows/*.yml` (CI, CD, security scanning, code quality, release, performance monitoring)

## Environment Configuration

**Required env vars:**
- `GDRIVE_TOKEN_ENCRYPTION_KEY`
- `GDRIVE_OAUTH_PATH` (or default credentials path logic in `index.ts`)
- Optional operational vars: `REDIS_URL`, `LOG_LEVEL`, `PAI_CONTACTS_PATH`, token refresh tuning vars in `src/auth/AuthManager.ts`

**Secrets location:**
- Environment variables at runtime
- OAuth credential JSON under `credentials/`
- Encrypted token files managed by `src/auth/TokenManager.ts`

## Webhooks & Callbacks

**Incoming:**
- Not detected (no HTTP webhook listeners in current architecture)

**Outgoing:**
- Not detected (integration model is direct Google API calls over OAuth)

---

*Integration audit: 2026-02-25*
