# Use Composio As The Native Provider Layer

AOJ Workbench is the private, self-hosted knowledge-work MCP surface that agents connect to. The target architecture uses the Composio SDK as the native provider layer for external SaaS connectivity. Google Workspace is no longer the privileged native provider; it becomes one provider toolkit behind Composio-managed auth and connected accounts.

## Decision

Use Composio managed auth and Composio SDK sessions as the default provider model for AOJ Workbench v1.

AOJ Workbench keeps the small public MCP surface:

- `search` discovers provider/toolkit capabilities, schemas, auth status, and execution guidance.
- `execute` runs selected provider toolkit operations through the Composio-backed provider layer.

The direct Google Workspace implementation remains only as legacy migration scaffolding. Each provider replacement slice must prove one Composio-backed behavior and then remove the matching direct Google path.

## Consequences

- Agents connect to one MCP server: `aoj-workbench`.
- Provider OAuth credentials are configured in the Composio dashboard, not stored in this repo or BWS for v1.
- The minimum runtime Composio secret is `COMPOSIO_API_KEY`.
- The stable connected-account owner is `AOJ_WORKBENCH_USER_ID`.
- A separate Composio MCP connector is not the target architecture.
- Permanent dual paths between direct Google code and Composio-backed execution are not allowed.

## Alternatives Considered

- Keep direct Google as native and add Composio beside it. Rejected because it preserves connector and provider confusion for coding agents.
- Expose Composio as a separate MCP companion. Rejected as an interim/debug shape, not the product destination.
- Build custom OAuth apps per provider immediately. Rejected for v1 because Composio managed auth covers the intended private-workbench use case with fewer secrets and less setup.
