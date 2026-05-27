# Codex MCP Integration Guide

This guide configures Codex to use Google Workspace MCP through the deployed Cloudflare Workers `/mcp` endpoint. Local stdio and local HTTP server modes are not supported.

## Auth Boundary

There are two separate auth surfaces:

- Codex authenticates to this MCP server with static bearer auth.
- This MCP server authenticates to Google Workspace through the remote Worker setup flow.

This server is not an OAuth authorization server. `MCP_AUTHORIZATION_SERVER_URL` only advertises an external authorization server in protected-resource metadata; it does not make this server validate external OAuth tokens.

## Prerequisites

- Deployed Worker URL, for example `https://your-worker.workers.dev`.
- Worker secret `MCP_BEARER_TOKEN` configured.
- Worker secret `MCP_SETUP_TOKEN` configured.
- Remote Google OAuth setup completed through `/setup/google/start`.
- Codex CLI installed and working.

Verify remote Google OAuth state:

```bash
curl -H "Authorization: Bearer $MCP_SETUP_TOKEN" \
  https://your-worker.workers.dev/setup/status
```

## Add The Server To Codex

Codex supports bearer tokens for Streamable HTTP MCP servers through an environment variable:

```bash
export GDRIVE_MCP_TOKEN="replace-with-the-worker-mcp-token"

codex mcp add google-workspace \
  --url https://your-worker.workers.dev/mcp \
  --bearer-token-env-var GDRIVE_MCP_TOKEN

codex mcp get google-workspace
```

Start a fresh Codex session after adding or changing MCP server config. The expected tools are `search` and `execute`.

## External Authorization Server Metadata

Set this only when a real external OAuth authorization server exists for MCP client authentication:

```bash
MCP_AUTHORIZATION_SERVER_URL=https://auth.example.com
```

When set, `GET /.well-known/oauth-protected-resource` includes that URL in `authorization_servers`. This is metadata only. The MCP server still validates static bearer auth for requests to `POST /mcp`.

Do not set this variable to a Google OAuth URL. Google OAuth authorizes this server to call Google APIs; it is not Codex-to-MCP authentication.

## Troubleshooting

## `Auth unsupported`

Codex could not match the server's advertised auth shape to a supported login flow. For this server, use `--bearer-token-env-var` unless an external authorization server has been designed and configured.

## `401 Unauthorized`

The bearer token is missing or wrong. Confirm:

```bash
echo "$GDRIVE_MCP_TOKEN"
codex mcp get google-workspace
```

The Codex token env var value must match the Worker's `MCP_BEARER_TOKEN`.

## Missing Google OAuth State

Use the remote setup and status routes:

```bash
curl -H "Authorization: Bearer $MCP_SETUP_TOKEN" \
  https://your-worker.workers.dev/setup/status

curl -i -H "Authorization: Bearer $MCP_SETUP_TOKEN" \
  https://your-worker.workers.dev/setup/google/start
```
