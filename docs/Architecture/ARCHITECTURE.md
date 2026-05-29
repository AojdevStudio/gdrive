# Google Workspace MCP Architecture

Google Workspace MCP is a remote-only Cloudflare Workers MCP server for Drive, Sheets, Forms, Docs, Gmail, and Calendar.

## Runtime Boundary

Supported runtime:

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

Unsupported runtime modes:

- local stdio
- local HTTP
- Docker as an MCP client runtime
- local bootstrap flows as a client setup requirement

## Entry Point

`worker.ts` is the supported runtime entry point. It:

- handles `POST /mcp`
- validates MCP bearer auth when configured
- resolves Google OAuth access tokens through Worker-compatible auth
- creates the configured MCP server
- serves requests through `WebStandardStreamableHTTPServerTransport`

## Tools

The MCP surface is intentionally small:

| Tool | Purpose |
|------|---------|
| `search` | Discover Google Workspace services, operations, signatures, parameters, and examples |
| `execute` | Run a specific Google Workspace operation |

The service surface behind those tools covers:

- Drive
- Sheets
- Forms
- Docs
- Gmail
- Calendar

## State

Persistent runtime state belongs in Cloudflare services, primarily Workers KV. Local files are not part of the supported MCP runtime.

## Auth Boundaries

- MCP client authentication protects access to the Worker endpoint.
- Google OAuth authorizes the Worker to call Google Workspace APIs.
- This server is not an MCP OAuth authorization server.

See [MCP Client Auth Boundary](../adr/0001-mcp-client-auth-boundary.md).
