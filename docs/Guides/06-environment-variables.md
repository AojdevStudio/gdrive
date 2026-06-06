# Environment Variables Setup Guide

AOJ Workbench is remote-only for MCP clients. Clients connect to the deployed Cloudflare Workers `/mcp` endpoint; local stdio, local HTTP, Docker, and local bootstrap flows are not supported MCP client connection paths.

The target provider model is Composio-native. Provider OAuth credentials are configured in the Composio dashboard for v1 managed auth, not stored in BWS or this repo.

Use `.env.example` as the baseline for local operator tooling and Worker secret names.

## Worker Runtime

Set these as Cloudflare Worker secrets or bindings:

- `COMPOSIO_API_KEY` - Composio SDK/API key for the native provider layer
- `AOJ_WORKBENCH_USER_ID` - stable Composio user ID for connected accounts
- `MCP_BEARER_TOKEN` - bearer token validated by `POST /mcp`
- `MCP_ALLOWED_ORIGINS` - optional CORS allowlist
- `MCP_AUTHORIZATION_SERVER_URL` - optional protected-resource metadata for a real external MCP authorization server

`MCP_AUTHORIZATION_SERVER_URL` is metadata only. Do not set it to a provider OAuth URL; provider authorization belongs to the Composio native provider layer and is not Codex-to-MCP authentication.

Do not add provider OAuth client IDs or secrets for v1 managed auth. Do not add `COMPOSIO_WEBHOOK_SECRET` until trigger/webhook work begins.

## Local Codex Client

Codex should use the MCP client name `aoj-workbench` and a local env var named `AOJ_WORKBENCH_MCP_TOKEN`.

The value of `AOJ_WORKBENCH_MCP_TOKEN` must match the deployed Worker's `MCP_BEARER_TOKEN`; it is a client-side alias, not a separate secret.

```bash
export AOJ_WORKBENCH_MCP_TOKEN="replace-with-the-worker-token"

codex mcp add aoj-workbench \
  --url https://your-worker.workers.dev/mcp \
  --bearer-token-env-var AOJ_WORKBENCH_MCP_TOKEN

codex mcp get aoj-workbench
```

Start a fresh Codex session after changing MCP config or token environment.

## Cloudflare Operator Variables

These are for Wrangler and deployment workflows, not MCP client connection paths:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN` - source from `AOJDEVSTUDIO_CLOUDFLARE_API_TOKEN` in BWS
- `CLOUDFLARE_KV_NAMESPACE_ID`

## BWS Secret Contract

Store only the current v1 values:

- `COMPOSIO_API_KEY`
- `AOJ_WORKBENCH_USER_ID`
- `MCP_BEARER_TOKEN`
- `AOJDEVSTUDIO_CLOUDFLARE_API_TOKEN`

Set `AOJ_WORKBENCH_MCP_TOKEN` equal to `MCP_BEARER_TOKEN` in local client environments.

## Optional Runtime Tuning

- `LOG_LEVEL`
- `REDIS_URL`
- `PAI_CONTACTS_PATH`

Legacy local token file path variables may appear in old plans or migration notes. They are not supported MCP client setup paths.

## Validation Checklist

```bash
test -n "$AOJ_WORKBENCH_MCP_TOKEN" && echo "AOJ_WORKBENCH_MCP_TOKEN is set" || echo "AOJ_WORKBENCH_MCP_TOKEN is missing"
codex mcp get aoj-workbench
```

Expected: `codex mcp get aoj-workbench` shows the deployed Worker `/mcp` URL and `bearer_token_env_var = "AOJ_WORKBENCH_MCP_TOKEN"`.
