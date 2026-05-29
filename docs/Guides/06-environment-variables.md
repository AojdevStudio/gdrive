# Environment Variables Setup Guide

Google Workspace MCP is remote-only for MCP clients. Clients connect to the deployed Cloudflare Workers `/mcp` endpoint; local stdio, local HTTP, Docker, and local bootstrap flows are not supported MCP client connection paths.

Use `.env.example` as the baseline for local operator tooling and Worker secret names.

## Worker Runtime

Set these as Cloudflare Worker secrets or bindings:

- `MCP_BEARER_TOKEN` - bearer token validated by `POST /mcp`
- `MCP_SETUP_TOKEN` - separate bearer token for setup/status routes
- `GDRIVE_CLIENT_ID` - Google OAuth client ID
- `GDRIVE_CLIENT_SECRET` - Google OAuth client secret
- `GDRIVE_TOKEN_ENCRYPTION_KEY` - 32-byte base64 key for encrypted token storage
- `GDRIVE_TOKEN_CURRENT_KEY_VERSION` - optional active key version
- `GDRIVE_TOKEN_ENCRYPTION_KEY_V2`, `GDRIVE_TOKEN_ENCRYPTION_KEY_V3`, `GDRIVE_TOKEN_ENCRYPTION_KEY_V4` - optional rotation keys
- `MCP_ALLOWED_ORIGINS` - optional CORS allowlist
- `MCP_AUTHORIZATION_SERVER_URL` - optional protected-resource metadata for a real external MCP authorization server

`MCP_AUTHORIZATION_SERVER_URL` is metadata only. Do not set it to a Google OAuth URL; Google OAuth authorizes this server to call Google APIs and is not Codex-to-MCP authentication.

## Local Codex Client

Codex should use the MCP client name `google-workspace` and a local env var named `GOOGLE_WORKSPACE_MCP_TOKEN`.

The value of `GOOGLE_WORKSPACE_MCP_TOKEN` must match the deployed Worker's `MCP_BEARER_TOKEN`; the Worker still validates `MCP_BEARER_TOKEN`.

```bash
export GOOGLE_WORKSPACE_MCP_TOKEN="replace-with-the-worker-token"

codex mcp add google-workspace \
  --url https://your-worker.workers.dev/mcp \
  --bearer-token-env-var GOOGLE_WORKSPACE_MCP_TOKEN

codex mcp get google-workspace
```

Start a fresh Codex session after changing MCP config or token environment.

## Cloudflare Operator Variables

These are for Wrangler and deployment workflows, not MCP client connection paths:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_KV_NAMESPACE_ID`

## Optional Runtime Tuning

- `GDRIVE_TOKEN_REFRESH_INTERVAL`
- `GDRIVE_TOKEN_PREEMPTIVE_REFRESH`
- `GDRIVE_TOKEN_MAX_RETRIES`
- `GDRIVE_TOKEN_RETRY_DELAY`
- `LOG_LEVEL`
- `REDIS_URL`
- `PAI_CONTACTS_PATH`

Legacy local token file path variables may appear in old plans or migration notes. They are not supported MCP client setup paths.

## Validation Checklist

```bash
test -n "$GOOGLE_WORKSPACE_MCP_TOKEN" && echo "GOOGLE_WORKSPACE_MCP_TOKEN is set" || echo "GOOGLE_WORKSPACE_MCP_TOKEN is missing"
codex mcp get google-workspace
```

Expected: `codex mcp get google-workspace` shows the deployed Worker `/mcp` URL and `bearer_token_env_var = "GOOGLE_WORKSPACE_MCP_TOKEN"`.
