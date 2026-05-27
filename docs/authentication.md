# Authentication Reference

Google Workspace MCP uses remote Worker auth only.

## Auth Boundaries

| Boundary | Mechanism |
|----------|-----------|
| MCP client to Worker | Static bearer token in `MCP_BEARER_TOKEN` |
| Operator setup routes | Static bearer token in `MCP_SETUP_TOKEN` |
| Worker to Google APIs | Google OAuth tokens encrypted in Workers KV |

The Worker is not an OAuth authorization server for MCP clients.

## Token Storage

Google OAuth token state is encrypted with `GDRIVE_TOKEN_ENCRYPTION_KEY` and stored in the `GDRIVE_KV` Workers KV binding.

## Setup Routes

```bash
curl -H "Authorization: Bearer $MCP_SETUP_TOKEN" \
  https://your-worker.workers.dev/setup/status

curl -i -H "Authorization: Bearer $MCP_SETUP_TOKEN" \
  https://your-worker.workers.dev/setup/google/start
```

## MCP Route

MCP clients connect to:

```text
https://your-worker.workers.dev/mcp
```

and send a bearer token matching `MCP_BEARER_TOKEN`.

## Secret Handling

Do not log or share:

- access tokens
- refresh tokens
- authorization codes
- Google client secrets
- token encryption keys
- MCP bearer tokens
- setup bearer tokens
