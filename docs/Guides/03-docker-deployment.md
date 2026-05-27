# Historical Docker Deployment Notes

Docker is not a supported MCP runtime for Google Workspace MCP v4.

The supported runtime is the deployed Cloudflare Worker:

```text
https://your-worker.workers.dev/mcp
```

Use Docker references in older issues, plans, or migration notes as historical context only. Do not configure MCP clients to start this project through Docker.

Current setup path:

1. Configure Google Cloud OAuth.
2. Configure Cloudflare KV and Worker secrets.
3. Deploy with `npx wrangler deploy`.
4. Complete Google OAuth through `/setup/google/start`.
5. Connect MCP clients to the Worker `/mcp` URL.

See [Initial Setup](./01-initial-setup.md) and [Remote Authentication Flow](./02-authentication-flow.md).
