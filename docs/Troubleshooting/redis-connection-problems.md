# Historical Redis Troubleshooting

Redis is not part of the supported AOJ Workbench v4 runtime.

The deployed Worker may use Cloudflare Workers KV for cache/tracking compatibility. Check the Worker identity response and `/mcp` bearer auth instead:

```bash
curl -i https://your-worker.workers.dev/
```
