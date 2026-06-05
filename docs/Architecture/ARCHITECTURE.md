# AOJ Workbench Architecture

AOJ Workbench is a private, remote-only Cloudflare Workers MCP server for knowledge-work tools. Its target provider layer is the Composio SDK. The current direct Google Workspace implementation is legacy migration scaffolding.

## Runtime Boundary

Supported runtime:

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

Unsupported runtime modes:

- local stdio
- local HTTP
- Docker as an MCP client runtime
- local bootstrap flows as a client setup requirement

## Entry Point

`worker.ts` is the supported runtime entry point. It:

- handles `POST /mcp`
- validates MCP bearer auth when configured
- routes provider discovery and execution through the provider layer
- creates the configured MCP server
- serves requests through `WebStandardStreamableHTTPServerTransport`

## Tools

The MCP surface is intentionally small:

| Tool | Purpose |
|------|---------|
| `search` | Discover provider/toolkit capabilities, schemas, auth status, and execution guidance |
| `execute` | Run a selected provider toolkit operation |

The Composio-native target wraps Composio session meta-tool behavior behind these two AOJ Workbench tools rather than exposing every provider action as a separate MCP tool.

The existing Drive, Sheets, Forms, Docs, Gmail, and Calendar operations are legacy direct-Google paths. Remove them slice-by-slice after equivalent Composio-backed behavior is green.

## State

Persistent runtime state belongs in Cloudflare services, primarily Workers KV. Local files are not part of the supported MCP runtime.

## Auth Boundaries

- MCP client authentication protects access to the Worker endpoint.
- Provider authorization belongs to Composio managed auth.
- This server is not an MCP OAuth authorization server.

See [MCP Client Auth Boundary](../adr/0001-mcp-client-auth-boundary.md).
