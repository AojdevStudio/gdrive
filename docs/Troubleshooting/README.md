# AOJ Workbench Troubleshooting

AOJ Workbench is remote-only. Current MCP clients must connect to the Cloudflare Workers `/mcp` endpoint.

```text
https://your-worker.workers.dev/mcp
```

## Current Checks

- Confirm the MCP client is configured with the remote Worker URL.
- Confirm the client server name is `aoj-workbench`, not `gdrive`, unless you intentionally kept a legacy alias.
- Confirm the bearer token configured in the MCP client matches the Worker's `MCP_BEARER_TOKEN`.
- Start a fresh MCP client session after changing MCP config.
- Confirm the expected tools are `search` and `execute`.

## Common Issues

### `401 Unauthorized`

The bearer token is missing or wrong. Update the client token environment variable and restart the MCP client session.

### Tools Do Not Appear

Check the configured URL and restart the client session. The endpoint must end with `/mcp`.

### Agent Thinks This Is Drive-Only

Rename the MCP server entry to `aoj-workbench`. The server covers Drive, Sheets, Forms, Docs, Gmail, and Calendar.

## Legacy Pages

Older troubleshooting pages in this directory may describe local stdio, Docker, Redis, or local auth flows. Those are retained only as historical references and are not supported MCP runtime guidance.
