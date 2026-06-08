# AOJ Workbench Cloudflare Worker Setup

AOJ Workbench is a remote-only MCP server. MCP clients connect to the deployed Cloudflare Workers `/mcp` endpoint; there is no supported local stdio server, local HTTP server, Docker runtime, or local Google OAuth bootstrap flow for clients.

## Prerequisites

- Node.js `22.13.0` or newer
- Wrangler access to the target Cloudflare account
- A deployed or deployable Cloudflare Worker from this repo
- Composio configured with the provider toolkits AOJ Workbench should expose

Provider accounts are connected in Composio for the configured AOJ Workbench user. Do not create or upload Google OAuth client secrets, refresh tokens, local token files, private aliases, connected-account inventories, or provider result bodies as part of this setup.

## Worker Runtime Values

Configure these Worker secrets:

| Name | Purpose |
|---|---|
| `COMPOSIO_API_KEY` | Composio SDK/API key for provider discovery and execution |
| `AOJ_WORKBENCH_USER_ID` | Stable Composio user ID that owns connected accounts |
| `MCP_BEARER_TOKEN` | Static bearer token required by AOJ Workbench `/mcp` |

Optional Worker settings:

| Name | Purpose |
|---|---|
| `MCP_ALLOWED_ORIGINS` | CORS allowlist for browser-based MCP clients |
| `MCP_AUTHORIZATION_SERVER_URL` | Protected-resource metadata for a real external MCP authorization server |
| `LOG_LEVEL` | Worker log verbosity hint |

`GDRIVE_KV` may remain as a Cloudflare Workers KV binding for cache or tracking compatibility. It is not a local token store.

## Configure Cloudflare

Verify Wrangler is authenticated:

```bash
npx wrangler whoami
```

Set the required Worker secrets without printing their values:

```bash
printf '%s' "$COMPOSIO_API_KEY" | npx wrangler secret put COMPOSIO_API_KEY
printf '%s' "$AOJ_WORKBENCH_USER_ID" | npx wrangler secret put AOJ_WORKBENCH_USER_ID
printf '%s' "$MCP_BEARER_TOKEN" | npx wrangler secret put MCP_BEARER_TOKEN
```

If the Worker needs KV compatibility state, confirm `wrangler.toml` has a `GDRIVE_KV` binding. Create a namespace only when one does not already exist:

```bash
npx wrangler kv:namespace create GDRIVE_KV --preview false
```

Copy the returned namespace ID into `wrangler.toml`.

## Deploy

Build and deploy the Worker:

```bash
npm run build:worker
npm run deploy:worker
```

The deploy output prints a Worker URL. MCP clients must use that URL with `/mcp` appended:

```text
https://your-worker.workers.dev/mcp
```

## Configure Codex

Use `aoj-workbench` as the MCP client name so agents do not treat this as Drive-only:

```bash
export AOJ_WORKBENCH_MCP_TOKEN="$MCP_BEARER_TOKEN"

codex mcp add aoj-workbench \
  --url https://your-worker.workers.dev/mcp \
  --bearer-token-env-var AOJ_WORKBENCH_MCP_TOKEN
```

Start a fresh Codex session after changing MCP config or token environment.

## Configure Claude Code

```bash
claude mcp add --scope user --transport http aoj-workbench https://your-worker.workers.dev/mcp
```

If the Worker requires bearer auth, configure the client with the same bearer token expected by `MCP_BEARER_TOKEN`.

## Verify

Run the fixture smoke test:

```bash
npm test -- --runTestsByPath src/__tests__/worker/remote-worker-smoke.test.ts
```

Run the live Worker smoke test:

```bash
WORKER_URL=https://your-worker.workers.dev \
MCP_BEARER_TOKEN="$MCP_BEARER_TOKEN" \
npm run smoke:worker
```

For live `execute` smoke payloads, make sure the relevant Composio provider account is connected for `AOJ_WORKBENCH_USER_ID`. Forms smoke payloads require an active Google Forms-capable account in Composio before `forms.*` execution checks can pass.

The smoke script redacts configured bearer tokens and provider API keys before printing failures. Do not paste raw tokens, private aliases, connected-account inventories, raw email data, or provider result bodies into issues, PRs, docs, or logs.

## Expected Result

- The Worker root responds with AOJ Workbench identity text.
- Unauthenticated `/mcp` calls return `401`.
- Authenticated `tools/list` exposes exactly `search` and `execute`.
- `search` discovers Composio-backed provider operations.
- Optional `execute` smoke payloads run through the Composio provider runtime.
