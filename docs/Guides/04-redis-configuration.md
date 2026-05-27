# Historical Redis Configuration Notes

Redis is not part of the supported Google Workspace MCP v4 runtime.

Runtime state belongs in Cloudflare services:

| State | Supported Storage |
|------|-------------------|
| Google OAuth token state | Workers KV binding `GDRIVE_KV` |
| Worker cache state | Workers KV through the Worker runtime |
| MCP client auth | `MCP_BEARER_TOKEN` Worker secret |
| Setup route auth | `MCP_SETUP_TOKEN` Worker secret |

Older Redis setup material is historical only and should not be used for new deployments.

See [Initial Setup](./01-initial-setup.md) for the current Cloudflare KV setup.
