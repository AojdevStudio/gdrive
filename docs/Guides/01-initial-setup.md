# Initial Setup Guide

Google Workspace MCP runs as a remote Cloudflare Worker. MCP clients connect to the deployed `/mcp` URL.

## Prerequisites

- Google Cloud project with Workspace APIs enabled.
- OAuth client credentials for Google Workspace authorization.
- Cloudflare account with Workers and KV access.
- Node.js 22+ for contributor build and deploy commands.
- Wrangler CLI through `npx wrangler` or a global install.

## Enable Google Workspace APIs

Enable the APIs used by the Worker:

```bash
gcloud services enable drive.googleapis.com
gcloud services enable sheets.googleapis.com
gcloud services enable docs.googleapis.com
gcloud services enable forms.googleapis.com
gcloud services enable gmail.googleapis.com
gcloud services enable calendar-json.googleapis.com
```

## Configure Google OAuth

In Google Cloud Console:

1. Configure the OAuth consent screen with app name `Google Workspace MCP`.
2. Add the Workspace scopes required by your deployment.
3. Create OAuth client credentials.
4. Add the deployed Worker callback URL after deployment:

```text
https://your-worker.workers.dev/setup/google/callback
```

## Configure Cloudflare

Create a KV namespace:

```bash
npx wrangler kv:namespace create GDRIVE_KV --preview false
```

Copy the namespace ID into `wrangler.toml`, then set Worker secrets:

```bash
npx wrangler secret put GDRIVE_CLIENT_ID
npx wrangler secret put GDRIVE_CLIENT_SECRET
npx wrangler secret put GDRIVE_TOKEN_ENCRYPTION_KEY
npx wrangler secret put MCP_BEARER_TOKEN
npx wrangler secret put MCP_SETUP_TOKEN
```

Generate `GDRIVE_TOKEN_ENCRYPTION_KEY` with:

```bash
openssl rand -base64 32
```

## Deploy

```bash
npm install
npm run build:worker
npx wrangler deploy
```

Use the deployed Worker URL for all MCP client configuration.

## Next Steps

- Complete remote Google OAuth setup: [Authentication Flow](./02-authentication-flow.md)
- Connect Codex: [Codex MCP Integration](./08-codex-mcp.md)
- Run smoke checks: [Remote Worker Smoke Test](./09-remote-worker-smoke-test.md)
