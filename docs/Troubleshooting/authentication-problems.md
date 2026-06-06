# Authentication Problems

AOJ Workbench has two auth surfaces:

- MCP client to Worker: `MCP_BEARER_TOKEN` on `POST /mcp`
- Provider account auth: Composio managed auth for the configured AOJ Workbench user

The Worker no longer serves direct Google setup routes. Connect or repair provider accounts in Composio, then use AOJ Workbench `search` and `execute` through the deployed `/mcp` endpoint.

## `/mcp` Returns 401 Unauthorized

Confirm the MCP client sends:

```text
Authorization: Bearer <MCP_BEARER_TOKEN>
```

The value must match the Worker secret.

## Provider Connection Is Not Active

The Worker returns a redacted provider-auth error when Composio has no active account for the requested provider toolkit:

```text
Composio provider connection is not active for this AOJ Workbench user. Connect the provider account in Composio and retry.
```

Fix the connected account in the Composio dashboard. Do not add Google OAuth client IDs or token secrets to the Worker.

## Redaction

Do not share access tokens, refresh tokens, authorization codes, client secrets, API keys, private aliases, connected-account inventories, or bearer tokens in issues or logs.
