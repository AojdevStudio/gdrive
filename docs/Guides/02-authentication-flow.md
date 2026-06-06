# Authentication Flow

AOJ Workbench has two auth boundaries:

- MCP client to Worker: `MCP_BEARER_TOKEN` on `POST /mcp`.
- Provider account auth: Composio managed auth for the configured AOJ Workbench user.

The Worker is not a provider OAuth bootstrap server. It does not serve Google setup routes, persist provider refresh tokens, or expose connected-account inventories to MCP clients.

## MCP Client Auth

Send the Worker bearer token on every `/mcp` request:

```text
Authorization: Bearer <MCP_BEARER_TOKEN>
```

For Codex, store the same value locally as `AOJ_WORKBENCH_MCP_TOKEN` and configure the remote Worker `/mcp` URL.

## Provider Auth

Connect provider accounts in Composio for `AOJ_WORKBENCH_USER_ID`. AOJ Workbench `search` reports redacted provider auth status, and `execute` runs through the Composio SDK runtime.

If execution returns a provider-connection error, repair the account in Composio and retry. Do not add direct Google OAuth secrets or local token files to this repo or the Worker.
