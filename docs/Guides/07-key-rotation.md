# Historical Key Rotation Runbook

This page is retained only to mark the old local token-encryption runbook as obsolete.

AOJ Workbench now uses the deployed Cloudflare Workers `/mcp` endpoint for MCP clients. Provider authorization is managed in Composio for `AOJ_WORKBENCH_USER_ID`; the Worker does not require local token files, local Google OAuth bootstrap commands, or token-encryption keys for the Composio-native runtime.

Current secrets to rotate:

- `COMPOSIO_API_KEY`
- `MCP_BEARER_TOKEN`
- Cloudflare operator credentials such as `CLOUDFLARE_API_TOKEN`

Rotate provider connected accounts in Composio. Rotate Worker and Cloudflare secrets with their owning systems, then run the remote Worker smoke test:

```bash
WORKER_URL=https://your-worker.workers.dev \
MCP_BEARER_TOKEN=replace-with-worker-mcp-token \
npm run smoke:worker
```

Do not paste raw secrets, token material, private aliases, connected-account inventories, raw email data, or provider result bodies into rotation notes, issues, PRs, docs, or logs.
