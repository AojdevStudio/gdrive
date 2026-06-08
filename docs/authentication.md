# Authentication Documentation

AOJ Workbench has two separate auth boundaries:

- MCP client to Worker: static bearer auth with `MCP_BEARER_TOKEN` on `POST /mcp`.
- Provider account authorization: Composio managed auth for the configured `AOJ_WORKBENCH_USER_ID`.

The Worker is not a provider OAuth bootstrap server and does not serve Google setup routes. MCP clients connect only to the deployed Cloudflare Workers endpoint:

```text
https://your-worker.workers.dev/mcp
```

## MCP Client Auth

Clients send the Worker bearer token:

```text
Authorization: Bearer <MCP_BEARER_TOKEN>
```

For Codex, store the same value locally as `AOJ_WORKBENCH_MCP_TOKEN` and configure `aoj-workbench` with the remote `/mcp` URL.

## Provider Auth

Connect provider accounts in Composio for `AOJ_WORKBENCH_USER_ID`. AOJ Workbench `search` reports redacted provider auth status, and `execute` runs through the Composio provider runtime.

If execution returns a provider connection or permission error, repair the account in Composio and retry. Do not add direct Google OAuth client IDs, client secrets, refresh tokens, local token files, token-encryption keys, or connected-account inventories to this repo or the deployed Worker.

## Metadata

`MCP_AUTHORIZATION_SERVER_URL` is optional protected-resource metadata for a real external MCP authorization server. It does not make AOJ Workbench validate external OAuth tokens, and it must not point at provider OAuth.

## Redaction

Do not share access tokens, refresh tokens, authorization codes, client secrets, API keys, private aliases, connected-account inventories, bearer tokens, raw email data, or provider result bodies in issues, PRs, docs, or logs.
