# Composio Native Provider

AOJ Workbench is a private, self-hosted knowledge-work MCP surface. Agents connect to AOJ Workbench once; AOJ Workbench uses the Composio SDK as its native provider layer for external SaaS tools.

The direct Google Workspace implementation currently in this repo is the legacy provider path. It exists only until Composio-backed provider replacement slices prove equivalent behavior and remove the matching legacy code.

## Target Boundary

| Concern | Owner |
|---|---|
| Agent-facing MCP endpoint | AOJ Workbench |
| Public MCP tool shape | AOJ Workbench `search` and `execute` |
| Provider discovery and execution | Composio SDK sessions and meta tools |
| Toolkit authentication and connected accounts | Composio managed auth |
| Toolkit OAuth app credentials | Composio dashboard, not this repo |
| Stable user/session owner ID | `AOJ_WORKBENCH_USER_ID` |
| Legacy direct Google modules | Migration scaffolding only |

Do not add a separate Composio MCP connector to Codex or Claude as the target architecture. That reintroduces connector noise. AOJ Workbench should be the single MCP surface.

## Managed Auth Default

Use Composio managed auth for v1.

Composio docs state that most OAuth toolkits work out of the box with managed OAuth, and custom auth configs are only needed for white-labeling, custom scopes, unsupported managed auth, or existing auth config reuse.

For v1, do not store provider OAuth client IDs or client secrets in BWS or repo docs. Configure selected toolkits in the Composio dashboard and let connected accounts attach to the stable AOJ Workbench user ID.

## Runtime Secret Contract

Required runtime/deployment values:

| Name | Purpose |
|---|---|
| `COMPOSIO_API_KEY` | Composio SDK/API key used by AOJ Workbench |
| `AOJ_WORKBENCH_USER_ID` | Stable Composio user ID for connected accounts |
| `MCP_BEARER_TOKEN` | Bearer token required by AOJ Workbench `/mcp` |
| `AOJ_WORKBENCH_MCP_TOKEN` | Local client alias for `MCP_BEARER_TOKEN` |
| `CLOUDFLARE_API_TOKEN` | Deployment token; source from `AOJDEVSTUDIO_CLOUDFLARE_API_TOKEN` in BWS |

Not needed for v1 managed auth:

- provider OAuth client IDs
- provider OAuth client secrets
- `COMPOSIO_WEBHOOK_SECRET`, until trigger/webhook work begins
- `COMPOSIO_MCP_TOKEN`, because Composio is not a separate client-facing MCP in the target architecture

## MCP Surface

Keep the AOJ Workbench public MCP surface small:

| AOJ tool | Target behavior |
|---|---|
| `search` | Discover Composio-backed provider toolkits, tools, schemas, auth status, and execution guidance |
| `execute` | Run a selected provider toolkit operation through the Composio SDK/session |

Composio sessions already use meta tools for catalog search, schema lookup, connection management, and execution. AOJ Workbench should wrap those capabilities rather than exposing every toolkit action as a separate MCP tool.

## Provider Replacement Slices

Migrate vertically:

1. Pick one legacy Google capability.
2. Write or update a behavior-level test for the AOJ Workbench `search`/`execute` behavior.
3. Prove the behavior through the Composio native provider.
4. Remove the corresponding legacy Google provider path.
5. Repeat until the direct Google provider is gone.

Do not leave permanent dual provider paths. Dual paths are only temporary while a provider replacement slice is red or in progress.

The first planned provider replacement slice is [Drive file search through Composio-backed `drive.search`](../plans/2026-06-05-first-provider-replacement-slice.md).

## Issue Backlog

Use GitHub as the working tracker until Linear is reauthenticated.

The current Composio issues should be rewritten in place:

- `#80` - decision record and docs for Composio as native provider
- `#81` - glossary and terminology for Composio-native provider model
- `#82` - BWS/env and managed-auth setup checklist
- `#83` - AOJ Workbench `search`/`execute` over Composio session design
- `#84` - first provider replacement slice plan and smoke-test procedure
