# Environment Variables

These variables are Worker-facing unless noted otherwise. Set secrets with `npx wrangler secret put`.

## Required Worker Secrets

| Variable | Purpose |
|----------|---------|
| `GDRIVE_CLIENT_ID` | Google OAuth client ID |
| `GDRIVE_CLIENT_SECRET` | Google OAuth client secret |
| `GDRIVE_TOKEN_ENCRYPTION_KEY` | 32-byte base64 key for encrypted token state |
| `MCP_BEARER_TOKEN` | Bearer token for MCP clients calling `/mcp` |
| `MCP_SETUP_TOKEN` | Bearer token for setup/status routes |

Generate the encryption key with:

```bash
openssl rand -base64 32
```

## Required Worker Binding

| Binding | Purpose |
|---------|---------|
| `GDRIVE_KV` | Workers KV namespace for encrypted Google OAuth token state |

Create it with:

```bash
npx wrangler kv:namespace create GDRIVE_KV --preview false
```

## Optional Worker Variables

| Variable | Purpose |
|----------|---------|
| `MCP_ALLOWED_ORIGINS` | Comma-separated CORS origin allowlist |
| `MCP_AUTHORIZATION_SERVER_URL` | Metadata-only external authorization server URL |
| `LOG_LEVEL` | Worker log level hint |

`MCP_AUTHORIZATION_SERVER_URL` does not make this Worker validate external OAuth bearer tokens. MCP clients still use `MCP_BEARER_TOKEN`.

## Deployment Check

```bash
npm run build:worker
npx wrangler deploy
```

Then verify setup state:

```bash
curl -H "Authorization: Bearer $MCP_SETUP_TOKEN" \
  https://your-worker.workers.dev/setup/status
```
