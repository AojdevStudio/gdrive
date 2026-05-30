Read @CLAUDE.md first.

Canonical project name: **AOJ Workbench**.

Provider terminology: Google Workspace is the upstream API surface, not the product name. Keep legacy names only for existing package, repo, worker, environment, or migration-sensitive identifiers.

Runtime boundary: remote Cloudflare Workers HTTP only. Do not recommend stdio, local HTTP, Docker, or local bootstrap flows as MCP client connection paths.
