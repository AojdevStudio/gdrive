# AOJ Workbench Documentation

AOJ Workbench is a remote-only MCP server for Drive, Sheets, Forms, Docs, Gmail, and Calendar. Google Workspace is the upstream API surface, not the product name.

## Runtime Boundary

The only supported MCP runtime is the deployed Cloudflare Workers HTTP endpoint:

```text
https://your-worker.workers.dev/mcp
```

Do not use legacy docs that describe local stdio, local HTTP, Docker, or local bootstrap flows as current setup instructions. Those paths are unsupported for MCP clients.

## Start Here

1. [Codex MCP Integration](./Guides/08-codex-mcp.md) — connect Codex to the remote Worker URL.
2. [MCP Client Auth Boundary](./adr/0001-mcp-client-auth-boundary.md) — understand client auth vs Google OAuth.
3. [Gmail Attachment Workflow](./Guides/09-gmail-attachment-workflow.md) — search, list metadata, download raw content, and read decoded text.
4. [Examples](./Examples/) — SDK-style `search` and `execute` usage patterns.
5. [Architecture](./Architecture/ARCHITECTURE.md) — implementation details for contributors.

## Supported Services

| Service | What agents can do |
|---------|--------------------|
| Drive | Search, read, create, update, and batch file operations |
| Sheets | Read, write, format, append, and manage spreadsheet tabs |
| Forms | Create forms, add questions, and read responses |
| Docs | Create documents, insert/replace text, apply styles, and insert tables |
| Gmail | List, search, read, draft, send, manage labels, and read supported attachment text |
| Calendar | List calendars/events, create/update/delete events, quickAdd, and free/busy checks |

## Current MCP Tools

v4 exposes two tools:

- `search` — discover services, operations, signatures, parameters, and examples.
- `execute` — run a specific Google Workspace operation.

Older operation-based tool names and local stdio examples are legacy material.

## Legacy Documentation

Some historical docs remain for migration context. Treat these as archived unless they explicitly say they are remote Cloudflare Workers instructions:

- Docker deployment guides
- Local authentication flow guides
- Redis/local cache guides
- v1/v2 migration guides
- Local Claude Desktop stdio examples

When updating docs, prefer **AOJ Workbench** as the product name. Use Google Workspace only for the upstream API surface, and keep legacy names only for existing package, repo, worker, environment, or migration-sensitive identifiers.
