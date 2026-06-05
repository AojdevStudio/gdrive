# Historical Redis Troubleshooting

Redis is not part of the supported AOJ Workbench v4 runtime.

Runtime state is stored through Cloudflare Workers KV. Check Worker setup state instead:

```bash
curl -H "Authorization: Bearer $MCP_SETUP_TOKEN" \
  https://your-worker.workers.dev/setup/status
```

If token state is missing or malformed, restart setup at `/setup/google/start`.
