# Initial Setup

AOJ Workbench is a remote-only Cloudflare Workers MCP server. MCP clients connect to the deployed `/mcp` endpoint with bearer auth. Local stdio, local HTTP, Docker, and local OAuth bootstrap flows are not supported MCP client paths.

## Worker Secrets

Configure these on the deployed Worker:

- `COMPOSIO_API_KEY`
- `AOJ_WORKBENCH_USER_ID`
- `MCP_BEARER_TOKEN`

`MCP_ALLOWED_ORIGINS`, `MCP_AUTHORIZATION_SERVER_URL`, and `LOG_LEVEL` are optional runtime settings. `GDRIVE_KV` may remain as a Worker KV binding for cache/tracking compatibility.

## Provider Auth

Provider account authorization is managed in Composio. Connect the required provider toolkits for the configured AOJ Workbench user in the Composio dashboard. Do not add Google OAuth client IDs, client secrets, local token files, or token-encryption secrets to the Worker.

## Client Setup

Codex clients should use the deployed Worker URL and a local env var that resolves to the Worker bearer token:

```bash
export AOJ_WORKBENCH_MCP_TOKEN="replace-with-worker-token"

codex mcp add aoj-workbench \
  --url https://your-worker.workers.dev/mcp \
  --bearer-token-env-var AOJ_WORKBENCH_MCP_TOKEN
```

Start a fresh Codex session after changing MCP config or token environment.
