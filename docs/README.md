# AOJ Workbench Documentation

AOJ Workbench is a private, remote-only knowledge-work MCP surface. Agents connect once, and AOJ Workbench routes provider discovery and execution through the Composio SDK native provider layer.

## Runtime Boundary

The only supported MCP runtime is the deployed Cloudflare Workers HTTP endpoint:

```text
https://your-worker.workers.dev/mcp
```

Do not use legacy docs that describe local stdio, local HTTP, Docker, or local bootstrap flows as current setup instructions. Those paths are unsupported for MCP clients.

## Start Here

1. [Codex MCP Integration](./Guides/08-codex-mcp.md) — connect Codex to the remote Worker URL.
2. [Composio Native Provider](./Guides/10-composio-native-provider.md) — understand the target provider model and migration rules.
3. [MCP Client Auth Boundary](./adr/0001-mcp-client-auth-boundary.md) — understand client auth vs provider authorization.
4. [Gmail Attachment Workflow](./Guides/09-gmail-attachment-workflow.md) — search, list metadata, download raw content, and read decoded text in the current legacy provider.
5. [Examples](./Examples/) — SDK-style `search` and `execute` usage patterns.
6. [Architecture](./Architecture/ARCHITECTURE.md) — implementation details for contributors.

## Provider Model

Composio is the native provider layer. Google Workspace, Gmail, Outlook, Notion, Stripe, YouTube, and other selected services are provider toolkits behind that layer.

The current Drive, Sheets, Forms, Docs, Gmail, and Calendar implementation is the legacy direct-Google provider path. It should be removed through provider replacement slices after equivalent Composio-backed behavior is proven.

Current legacy direct-Google capabilities include:

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

- `search` — discover provider/toolkit capabilities, schemas, auth status, and execution guidance.
- `execute` — run a selected provider toolkit operation.

Older operation-based tool names and local stdio examples are legacy material.

## Legacy Documentation

Some historical docs remain for migration context. Treat these as archived unless they explicitly say they are remote Cloudflare Workers instructions:

- Docker deployment guides
- Local authentication flow guides
- Redis/local cache guides
- v1/v2 migration guides
- Local Claude Desktop stdio examples

When updating docs, prefer **AOJ Workbench** as the product name. Use Composio for the target native provider layer. Use Google Workspace only for current legacy provider capabilities or provider toolkit references, and keep legacy names only for existing package, repo, worker, environment, or migration-sensitive identifiers.
