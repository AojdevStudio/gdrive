# API Rate Limits

Google Workspace API rate limits are enforced by Google and by any quotas on your Google Cloud project.

## Symptoms

- Google API responses with `429`
- Google API responses with quota or rate-limit error details
- slower `execute` operations during high-volume workflows

## Mitigation

- Batch work where the operation supports it.
- Use narrower Drive queries and smaller page sizes.
- Avoid polling loops from MCP clients.
- Retry transient `429` responses with exponential backoff.
- Review quota usage in Google Cloud Console for the enabled Workspace APIs.

## Worker Checks

Confirm the Worker itself is healthy:

```bash
curl -H "Authorization: Bearer $MCP_SETUP_TOKEN" \
  https://your-worker.workers.dev/setup/status
```

Then use the `search` tool to inspect operation parameters before calling `execute`.
