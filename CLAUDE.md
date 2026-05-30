# CLAUDE.md

## Project Overview

**AOJ Workbench** is a remote-only MCP server for Google Workspace APIs: Drive, Sheets, Forms, Docs, Gmail, and Calendar.

Use the canonical product name **AOJ Workbench** in docs, issues, prompts, and client-facing prose. Google Workspace is the upstream API surface, not the product name. Keep legacy names only for existing package, repo, worker, environment, or migration-sensitive identifiers.

**Runtime boundary:** Cloudflare Workers Streamable HTTP only. MCP clients connect to the deployed `/mcp` URL. Local stdio, local HTTP, Docker, and local bootstrap flows are not supported MCP server modes.

**Linear:** Team "Google Drive" (ID: `9fd7c68d-cf3f-4ac0-a0d7-42605c079da1`) — issues prefixed `GDRIVE-`

## Commands

```bash
# Contributor checks
npm test
npm run test:coverage
npm run test:integration
npm run test:e2e
npm run type-check
npm run lint

# Worker development/deployment
npm run build:worker
npm run dev:worker
npm run deploy:worker

# Changelog
./scripts/changelog/update-changelog.py --auto
```

Do not document or recommend `node ./dist/index.js`, stdio transport, local HTTP transport, or Docker as MCP client connection paths.

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

The Workspace surface includes:

| Service | Operations |
|---------|------------|
| Drive | search, enhancedSearch, read, createFile, createFolder, updateFile, batchOperations |
| Sheets | listSheets, readSheet, createSheet, renameSheet, deleteSheet, updateCells, updateFormula, formatCells, addConditionalFormat, freezeRowsColumns, setColumnWidth, appendRows |
| Forms | createForm, readForm, addQuestion, listResponses |
| Docs | createDocument, insertText, replaceText, applyTextStyle, insertTable |
| Gmail | listMessages, listThreads, getMessage, getThread, searchMessages, createDraft, sendMessage, sendDraft, listLabels, createLabel, modifyLabels, listAttachments, downloadAttachment, readAttachmentText |
| Calendar | listCalendars, getCalendar, listEvents, getEvent, createEvent, updateEvent, deleteEvent, quickAdd, checkFreeBusy |

## Environment Variables

Worker-facing variables:

| Variable | Purpose |
|----------|---------|
| `GDRIVE_KV` | Cloudflare KV binding for token/cache state |
| `GDRIVE_CLIENT_ID` | Google OAuth client ID |
| `GDRIVE_CLIENT_SECRET` | Google OAuth client secret |
| `GDRIVE_TOKEN_ENCRYPTION_KEY` | Token encryption key |
| `MCP_BEARER_TOKEN` | Static bearer token for MCP client-to-server auth |
| `MCP_ALLOWED_ORIGINS` | Optional origin allowlist |
| `MCP_AUTHORIZATION_SERVER_URL` | Metadata-only external OAuth authorization server URL for MCP clients |
| `LOG_LEVEL` | Worker log level hint |

## Gotchas

- **Remote only** — MCP clients must use the deployed Worker URL. Do not reintroduce stdio, local HTTP, or Docker connection docs.
- **Name clarity** — use **AOJ Workbench** for the product and Google Workspace API surface for the upstream provider capabilities.
- **Auth boundary** — MCP client auth uses `MCP_BEARER_TOKEN`; Google OAuth remains server-to-Google authorization. This server is not an OAuth authorization server.
- **Tool schema compatibility** — advertised top-level tool input schemas must be plain `type: "object"` schemas with no root `oneOf`, `anyOf`, or `allOf`.
- **Cloudflare state** — persistent runtime state belongs in Cloudflare services such as Workers KV, not local files.

## Claude Code Behavior

Run inspection, tests, and verification commands directly. Do not ask the user to run local commands.

When issues are completed, mark them DONE using the Linear MCP.
