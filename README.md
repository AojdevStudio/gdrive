<div align="center">

![AOJ Workbench](docs/images/hero-banner.png)

# AOJ Workbench

### One private MCP endpoint for your knowledge-work toolkits.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![MCP](https://img.shields.io/badge/MCP-Protocol-blueviolet)](https://modelcontextprotocol.io)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F38020?logo=cloudflare&logoColor=white)](https://workers.cloudflare.com/)
[![v4.0.0](https://img.shields.io/badge/version-4.0.0-green)](https://github.com/AojdevStudio/gdrive/releases)

*Give an AI agent one URL and it can work through AOJ Workbench.*

[**Quick Start**](#quick-start) . [**Services**](#services) . [**Docs**](./docs/README.md)

</div>

---

## Remote Only

AOJ Workbench is a **private remote HTTP MCP server** hosted on Cloudflare Workers.

The supported client experience is:

```text
https://your-worker.workers.dev/mcp
```

There is no supported local stdio server, local HTTP server, Docker runtime, or local bootstrap flow for MCP clients. Clients connect to the remote `/mcp` endpoint by URL.

Legacy local commands and Docker instructions from older versions are not part of the supported runtime model.

## Why This Exists

AI agents can draft plans, reason over code, and summarize documents, but daily work spans many tools:

- Gmail and Google Workspace
- Outlook
- Notion
- Stripe
- YouTube
- other selected Composio-supported toolkits

AOJ Workbench gives agents one MCP endpoint. The target provider layer is the Composio SDK with managed auth. The current direct Google implementation is legacy migration scaffolding until provider replacement slices remove it.

## Quick Start

### 1. Get The Endpoint

Use the deployed Worker URL:

```text
https://your-worker.workers.dev/mcp
```

The Worker must already be deployed and configured with its MCP bearer token and the required Composio runtime secrets. Current legacy Google slices may still require Google OAuth state until they are replaced.

### 2. Connect Claude Code

Use a descriptive MCP server name so agents understand the full surface area:

```bash
claude mcp add --scope user --transport http aoj-workbench https://your-worker.workers.dev/mcp
```

If bearer auth is enabled for the Worker, configure the same bearer token expected by the server.

### 3. Connect Codex

```bash
export AOJ_WORKBENCH_MCP_TOKEN="replace-with-worker-token"

codex mcp add aoj-workbench \
  --url https://your-worker.workers.dev/mcp \
  --bearer-token-env-var AOJ_WORKBENCH_MCP_TOKEN
```

Start a fresh Codex session after changing MCP config.

## Provider Model

AOJ Workbench keeps one public MCP connector. Behind that connector, Composio SDK sessions discover and execute selected provider toolkit actions.

The direct Google Workspace operations currently in the repo are legacy paths. Migrate them vertically: prove one Composio-backed behavior, then remove the matching legacy Google code.

## Tools

v4 exposes two MCP tools:

| Tool | Purpose |
|:-----|:--------|
| `search` | Discover provider/toolkit capabilities, schemas, auth status, and execution guidance |
| `execute` | Run a selected provider toolkit operation |

This keeps the MCP tool list small while avoiding separate client connectors for every provider.

Example direct operation call:

```json
{
  "tool": "execute",
  "args": {
    "service": "gmail",
    "operation": "sendMessage",
    "args": {
      "to": "team@example.com",
      "subject": "Q1 report ready",
      "body": "The Q1 report is ready for review."
    }
  }
}
```

Example discovery call:

```json
{
  "tool": "search",
  "args": {
    "service": "sheets",
    "operation": "updateCells"
  }
}
```

## Architecture

```text
MCP client
  |
  | Streamable HTTP
  v
Cloudflare Worker /mcp
  |
  | Composio SDK sessions and managed auth
  v
Provider toolkits
```

Persistent state belongs in Cloudflare services, primarily Workers KV. The user-facing MCP runtime is the Worker URL.

## Security

- MCP clients authenticate to the Worker with static bearer auth when configured.
- Provider authorization belongs to Composio managed auth in the target architecture.
- This server is not an OAuth authorization server for MCP clients.
- Do not point MCP client auth metadata at provider OAuth.

See [MCP Client Auth Boundary](./docs/adr/0001-mcp-client-auth-boundary.md).

## Development

Development commands are for contributors changing the Worker implementation, not for running the MCP server locally as a client dependency.

```bash
npm test
npm run type-check
npm run build:worker
npm run deploy:worker
```

Do not add local stdio, local HTTP, or Docker connection instructions back to user-facing docs.

## Roadmap

- [ ] Composio native provider — discovery, auth status, schema lookup, execution
- [ ] Google provider replacement — migrate current direct Google capabilities behind Composio
- [ ] Notion toolkit — selected private-workbench workflows
- [ ] Stripe toolkit — selected private-workbench workflows
- [ ] YouTube toolkit — selected private-workbench workflows
- [ ] Outlook toolkit — selected private-workbench workflows
- [x] Cloudflare Workers — remote HTTP MCP runtime

## Contributing

This repo is TypeScript and Cloudflare Workers based. Keep changes aligned with the remote-only runtime boundary.

1. Fork and create a feature branch.
2. Follow existing TypeScript and ESLint conventions.
3. Add tests for behavior changes.
4. Run the relevant checks.
5. Open a PR with a clear description.

## License

MIT — see [LICENSE](./LICENSE) for details.
