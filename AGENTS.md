Read @CLAUDE.md first.

Canonical project name: **AOJ Workbench**.

Provider terminology: Composio SDK is the target native provider layer. Google Workspace is a provider toolkit in the target architecture, and the current direct Google implementation is legacy migration scaffolding. Keep legacy names only for existing package, repo, worker, environment, or migration-sensitive identifiers.

Runtime boundary: remote Cloudflare Workers HTTP only. Do not recommend stdio, local HTTP, Docker, or local bootstrap flows as MCP client connection paths.
