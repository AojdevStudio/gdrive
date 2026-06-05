# Claude Integration Guide

This guide connects Claude to **AOJ Workbench** through the remote Cloudflare Workers HTTP endpoint.

## Supported Runtime

Use the deployed Worker endpoint:

```text
https://your-worker.workers.dev/mcp
```

Local stdio, local HTTP, Docker, and local bootstrap flows are not supported MCP server modes.

## Claude Code

Use a descriptive server name:

```bash
claude mcp add --scope user --transport http aoj-workbench https://your-worker.workers.dev/mcp
```

Project scope is only appropriate when the Workspace account or Worker endpoint is project-specific:

```bash
claude mcp add --scope project --transport http aoj-workbench https://your-worker.workers.dev/mcp
```

## Claude Desktop

Configure Claude Desktop with the remote URL:

```json
{
  "mcpServers": {
    "aoj-workbench": {
      "url": "https://your-worker.workers.dev/mcp"
    }
  }
}
```

If the Worker requires bearer auth, configure the token using the auth mechanism supported by your Claude Desktop version.

## Expected Tools

Claude should see:

- `search`
- `execute`

Use `search` to discover operations across Drive, Sheets, Forms, Docs, Gmail, and Calendar.

## Naming

Use `aoj-workbench` as the MCP server name in client config. Avoid `gdrive` because this server is not Drive-only.
