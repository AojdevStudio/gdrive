# Google Workspace MCP Examples

These examples assume the supported v4 runtime: a deployed Cloudflare Worker with MCP clients connected to `https://your-worker.workers.dev/mcp`.

Google Workspace MCP exposes two tools:

| Tool | Purpose |
|------|---------|
| `search` | Discover services, operations, parameters, and examples |
| `execute` | Run a specific Google Workspace operation with `service`, `operation`, and `args` |

## Before Running Examples

1. Deploy the Worker and configure its secrets.
2. Complete remote Google OAuth setup at `/setup/google/start`.
3. Confirm setup state:

```bash
curl -H "Authorization: Bearer $MCP_SETUP_TOKEN" \
  https://your-worker.workers.dev/setup/status
```

4. Connect your MCP client to the Worker `/mcp` URL using bearer auth.

## Example Tool Calls

Discover an operation:

```json
{
  "name": "search",
  "arguments": {
    "service": "drive",
    "operation": "search"
  }
}
```

Run an operation:

```json
{
  "name": "execute",
  "arguments": {
    "service": "drive",
    "operation": "search",
    "args": {
      "query": "budget",
      "pageSize": 10
    }
  }
}
```

## Available Examples

- [Natural Language Search](./search-natural-language.md)
- [Enhanced Search](./search-enhanced.md)
- [Conditional Formatting](./sheets-conditional-formatting.md)

When adding examples, use the `search` -> `execute` flow and avoid local stdio, Docker, Redis, or local OAuth bootstrap instructions.
