# CLAUDE.md

## Project Overview

MCP server for Google Workspace integration (Drive, Sheets, Forms, Docs, Gmail, Calendar). Version 3.3.0.

- 6 operation-based tools with 47 total operations
- Redis caching (optional, graceful fallback)
- Token encryption with key rotation
- Docker support with docker-compose

**Reference:** [how2mcp](https://github.com/Rixmerz/HOW2MCP.git) — definitive MCP implementation guide. Follow its **operation-based tool pattern** (one tool with `operation` parameter, NOT separate tools per action). See `MCP-DOCS/` for architecture guides and `MCP_EXAMPLE_PROJECT/` for reference implementation.

## Commands

```bash
# Build & Dev
npm run build          # Compile TypeScript to dist/
npm run watch          # Watch mode (auto-rebuild)

# Testing
npm test               # Run all unit tests
npm run test:coverage  # Tests with coverage report
npm run test:integration  # Integration tests
npm run test:e2e       # End-to-end tests
npm run type-check     # TypeScript type checking (no emit)
npm run lint           # ESLint

# Auth & Server
node ./dist/index.js auth   # OAuth flow (requires gcp-oauth.keys.json)
node ./dist/index.js        # Start MCP server (stdio transport)

# Changelog
./scripts/changelog/update-changelog.py --auto
```

## Architecture

### MCP Tools (Operation-Based)

All tools use an `operation` parameter — NOT separate tools per action:

| Tool | Ops | Operations |
|------|-----|------------|
| `drive` | 7 | search, enhancedSearch, read, createFile, createFolder, updateFile, batchOperations |
| `sheets` | 11 | listSheets, readSheet, createSheet, renameSheet, deleteSheet, updateCells, updateFormula, formatCells, addConditionalFormat, freezeRowsColumns, setColumnWidth, appendRows |
| `forms` | 4 | createForm, readForm, addQuestion, listResponses |
| `docs` | 5 | createDocument, insertText, replaceText, applyTextStyle, insertTable |
| `gmail` | 10 | listMessages, listThreads, getMessage, getThread, searchMessages, createDraft, sendMessage, sendDraft, listLabels, modifyLabels |
| `calendar` | 9 | listCalendars, getCalendar, listEvents, getEvent, createEvent, updateEvent, deleteEvent, quickAdd, checkFreeBusy |

Resources: Lists and reads Google Drive files via `gdrive:///<file_id>` URIs.

### Module Structure

```
src/
  modules/
    calendar/  (13 files) - Google Calendar v3 API (v3.3.0)
    docs/      (2 files)  - Google Docs v1 API
    drive/     (9 files)  - Google Drive v3 API
    forms/     (7 files)  - Google Forms v1 API
    gmail/     (12 files) - Gmail v1 API (v3.2.0)
    sheets/    (9 files)  - Google Sheets v4 API
    index.ts              - Module exports
    types.ts              - Shared types
  __tests__/              - 24+ test files (unit, integration, performance)
index.ts                  - Main server (37KB, tool registration, cache, auth)
```

### File Type Handling

| Google Type | Export Format |
|-------------|-------------|
| Docs | Markdown |
| Sheets | CSV |
| Presentations | Plain text |
| Drawings | PNG |
| Text files | Direct content |
| Binary | Base64 blob |

## Environment Variables

See `.env.example` for full reference. Key variables:

| Variable | Required | Purpose |
|----------|----------|---------|
| `GDRIVE_TOKEN_ENCRYPTION_KEY` | **Yes** | 32-byte base64 key for token storage. Generate: `openssl rand -base64 32` |
| `GDRIVE_TOKEN_ENCRYPTION_KEY_V2/V3/V4` | No | Additional keys for key rotation |
| `GDRIVE_TOKEN_CURRENT_KEY_VERSION` | No | Active key version (default: v1) |
| `GDRIVE_TOKEN_REFRESH_INTERVAL` | No | Token refresh interval in ms (default: 1800000) |
| `GDRIVE_TOKEN_PREEMPTIVE_REFRESH` | No | Pre-expiry refresh window in ms (default: 600000) |
| `GDRIVE_TOKEN_MAX_RETRIES` | No | Max retry attempts (default: 3) |
| `GDRIVE_TOKEN_RETRY_DELAY` | No | Initial retry delay in ms (default: 1000) |
| `GDRIVE_CREDENTIALS_PATH` | No | Path to credentials file |
| `GDRIVE_OAUTH_PATH` | No | Path to OAuth keys file |
| `PAI_CONTACTS_PATH` | No | Contact resolution for Calendar (name → email) |
| `LOG_LEVEL` | No | Winston log level (default: info) |
| `REDIS_URL` | No | Redis connection (default: redis://localhost:6379) |
| `GDRIVE_TOKEN_HEALTH_CHECK` | No | Enable token health checks (default: true) |

## Docker

```bash
# Authenticate first (on host, opens browser)
./scripts/auth.sh

# Run with Redis (recommended)
docker-compose up -d

# Run standalone (no Redis)
docker run -i --rm \
  -v ${PWD}/credentials:/credentials:ro \
  -v ${PWD}/data:/data \
  -v ${PWD}/logs:/app/logs \
  --env-file .env \
  gdrive-mcp-server
```

For Claude Desktop integration, see `docker-compose.yml` for the full service config.

## Git Workflow

Main branch is protected. All changes go through PRs.

```bash
git checkout -b feature/your-feature-name
git push -u origin feature/your-feature-name
gh pr create --title "feat: description" --body "Details"
```

Use conventional commits: `feat:`, `fix:`, `docs:`, `test:`, `chore:`.

## Gotchas

- **Token encryption required** — `GDRIVE_TOKEN_ENCRYPTION_KEY` must be set or token storage fails. Generate with `openssl rand -base64 32`
- **Key rotation** — Supports V1-V4 keys via env vars. Set `GDRIVE_TOKEN_CURRENT_KEY_VERSION` when rotating
- **`isolated-vm` build deps** — Requires `python3`, `make`, `g++` at npm install time (handled in Dockerfile)
- **Server version stale** — `index.ts:388` hardcodes version string; must be manually updated alongside `package.json`
- **Redis optional** — Server degrades gracefully without Redis. No errors, just no caching
- **Calendar contacts** — Set `PAI_CONTACTS_PATH` to resolve names like "Mary" to email addresses; without it, all attendees must be email addresses
- **ES modules** — Project uses ES2022 modules. Imports need `.js` extensions in TypeScript for Node resolution
- **Test files excluded from Docker** — `.dockerignore` and `tsconfig.json` both exclude `__tests__/` from production builds

## Claude Code Behavior

**Run commands directly.** Do not ask the user to run builds, tests, or verification commands.

When issues are completed, mark them DONE using the Linear MCP.

## Development Notes

- TypeScript ES2022, compiled to `dist/` with shx chmod for shebang
- Node.js 18+ required
- 10+ GitHub Actions workflows (CI, security scanning, performance, deployment)
- Jest for testing with coverage thresholds
