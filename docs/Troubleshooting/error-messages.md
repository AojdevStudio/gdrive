# Error Messages

## `Unauthorized`

The bearer token is missing or wrong.

`/mcp` uses `MCP_BEARER_TOKEN`.

## `Server misconfiguration`

A required Worker secret or binding is missing. Confirm target Composio-native values first:

- `COMPOSIO_API_KEY`
- `AOJ_WORKBENCH_USER_ID`
- `MCP_BEARER_TOKEN`

## `Composio provider connection is not active`

The requested provider toolkit is not connected for the configured AOJ Workbench user in Composio. Connect the provider account in Composio and retry through AOJ Workbench `execute`.

## `OAuth authorization server is not implemented`

`/.well-known/oauth-authorization-server` intentionally returns metadata explaining that this Worker validates static bearer auth. `MCP_AUTHORIZATION_SERVER_URL` is protected-resource metadata only.
