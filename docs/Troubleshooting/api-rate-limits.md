# Provider Rate Limits

Provider API rate limits are enforced upstream by the connected provider and surfaced through Composio-backed AOJ Workbench execution.

## Symptoms

- provider responses with `429`
- provider responses with quota or rate-limit error details
- slower `execute` operations during high-volume workflows

## Mitigation

- Batch work where the operation supports it.
- Use narrower Drive queries and smaller page sizes.
- Avoid polling loops from MCP clients.
- Retry transient `429` responses with exponential backoff.
- Review the connected provider and Composio dashboard for account-specific quota or connection state.

## Worker Checks

Confirm the Worker itself is healthy:

```bash
curl -i https://your-worker.workers.dev/
```

Then use the `search` tool to inspect operation parameters before calling `execute`.
