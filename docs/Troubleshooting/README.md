# Troubleshooting

Use these checks for the supported Worker runtime.

## Setup Status

```bash
curl -H "Authorization: Bearer $MCP_SETUP_TOKEN" \
  https://your-worker.workers.dev/setup/status
```

If the response reports missing or malformed token state, restart setup:

```bash
curl -i -H "Authorization: Bearer $MCP_SETUP_TOKEN" \
  https://your-worker.workers.dev/setup/google/start
```

## MCP Auth

Unauthenticated `/mcp` requests should return `401 Unauthorized` when `MCP_BEARER_TOKEN` is configured. Confirm your MCP client sends the bearer token that matches the Worker secret.

## Expected Tools

Authenticated `tools/list` should expose:

- `search`
- `execute`

## References

- [Authentication Problems](./authentication-problems.md)
- [Error Messages](./error-messages.md)
- [Permission Errors](./permission-errors.md)
- [API Rate Limits](./api-rate-limits.md)

Historical Docker and Redis troubleshooting files remain only to redirect older links.
