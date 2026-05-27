# Claude Client Integration

Use a Claude client that supports remote Streamable HTTP MCP servers. The server URL is the deployed Worker `/mcp` endpoint.

```text
https://your-worker.workers.dev/mcp
```

Local stdio, local HTTP, Docker, and local bootstrap flows are not supported MCP client connection paths.

## Claude Code

Add the Worker at user scope:

```bash
claude mcp add --scope user --transport http google-workspace https://your-worker.workers.dev/mcp
```

Use project scope only when that Worker is specific to this repository:

```bash
claude mcp add --scope project --transport http google-workspace https://your-worker.workers.dev/mcp
```

If you previously registered the server as `gdrive`, remove the stale entry first:

```bash
claude mcp remove gdrive
claude mcp add --scope user --transport http google-workspace https://your-worker.workers.dev/mcp
```

## Bearer Auth

The Worker validates `MCP_BEARER_TOKEN` for `/mcp`. Configure the client bearer token using the mechanism supported by your Claude client.

## Verify

After connecting, start a fresh Claude session and confirm the MCP tools are:

- `search`
- `execute`

If Google OAuth state is missing, use:

```bash
curl -H "Authorization: Bearer $MCP_SETUP_TOKEN" \
  https://your-worker.workers.dev/setup/status

curl -i -H "Authorization: Bearer $MCP_SETUP_TOKEN" \
  https://your-worker.workers.dev/setup/google/start
```
