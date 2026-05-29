# Google Workspace MCP Examples

These examples use the v4 remote MCP architecture: one Cloudflare Workers HTTP endpoint with two tools, `search` and `execute`.

## Workflow

1. Call `search` to discover the service operation you need.
2. Call `execute` with `service`, `operation`, and `args`.

## Available Examples

### Search Operations

- [Natural Language Search](./search-natural-language.md) — Drive search via `drive.search`
- [Enhanced Search](./search-enhanced.md) — advanced Drive filtering via `drive.enhancedSearch`

### Spreadsheet Management

- [Conditional Formatting](./sheets-conditional-formatting.md) — apply conditional formatting via `sheets.addConditionalFormat`

## Example: Discover And Run

Discover Drive search:

```json
{
  "tool": "search",
  "args": {
    "service": "drive",
    "operation": "search"
  }
}
```

Run Drive search:

```json
{
  "tool": "execute",
  "args": {
    "service": "drive",
    "operation": "search",
    "args": {
      "query": "budget",
      "pageSize": 10
    }
  }
}
```

## Runtime Boundary

These examples assume an MCP client is already connected to the remote Google Workspace MCP Worker URL:

```text
https://your-worker.workers.dev/mcp
```

Do not use local stdio, local HTTP, Docker, or local bootstrap setup for these examples.
