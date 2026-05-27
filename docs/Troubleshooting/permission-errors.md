# Permission Errors

Permission errors come from either MCP bearer auth or Google Workspace API authorization.

## MCP Client Permission Errors

Confirm the client sends the `MCP_BEARER_TOKEN` value to `POST /mcp`.

## Setup Route Permission Errors

Confirm setup calls use `MCP_SETUP_TOKEN`:

```bash
curl -H "Authorization: Bearer $MCP_SETUP_TOKEN" \
  https://your-worker.workers.dev/setup/status
```

## Google Workspace Permission Errors

If an operation fails with Google API permission errors:

1. Confirm the Google account authorized during `/setup/google/start` has access to the file, calendar, mailbox, or document.
2. Confirm the OAuth consent screen includes the required Workspace scopes.
3. Re-run setup after changing scopes so Google issues token state with the new grants.
