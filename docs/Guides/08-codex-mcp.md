# Codex MCP Integration Guide

This guide configures Codex to use the Google Workspace MCP server over Streamable HTTP.

## Auth Boundary

There are two separate auth surfaces:

- Codex authenticates to this MCP server with static bearer auth.
- This MCP server authenticates to Google Workspace with the existing Google OAuth flow.

This server is not an OAuth authorization server. `MCP_AUTHORIZATION_SERVER_URL` only advertises an external authorization server in protected-resource metadata; it does not make this server validate external OAuth tokens.

## Prerequisites

- Node.js 22 available for this project.
- Project dependencies installed and built.
- Google OAuth keys available through `GDRIVE_OAUTH_PATH` or `credentials/gcp-oauth.keys.json`.
- `GDRIVE_TOKEN_ENCRYPTION_KEY` set to a 32-byte base64 key.
- `node ./dist/index.js auth` completed successfully.
- `MCP_BEARER_TOKEN` set for Codex-to-MCP auth.
- Codex CLI installed and working.

## Build And Authenticate

```bash
npm run build
node ./dist/index.js auth
node ./dist/index.js health
```

Expected: `health` returns JSON with a healthy or actionable token state.

## Start The Local HTTP Server

```bash
GDRIVE_TOKEN_ENCRYPTION_KEY="$GDRIVE_TOKEN_ENCRYPTION_KEY" \
MCP_BEARER_TOKEN="$GDRIVE_MCP_TOKEN" \
node ./dist/index.js http --host 127.0.0.1 --port 8788
```

The MCP endpoint is:

```text
http://127.0.0.1:8788/mcp
```

Useful unauthenticated probes:

```bash
curl -i http://127.0.0.1:8788/
curl -i http://127.0.0.1:8788/healthz
curl -i http://127.0.0.1:8788/.well-known/oauth-protected-resource
```

`POST /mcp` without bearer auth should return `401` and `WWW-Authenticate: Bearer`.

## Add The Server To Codex

Codex CLI 0.132.0 supports bearer tokens for Streamable HTTP MCP servers through an environment variable:

```bash
export GDRIVE_MCP_TOKEN="replace-with-the-same-token-used-by-the-server"

codex mcp add gdrive \
  --url http://127.0.0.1:8788/mcp \
  --bearer-token-env-var GDRIVE_MCP_TOKEN

codex mcp get gdrive
```

Start a fresh Codex session after adding or changing MCP server config.

## Cloudflare Worker URL

For a deployed Worker, use the Worker `/mcp` URL and the same bearer-token configuration:

```bash
export GDRIVE_MCP_TOKEN="replace-with-the-worker-token"

codex mcp add gdrive \
  --url https://<worker-host>/mcp \
  --bearer-token-env-var GDRIVE_MCP_TOKEN
```

The Worker must have `MCP_BEARER_TOKEN` configured as a secret.

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
codex mcp get gdrive
```

The Codex token env var value must match the server's `MCP_BEARER_TOKEN`.

## `Authentication required. Run node ./dist/index.js auth first.`

Google OAuth tokens are missing. Run:

```bash
node ./dist/index.js auth
```

## Tools Do Not Appear

Check the configured MCP server:

```bash
codex mcp get gdrive
```

Then start a fresh Codex session. The expected tools are `search` and `execute`.
