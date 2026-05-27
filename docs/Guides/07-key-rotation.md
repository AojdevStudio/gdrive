# Key Rotation

Google Workspace MCP v4 stores encrypted Google OAuth token state in Workers KV.

## Rotate MCP Bearer Tokens

Rotate client access by updating the Worker secret:

```bash
npx wrangler secret put MCP_BEARER_TOKEN
npx wrangler deploy
```

Update MCP client configuration to send the new bearer token.

## Rotate Setup Bearer Token

Rotate setup route access with:

```bash
npx wrangler secret put MCP_SETUP_TOKEN
npx wrangler deploy
```

Use the new setup token for `/setup/status` and `/setup/google/start`.

## Rotate Google OAuth Client Secret

Update the Worker secret:

```bash
npx wrangler secret put GDRIVE_CLIENT_SECRET
npx wrangler deploy
```

If Google invalidates existing token state, recover through:

```bash
curl -i -H "Authorization: Bearer $MCP_SETUP_TOKEN" \
  https://your-worker.workers.dev/setup/google/start
```

## Rotate Token Encryption Key

Changing `GDRIVE_TOKEN_ENCRYPTION_KEY` makes existing encrypted token state unreadable. Plan a maintenance window:

1. Set the new key.
2. Deploy the Worker.
3. Re-run `/setup/google/start` to store token state encrypted with the new key.
4. Verify with `/setup/status`.

```bash
npx wrangler secret put GDRIVE_TOKEN_ENCRYPTION_KEY
npx wrangler deploy

curl -i -H "Authorization: Bearer $MCP_SETUP_TOKEN" \
  https://your-worker.workers.dev/setup/google/start

curl -H "Authorization: Bearer $MCP_SETUP_TOKEN" \
  https://your-worker.workers.dev/setup/status
```
