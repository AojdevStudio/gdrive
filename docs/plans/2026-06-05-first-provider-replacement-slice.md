# First Provider Replacement Slice

AOJ Workbench should migrate from the legacy direct Google provider path to Composio-native execution one vertical behavior at a time. The first slice is planning-only: it defines the behavior to prove, the verification shape, and the removal rule for the legacy path. It does not implement provider code.

## Selected Slice

Replace legacy Drive file search with Composio-backed Google Drive search.

This is the first slice because it is read-only, already fits the current AOJ Workbench `search`/`execute` public interface, and exercises the core Composio session workflow without write-side risk.

Public MCP calls remain:

```json
{ "tool": "search", "arguments": { "service": "drive", "operation": "search" } }
```

```json
{
  "tool": "execute",
  "arguments": {
    "service": "drive",
    "operation": "search",
    "args": { "query": "workbench smoke test", "pageSize": 5 }
  }
}
```

Target internal behavior:

- `search` wraps Composio session discovery/schema/auth-status behavior for the relevant Google Drive search capability.
- `execute` runs the selected Google Drive search capability through the Composio session execution path.
- The agent-facing service and operation names stay `drive.search` for this slice; Composio tool slugs remain provider implementation details.
- The result should preserve the behavior-level contract needed by agents: query, result count, and a bounded list of files with stable identifiers, names, MIME types, timestamps when available, and view links when available.

## Behavior-Level Test Plan

Add tests before provider code changes.

- `search` capability discovery: calling the AOJ Workbench `search` handler with `{ service: "drive", operation: "search" }` returns a Google Drive search capability, a usable input schema, connection/auth status, and execution guidance.
- `execute` happy path: calling the AOJ Workbench `execute` handler with `{ service: "drive", operation: "search", args: { query, pageSize } }` delegates to a fake Composio session executor and returns the normalized Drive search result shape.
- `execute` auth-needed path: when Composio reports the Google Drive toolkit is not connected, AOJ Workbench returns an auth-needed result with connection guidance instead of falling back to direct Google OAuth.
- `execute` argument validation: invalid or missing `query` is rejected through the AOJ Workbench handler before provider execution.
- legacy removal guard: after the Composio-backed behavior is green, `drive.search` must no longer call `google.drive(...).files.list` or the legacy direct Google Drive search module.

Use fake Composio session/discovery/execution dependencies in unit tests so behavior can be proven without live provider credentials. Keep any live provider check in smoke tests, not in the deterministic test suite.

## Smoke Test Procedure

Run smoke tests only against the deployed Cloudflare Workers `/mcp` endpoint. Do not use local stdio, local HTTP, Docker, or local bootstrap flows as MCP client connection paths.

Prerequisites:

- `COMPOSIO_API_KEY` is configured as a Worker secret.
- `AOJ_WORKBENCH_USER_ID` points at the stable Composio user with a connected Google Drive account.
- `AOJ_WORKBENCH_MCP_TOKEN` is set locally to the deployed Worker's `MCP_BEARER_TOKEN`.
- No provider OAuth client IDs, provider OAuth client secrets, or raw provider credentials are present in the repo, docs, PR body, or terminal output.

1. List AOJ Workbench tools through `/mcp`.
   Expected: the authenticated remote endpoint lists exactly `search` and `execute`.

2. Call `search` for `drive.search`.
   Expected: the response describes a Composio-backed Google Drive search capability, includes or references the input schema, and reports whether the Google Drive connection is active for `AOJ_WORKBENCH_USER_ID`.

3. If auth is not active, complete the Composio managed-auth connection flow outside the repo and rerun step 2.
   Expected: the follow-up `search` response reports the capability as executable.

4. Call `execute` for a bounded, non-sensitive Drive query.
   Expected: the response returns a normalized search result with a bounded `files` list and no provider credentials, raw tokens, private mailbox aliases, or raw email addresses.

5. Confirm the direct Google path for `drive.search` has been removed in the provider replacement PR.
   Expected: no permanent dual provider paths remain for this behavior.

## Removal Rule

The replacement PR for this slice is not complete when Composio execution merely works beside the existing direct Google path. Once the Composio-backed `drive.search` behavior is green, remove the matching legacy direct-Google Drive search path in the same slice.

Permanent dual provider paths are not allowed. A temporary dual path is acceptable only while the replacement slice is red or actively in progress.

## Privacy Boundary

Do not publish private mailbox aliases, raw email addresses, provider credentials, OAuth tokens, Composio API keys, Cloudflare tokens, or connected-account inventories in tests, docs, issue comments, PR bodies, logs, or smoke evidence.

## Sources

- Composio Tools and toolkits: https://docs.composio.dev/docs/tools-and-toolkits
- Composio sessions: https://docs.composio.dev/docs/how-composio-works
- Composio sessions vs direct execution: https://docs.composio.dev/docs/sessions-vs-direct-execution
