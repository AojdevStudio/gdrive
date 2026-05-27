# Historical Docker Troubleshooting

Docker is not a supported MCP runtime for Google Workspace MCP v4.

If an older guide or deployment points to Docker, replace it with the Cloudflare Worker setup:

```text
https://your-worker.workers.dev/mcp
```

Current troubleshooting starts with:

```bash
curl -H "Authorization: Bearer $MCP_SETUP_TOKEN" \
  https://your-worker.workers.dev/setup/status
```

See [Authentication Problems](./authentication-problems.md).
