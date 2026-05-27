# Docker Runtime Unsupported

Google Workspace MCP is remote-only. MCP clients must connect to the deployed Cloudflare Workers `/mcp` URL.

Docker is not a supported way to run this project as an MCP server. The supported runtime is the deployed Cloudflare Workers HTTP endpoint.

Use the Worker setup routes instead:

```bash
curl -H "Authorization: Bearer $MCP_SETUP_TOKEN" \
  https://your-worker.workers.dev/setup/status

curl -i -H "Authorization: Bearer $MCP_SETUP_TOKEN" \
  https://your-worker.workers.dev/setup/google/start
```
