# Docker Deployment

Docker deployment is no longer a supported MCP runtime for **Google Workspace MCP**.

The supported runtime is the remote Cloudflare Workers HTTP endpoint:

```text
https://your-worker.workers.dev/mcp
```

Do not configure MCP clients to launch Docker, run a local stdio process, or connect to a local HTTP server.

Historical Docker instructions were removed because they conflict with the remote-only runtime boundary.
