# Historical Redis Configuration

Redis is not part of the supported AOJ Workbench MCP client runtime.

The supported runtime is the deployed Cloudflare Workers `/mcp` endpoint:

```text
https://your-worker.workers.dev/mcp
```

Current persistent runtime state belongs in Cloudflare services such as Workers KV. Do not use local Redis, Docker Redis, or local HTTP services as MCP client setup requirements.

For current setup, use [Initial Setup](./01-initial-setup.md), [Environment Variables](./06-environment-variables.md), and [Remote Worker Smoke Test](./09-remote-worker-smoke-test.md).
