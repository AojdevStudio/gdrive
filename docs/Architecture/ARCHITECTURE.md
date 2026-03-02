# Google Drive MCP Server Architecture

## Overview

This repository implements a v4 MCP server for Google Workspace with a **Code Mode** runtime:

- The server exposes exactly **2 MCP tools**: `search` and `execute`
- Workspace operations are executed through `sdk.*` in sandboxed JavaScript
- The SDK surface includes **47 operations** across 6 services:
  - `drive` (7), `sheets` (12), `forms` (4), `docs` (5), `gmail` (10), `calendar` (9)

The architecture is intentionally split between:

1. **Discovery** (`search`) to find operation signatures and examples
2. **Execution** (`execute`) to run agent-authored code with `sdk` access

## High-Level Runtime

```text
MCP Client
  -> tools/list
     -> [search, execute]
  -> tools/call(search)
     -> SDK spec subset from src/sdk/spec.ts
  -> tools/call(execute)
     -> NodeSandbox (vm context)
     -> sdk.<service>.<operation>(...)
     -> Google APIs
     -> { result, logs }
```

## Core Components

### Entry and CLI

- `index.ts` is the CLI entry point
- Supported commands:
  - `node ./dist/index.js` (start stdio MCP server)
  - `node ./dist/index.js auth`
  - `node ./dist/index.js health`
  - `node ./dist/index.js rotate-key`
  - `node ./dist/index.js verify-keys`
  - `node ./dist/index.js migrate-tokens`

### Transport and Server Wiring

- `src/server/transports/stdio.ts`
  - loads OAuth config
  - initializes `AuthManager`
  - creates logger/cache/perf monitor
  - connects `StdioServerTransport`
- `src/server/factory.ts`
  - registers `search` and `execute`
  - creates Google API clients (Drive, Sheets, Forms, Docs, Gmail, Calendar)
  - builds runtime context for SDK execution

### SDK Runtime

- `src/sdk/spec.ts` contains static operation metadata used by `search`
- `src/sdk/runtime.ts` maps runtime context to `sdk.*` methods
- `src/sdk/sandbox-node.ts` runs user code in a Node `vm` context
  - blocked globals include `process`, `require`, timers, and `fetch`
  - `console.*` output is captured and returned as `logs`

### Service Modules

All operation implementations live under `src/modules/`:

- `src/modules/drive`
- `src/modules/sheets`
- `src/modules/forms`
- `src/modules/docs`
- `src/modules/gmail`
- `src/modules/calendar`

## Tool Contracts

### `search`

Purpose: discover available services and operations before execution.

Input shape:

```json
{
  "service": "drive | sheets | forms | docs | gmail | calendar (optional)",
  "operation": "string (optional)"
}
```

Behavior:

- no params -> returns service -> operation summary
- `service` -> returns operations for that service
- `service` + `operation` -> returns metadata for one operation

### `execute`

Purpose: run JavaScript with `sdk` in the sandbox.

Input shape:

```json
{
  "code": "JavaScript string"
}
```

Output shape:

```json
{
  "result": "any returned value",
  "logs": ["captured console output"]
}
```

If execution fails, tool returns an error payload with captured logs.

## SDK Surface

### Drive (7)

`search`, `enhancedSearch`, `read`, `createFile`, `createFolder`, `updateFile`, `batchOperations`

### Sheets (12)

`listSheets`, `readSheet`, `createSheet`, `renameSheet`, `deleteSheet`, `updateCells`, `updateFormula`, `formatCells`, `addConditionalFormat`, `freezeRowsColumns`, `setColumnWidth`, `appendRows`

### Forms (4)

`createForm`, `readForm`, `addQuestion`, `listResponses`

### Docs (5)

`createDocument`, `insertText`, `replaceText`, `applyTextStyle`, `insertTable`

### Gmail (10)

`listMessages`, `listThreads`, `getMessage`, `getThread`, `searchMessages`, `createDraft`, `sendMessage`, `sendDraft`, `listLabels`, `modifyLabels`

### Calendar (9)

`listCalendars`, `getCalendar`, `listEvents`, `getEvent`, `createEvent`, `updateEvent`, `deleteEvent`, `quickAdd`, `checkFreeBusy`

## Authentication and Token Lifecycle

Auth stack:

- `src/auth/AuthManager.ts`
- `src/auth/TokenManager.ts`
- `src/auth/KeyRotationManager.ts`

Key characteristics:

- OAuth tokens are encrypted at rest
- key rotation supports versioned keys (`v1`..`v4` patterns via env vars)
- health command validates token state and refresh readiness
- auth flow stores tokens for non-interactive server startup

Required env:

- `GDRIVE_TOKEN_ENCRYPTION_KEY`

## OAuth Scopes

The stdio transport requests these scopes:

- `https://www.googleapis.com/auth/drive`
- `https://www.googleapis.com/auth/spreadsheets`
- `https://www.googleapis.com/auth/documents`
- `https://www.googleapis.com/auth/forms`
- `https://www.googleapis.com/auth/script.projects.readonly`
- `https://www.googleapis.com/auth/gmail.readonly`
- `https://www.googleapis.com/auth/gmail.send`
- `https://www.googleapis.com/auth/gmail.compose`
- `https://www.googleapis.com/auth/gmail.modify`
- `https://www.googleapis.com/auth/calendar.readonly`
- `https://www.googleapis.com/auth/calendar.events`

Note: Apps Script scope is requested, but there is no exposed `sdk.script` service in the current v4 tool surface.

## Caching, Logging, and Health

### Redis Cache

- optional cache via `REDIS_URL`
- graceful fallback when Redis is unavailable
- default TTL: 300 seconds

### Logging

- Winston structured logging
- file logs and console transport
- configurable via `LOG_LEVEL`

### Health Check

- `node ./dist/index.js health`
- Dockerfile health check uses `node dist/health-check.js`
- docker-compose health check uses `node dist/index.js health`

## Deployment Architecture

### Runtime Requirements

- Node.js `>=22.0.0`
- TypeScript build output in `dist/`

### Container Runtime

- `Dockerfile` base image: `node:22-slim`
- build installs native deps needed by dependencies
- credentials mounted at `/credentials`
- logs mounted at `/app/logs`

See `docs/Deployment/DOCKER.md` for complete deployment steps.

## Project Structure (Relevant Paths)

```text
index.ts
src/
  auth/
  modules/
    drive/
    sheets/
    forms/
    docs/
    gmail/
    calendar/
  sdk/
    spec.ts
    runtime.ts
    sandbox-node.ts
  server/
    factory.ts
    bootstrap.ts
    transports/stdio.ts
  health-check.ts
Dockerfile
docker-compose.yml
```

## Design Principles

- Keep MCP surface minimal (`search`, `execute`)
- Keep business logic in modules, not in transport handlers
- Make operation discovery deterministic via static spec metadata
- Prefer explicit, typed operation signatures and stable error messages
- Keep deployment paths and env vars aligned across docs and runtime

