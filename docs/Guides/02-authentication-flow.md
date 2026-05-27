# Remote Authentication Flow

Google Workspace MCP stores encrypted Google OAuth tokens in Cloudflare Workers KV. Setup happens through Worker routes, not local commands.

## Auth Surfaces

There are two separate bearer tokens:

| Token | Purpose |
|------|---------|
| `MCP_SETUP_TOKEN` | Protects `/setup/status` and `/setup/google/start` |
| `MCP_BEARER_TOKEN` | Protects MCP client requests to `/mcp` |

Google OAuth authorizes the Worker to call Google APIs. MCP clients authenticate to the Worker with static bearer auth.

## Start Google OAuth Setup

Open the setup route with setup bearer auth:

```bash
curl -i -H "Authorization: Bearer $MCP_SETUP_TOKEN" \
  https://your-worker.workers.dev/setup/google/start
```

Follow the Google consent flow. The callback stores encrypted token state in `GDRIVE_KV`.

## Verify Setup State

```bash
curl -H "Authorization: Bearer $MCP_SETUP_TOKEN" \
  https://your-worker.workers.dev/setup/status
```

Healthy configured state reports `configured: true` and `tokenStateExists: true`.

## Recover Missing Or Expired State

If `/mcp` returns:

```json
{
  "error": "Google OAuth token resolution failed",
  "detail": "Use /setup/status to inspect remote Google OAuth state, then /setup/google/start to recover."
}
```

Run:

```bash
curl -H "Authorization: Bearer $MCP_SETUP_TOKEN" \
  https://your-worker.workers.dev/setup/status

curl -i -H "Authorization: Bearer $MCP_SETUP_TOKEN" \
  https://your-worker.workers.dev/setup/google/start
```

## Security Notes

- Do not paste access tokens, refresh tokens, authorization codes, client secrets, encryption keys, or bearer tokens into logs or issues.
- Rotate `MCP_BEARER_TOKEN` if MCP client access is exposed.
- Rotate `MCP_SETUP_TOKEN` after setup if only operators should recover Google OAuth state.
- `MCP_AUTHORIZATION_SERVER_URL` is metadata only; it does not make this Worker validate external OAuth tokens.
