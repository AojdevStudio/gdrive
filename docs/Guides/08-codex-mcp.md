# Codex MCP Integration Guide

This guide connects Codex to **Google Workspace MCP** over the remote Cloudflare Workers HTTP endpoint.

## Supported Runtime

Use the deployed Worker endpoint:

```text
https://your-worker.workers.dev/mcp
```

Local stdio, local HTTP, Docker, and local bootstrap flows are not supported MCP server modes.

## Auth Boundary

There are two separate auth surfaces:

- Codex authenticates to Google Workspace MCP with static bearer auth when the Worker requires it.
- Google Workspace MCP authenticates to Google Workspace APIs with Google OAuth.

This server is not an OAuth authorization server. `MCP_AUTHORIZATION_SERVER_URL` only advertises an external authorization server in protected-resource metadata; it does not make this server validate external OAuth tokens.

## Add The Remote Server To Codex

Use the server name `google-workspace` so agents understand this is not Drive-only:

```bash
export GOOGLE_WORKSPACE_MCP_TOKEN="replace-with-the-worker-token"

codex mcp add google-workspace \
  --url https://your-worker.workers.dev/mcp \
  --bearer-token-env-var GOOGLE_WORKSPACE_MCP_TOKEN

codex mcp get google-workspace
```

Start a fresh Codex session after adding or changing MCP server config.

If the Worker does not require bearer auth, omit `--bearer-token-env-var`.

## Expected Tools

The expected MCP tools are:

- `search`
- `execute`

Use `search` to discover Drive, Sheets, Forms, Docs, Gmail, and Calendar operations before calling `execute`.

## External Authorization Server Metadata

Set `MCP_AUTHORIZATION_SERVER_URL` only when a real external OAuth authorization server exists for MCP client authentication:

```bash
MCP_AUTHORIZATION_SERVER_URL=https://auth.example.com
```

When set, `GET /.well-known/oauth-protected-resource` includes that URL in `authorization_servers`. This is metadata only. The MCP server still validates static bearer auth for requests to `POST /mcp`.

Do not set this variable to a Google OAuth URL. Google OAuth authorizes this server to call Google APIs; it is not Codex-to-MCP authentication.

## Troubleshooting

### `Auth unsupported`

Codex could not match the server's advertised auth shape to a supported login flow. Use `--bearer-token-env-var` unless an external authorization server has been designed and configured.

### `401 Unauthorized`

The bearer token is missing or wrong. Confirm:

```bash
test -n "$GOOGLE_WORKSPACE_MCP_TOKEN" && echo "GOOGLE_WORKSPACE_MCP_TOKEN is set" || echo "GOOGLE_WORKSPACE_MCP_TOKEN is missing"
codex mcp get google-workspace
```

The Codex token env var value must match the Worker's `MCP_BEARER_TOKEN`.

### Tools Do Not Appear

Check the configured MCP server:

```bash
codex mcp get google-workspace
```

Then start a fresh Codex session.
