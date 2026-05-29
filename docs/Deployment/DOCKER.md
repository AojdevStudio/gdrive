# Docker Deployment

Docker deployment is unsupported for the current **Google Workspace MCP** runtime.

The only supported MCP server mode is the remote Cloudflare Workers HTTP endpoint:

```text
https://your-worker.workers.dev/mcp
```

Do not use Docker as an MCP client connection path. Do not reintroduce stdio-based Docker examples into current documentation.
