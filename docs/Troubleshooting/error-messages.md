# Error Messages

## `Unauthorized`

The bearer token is missing or wrong.

- `/mcp` uses `MCP_BEARER_TOKEN`
- `/setup/status` and `/setup/google/start` use `MCP_SETUP_TOKEN`

## `Server misconfiguration`

A required Worker secret or binding is missing. Confirm:

- `GDRIVE_KV`
- `GDRIVE_CLIENT_ID`
- `GDRIVE_CLIENT_SECRET`
- `GDRIVE_TOKEN_ENCRYPTION_KEY`
- `MCP_BEARER_TOKEN`
- `MCP_SETUP_TOKEN`

## `Google OAuth token resolution failed`

The Worker could not load or refresh Google OAuth state.

```bash
curl -H "Authorization: Bearer $MCP_SETUP_TOKEN" \
  https://your-worker.workers.dev/setup/status

curl -i -H "Authorization: Bearer $MCP_SETUP_TOKEN" \
  https://your-worker.workers.dev/setup/google/start
```

## `OAuth authorization server is not implemented`

`/.well-known/oauth-authorization-server` intentionally returns metadata explaining that this Worker validates static bearer auth. `MCP_AUTHORIZATION_SERVER_URL` is protected-resource metadata only.
