# Permission Errors

Permission errors come from either MCP bearer auth or Composio-managed provider authorization.

## MCP Client Permission Errors

Confirm the client sends the `MCP_BEARER_TOKEN` value to `POST /mcp`.

## Provider Permission Errors

If an operation fails with provider permission errors:

1. Confirm the provider account is active in Composio for the configured AOJ Workbench user.
2. Confirm that account has access to the file, calendar, mailbox, document, or other resource.
3. Reconnect the provider account in Composio if scopes or account grants changed.
