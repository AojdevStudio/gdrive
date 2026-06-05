# CLAUDE.md

## Project Overview

**AOJ Workbench** is a private, remote-only knowledge-work MCP surface. The target provider model uses the Composio SDK as the native provider layer for external SaaS tools. The current direct Google Workspace implementation is legacy migration scaffolding.

Use the canonical name **AOJ Workbench** in docs, issues, prompts, and client configuration examples. Avoid “Google Workspace MCP,” “gdrive MCP,” or “Google Drive MCP” unless referring to legacy package/repo names.

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
  | Composio SDK sessions and managed auth
  v
Provider toolkits
```

`worker.ts` is the supported runtime entry point. It uses `WebStandardStreamableHTTPServerTransport` and creates the configured MCP server per request.

### MCP Tools

v4 exposes exactly two MCP tools:

| Tool | Purpose |
|------|---------|
| `search` | Discover provider/toolkit capabilities, schemas, auth status, and execution guidance |
| `execute` | Run a selected provider toolkit operation through the provider runtime |

Current legacy Workspace operations exist only while provider replacement slices migrate them to Composio-backed execution:

| Service | Operations |
|---------|------------|
| Drive | search, enhancedSearch, read, createFile, createFolder, updateFile, batchOperations |
| Sheets | listSheets, readSheet, createSheet, renameSheet, deleteSheet, updateCells, updateFormula, formatCells, addConditionalFormat, freezeRowsColumns, setColumnWidth, appendRows |
| Forms | createForm, readForm, addQuestion, listResponses |
| Docs | createDocument, insertText, replaceText, applyTextStyle, insertTable |
| Gmail | listMessages, listThreads, getMessage, getThread, searchMessages, createDraft, sendMessage, sendDraft, listLabels, createLabel, modifyLabels, listAttachments, downloadAttachment, readAttachmentText, sendWithAttachments |
| Calendar | listCalendars, getCalendar, listEvents, getEvent, createEvent, updateEvent, deleteEvent, quickAdd, checkFreeBusy |

## Environment Variables

Worker-facing variables:

| Variable | Purpose |
|----------|---------|
| `COMPOSIO_API_KEY` | Composio SDK/API key for the native provider layer |
| `AOJ_WORKBENCH_USER_ID` | Stable Composio user ID for connected accounts |
| `MCP_BEARER_TOKEN` | Static bearer token for MCP client-to-server auth |
| `MCP_ALLOWED_ORIGINS` | Optional origin allowlist |
| `MCP_AUTHORIZATION_SERVER_URL` | Metadata-only external OAuth authorization server URL for MCP clients |
| `LOG_LEVEL` | Worker log level hint |

Legacy direct-Google variables such as `GDRIVE_KV`, `GDRIVE_CLIENT_ID`, `GDRIVE_CLIENT_SECRET`, and `GDRIVE_TOKEN_ENCRYPTION_KEY` remain only until provider replacement slices remove the matching code.

## Gotchas

- **Remote only** — MCP clients must use the deployed Worker URL. Do not reintroduce stdio, local HTTP, or Docker connection docs.
- **Provider clarity** — Composio is the native provider layer; direct Google code is legacy migration scaffolding.
- **Auth boundary** — MCP client auth uses `MCP_BEARER_TOKEN`; provider auth belongs to Composio managed auth. This server is not an OAuth authorization server.
- **Tool schema compatibility** — advertised top-level tool input schemas must be plain `type: "object"` schemas with no root `oneOf`, `anyOf`, or `allOf`.
- **Cloudflare state** — persistent runtime state belongs in Cloudflare services such as Workers KV, not local files.

## Claude Code Behavior

Run inspection, tests, and verification commands directly. Do not ask the user to run local commands.

When issues are completed, mark them DONE using the Linear MCP.
