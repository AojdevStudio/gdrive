# Google Workspace MCP Architecture

## Overview

This repository implements a v4 remote MCP server for Google Workspace on Cloudflare Workers:

- The server exposes exactly **2 MCP tools**: `search` and `execute`
- Workspace operations are executed through structured `service`, `operation`, and `args` inputs
- The SDK surface includes **47 operations** across 6 services:
  - `drive` (7), `sheets` (12), `forms` (4), `docs` (5), `gmail` (10), `calendar` (9)

The architecture is intentionally split between:

1. **Discovery** (`search`) to find operation signatures and examples
2. **Execution** (`execute`) to call a specific operation through the Worker runtime

## High-Level Runtime

```text
MCP Client
  -> Cloudflare Worker /mcp
  -> tools/list
     -> [search, execute]
  -> tools/call(search)
     -> SDK spec subset from src/sdk/spec.ts
  -> tools/call(execute)
     -> service.operation(args)
     -> Google APIs
     -> { result }
```

## Core Components

### Worker Entry

- `worker.ts` is the supported runtime entry point.
- `index.ts` intentionally fails local runtime attempts and points operators to the deployed Worker.
- MCP clients must connect to the deployed Worker `/mcp` URL.

### Transport and Server Wiring

- `worker.ts`
  - handles Streamable HTTP MCP requests at `/mcp`
  - validates MCP bearer auth
  - resolves and refreshes encrypted Google OAuth tokens from Workers KV
- `src/server/factory.ts`
  - registers `search` and `execute`
  - creates Google API clients (Drive, Sheets, Forms, Docs, Gmail, Calendar)
  - builds runtime context for SDK execution

### SDK Runtime

- `src/sdk/spec.ts` contains static operation metadata used by `search`
- `src/sdk/runtime.ts` maps runtime context to `sdk.*` methods

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

Purpose: run a specific Google Workspace operation.

Input shape:

```json
{
  "service": "drive",
  "operation": "search",
  "args": {
    "query": "budget"
  }
}
```

Output shape:

```json
{
  "result": "operation return value"
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

- `src/auth/workers-oauth.ts`
- `src/auth/workers-auth.ts`
- `src/storage/kv-store.ts`

Key characteristics:

- OAuth tokens are encrypted at rest
- `/setup/google/start` begins Google OAuth with one-time state in Workers KV
- `/setup/google/callback` exchanges the code and stores encrypted tokens in Workers KV
- `/setup/status` reports token state and remote recovery hints

Required env:

- `GDRIVE_CLIENT_ID`
- `GDRIVE_CLIENT_SECRET`
- `GDRIVE_TOKEN_ENCRYPTION_KEY`
- `MCP_BEARER_TOKEN`
- `MCP_SETUP_TOKEN`

## OAuth Scopes

The remote OAuth setup handler requests these scopes:

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

### Logging

- Worker logging goes through `console.*`
- configurable via `LOG_LEVEL`

### Health Check

- Use `GET /setup/status` with `MCP_SETUP_TOKEN` to inspect remote Google OAuth state.
- Use `POST /mcp` with `MCP_BEARER_TOKEN` for MCP requests.

## Deployment Architecture

### Runtime Requirements

- Cloudflare Workers
- Workers KV binding `GDRIVE_KV`
- TypeScript Worker build output in `dist-worker/`

### Unsupported Runtime Paths

- Local stdio, local HTTP, Docker, and local OAuth bootstrap are not supported MCP runtime paths.

## Project Structure (Relevant Paths)

```text
index.ts
worker.ts
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
  server/
    factory.ts
    bootstrap.ts
```

## Design Principles

- Keep MCP surface minimal (`search`, `execute`)
- Keep business logic in modules, not in transport handlers
- Make operation discovery deterministic via static spec metadata
- Prefer explicit, typed operation signatures and stable error messages
- Keep deployment paths and env vars aligned across docs and runtime
