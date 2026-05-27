# Google Workspace MCP Guides

The supported runtime is Cloudflare Workers Streamable HTTP. MCP clients connect to the deployed Worker `/mcp` URL.

## Current Guides

1. [Initial Setup](./01-initial-setup.md)
2. [Remote Authentication Flow](./02-authentication-flow.md)
3. [Claude Client Integration](./05-claude-desktop-integration.md)
4. [Environment Variables](./06-environment-variables.md)
5. [Key Rotation](./07-key-rotation.md)
6. [Codex MCP Integration](./08-codex-mcp.md)
7. [Remote Worker Smoke Test](./09-remote-worker-smoke-test.md)

## Historical Guides

These files remain only to redirect older links:

- [Docker Deployment](./03-docker-deployment.md)
- [Redis Configuration](./04-redis-configuration.md)

Do not use Docker, Redis, local stdio, local HTTP, or local OAuth bootstrap flows as MCP client connection paths.
