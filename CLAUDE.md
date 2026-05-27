# CLAUDE.md

## Project Overview

**Google Workspace MCP** is a remote-only MCP server for Google Workspace: Drive, Sheets, Forms, Docs, Gmail, and Calendar.

Use the canonical name **Google Workspace MCP** in docs, issues, prompts, and client configuration examples. Avoid “gdrive MCP” or “Google Drive MCP” unless referring to legacy package/repo names.

**Runtime boundary:** Cloudflare Workers Streamable HTTP only. MCP clients connect to the deployed `/mcp` URL. Local stdio, local HTTP, Docker, and local bootstrap flows are not supported MCP server modes.

**Linear:** Team "Google Drive" (ID: `9fd7c68d-cf3f-4ac0-a0d7-42605c079da1`) — issues prefixed `GDRIVE-`

- Cloudflare Workers Streamable HTTP runtime
- Two MCP tools: `search` and `execute`
- Encrypted Google OAuth tokens in Workers KV
- Remote setup/status routes for Google OAuth recovery

**Reference:** [how2mcp](https://github.com/Rixmerz/HOW2MCP.git) — definitive MCP implementation guide. Follow its **operation-based tool pattern** (one tool with `operation` parameter, NOT separate tools per action). See `MCP-DOCS/` for architecture guides and `MCP_EXAMPLE_PROJECT/` for reference implementation.

## Commands

```bash
# Build & Worker Dev
npm run build          # Compile TypeScript
npm run build:worker   # Compile Worker-targeted TypeScript
npm run dev:worker     # Run Wrangler Worker dev server
npm run deploy:worker  # Deploy Worker

# Testing
npm test               # Run all unit tests
npm run test:coverage  # Tests with coverage report
npm run test:integration  # Integration tests
npm run test:e2e       # End-to-end tests
npm run type-check     # TypeScript type checking (no emit)
npm run lint           # ESLint

# Changelog
./scripts/changelog/update-changelog.py --auto
```

Do not document or recommend `node ./dist/index.js`, stdio transport, local HTTP transport, Docker, or local OAuth bootstrap as MCP client connection paths.

## Architecture

### Remote MCP Runtime

```text
MCP client
  |
  | Streamable HTTP
  v
Cloudflare Worker /mcp
  |
  | Google OAuth token resolution and refresh
  v
Google Workspace APIs
```

`worker.ts` is the supported runtime entry point. It uses `WebStandardStreamableHTTPServerTransport` and creates the configured MCP server per request.

### MCP Tools

v4 exposes exactly two MCP tools:

| Tool | Purpose |
|------|---------|
| `search` | Discover Google Workspace services, operations, signatures, parameters, and examples |
| `execute` | Run a specific Google Workspace operation through the SDK-style runtime |

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
| `PAI_CONTACTS_PATH` | No | Contact resolution for Calendar (name → email) |
| `LOG_LEVEL` | No | Worker log level hint |
| `MCP_BEARER_TOKEN` | Yes | Static bearer token for MCP client-to-server auth |
| `MCP_SETUP_TOKEN` | Yes | Separate bearer token for remote setup/status routes |
| `MCP_AUTHORIZATION_SERVER_URL` | No | Metadata-only external OAuth authorization server URL for MCP clients |

## Unsupported Runtime Paths

Do not use Docker, local stdio, local HTTP, or local OAuth bootstrap flows as MCP runtime paths.

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
- **Server version stale** — `src/server/factory.ts` hardcodes version string; update it alongside `package.json`
- **Codex auth boundary** — Codex-to-MCP auth uses `MCP_BEARER_TOKEN`; Google OAuth remains server-to-Google auth. Do not make this server an OAuth authorization server.
- **Calendar contacts** — Set `PAI_CONTACTS_PATH` to resolve names like "Mary" to email addresses; without it, all attendees must be email addresses
- **ES modules** — Project uses ES2022 modules. Imports need `.js` extensions in TypeScript for Node resolution

## Claude Code Behavior

**Run commands directly.** Do not ask the user to run builds, tests, or verification commands.

When issues are completed, mark them DONE using the Linear MCP.

## Development Notes

- TypeScript ES2022, compiled to `dist/` with shx chmod for shebang
- Node.js 18+ required
- 10+ GitHub Actions workflows (CI, security scanning, performance, deployment)
- Jest for testing with coverage thresholds
