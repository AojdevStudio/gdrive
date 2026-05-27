# Google Workspace MCP Documentation

Google Workspace MCP is a remote-only MCP server for Google Workspace. The supported runtime is a deployed Cloudflare Worker, and MCP clients connect to:

```text
https://your-worker.workers.dev/mcp
```

## Start Here

1. [Initial Setup](./Guides/01-initial-setup.md)
2. [Remote Authentication Flow](./Guides/02-authentication-flow.md)
3. [Codex MCP Integration](./Guides/08-codex-mcp.md)
4. [Remote Worker Smoke Test](./Guides/09-remote-worker-smoke-test.md)

## References

- [Architecture](./Architecture/ARCHITECTURE.md)
- [API](./Developer-Guidelines/API.md)
- [Examples](./Examples/README.md)
- [Troubleshooting](./Troubleshooting/README.md)
- [Authentication Reference](./authentication.md)

## Historical Material

Older migration plans, brainstorms, Docker notes, and Redis notes are retained for context only. They do not describe supported v4 MCP client connection paths.
