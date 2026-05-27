# Authentication Problems

Google Workspace MCP has two auth surfaces:

- MCP client to Worker: `MCP_BEARER_TOKEN` on `POST /mcp`
- Operator setup to Worker: `MCP_SETUP_TOKEN` on `/setup/status` and `/setup/google/start`

## `/mcp` Returns 401 Unauthorized

Confirm the MCP client sends:

```text
Authorization: Bearer <MCP_BEARER_TOKEN>
```

The value must match the Worker secret.

## Google OAuth Token Resolution Failed

Check setup state:

```bash
curl -H "Authorization: Bearer $MCP_SETUP_TOKEN" \
  https://your-worker.workers.dev/setup/status
```

Recover with:

```bash
curl -i -H "Authorization: Bearer $MCP_SETUP_TOKEN" \
  https://your-worker.workers.dev/setup/google/start
```

## Setup Routes Return 401

Confirm the request uses `MCP_SETUP_TOKEN`, not `MCP_BEARER_TOKEN`.

## Redaction

Do not share access tokens, refresh tokens, authorization codes, client secrets, encryption keys, or bearer tokens in issues or logs.
