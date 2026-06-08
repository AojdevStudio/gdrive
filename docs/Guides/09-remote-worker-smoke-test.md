# Remote Worker Smoke Test

The smoke test validates the remote-only Worker contract without starting local MCP transports.

## Fixture Smoke Test

The Jest fixture covers:

- unauthenticated `/mcp` rejection
- authenticated `tools/list` exposing `search` and `execute`
- missing Composio provider config recovery guidance
- no legacy provider auth calls before authenticated tool listing
- redaction of bearer tokens and provider API keys

Run it with:

```bash
npm test -- --runTestsByPath src/__tests__/worker/remote-worker-smoke.test.ts
```

## Deployed Worker Smoke Test

Target a deployed Worker URL:

```bash
WORKER_URL=https://your-worker.workers.dev \
MCP_BEARER_TOKEN=replace-with-worker-mcp-token \
npm run smoke:worker
```

The live smoke test verifies:

- root Worker identity response
- unauthenticated `/mcp` rejection
- authenticated `tools/list` exposes exactly `search` and `execute`
- legacy Google setup routes return `404`
- AOJ Workbench `search` discovery is Composio-backed for migrated services
- optional AOJ Workbench `execute` smoke payloads run through the Composio provider runtime

## Optional Execute Smoke Payloads

`AOJ_WORKBENCH_SMOKE_EXECUTE_JSON` can provide live execution checks:

```bash
WORKER_URL=https://your-worker.workers.dev \
MCP_BEARER_TOKEN=replace-with-worker-mcp-token \
AOJ_WORKBENCH_SMOKE_EXECUTE_JSON='[
  {
    "service": "forms",
    "operation": "createForm",
    "args": { "title": "AOJ Workbench smoke test" }
  }
]' \
npm run smoke:worker
```

Before running Forms execute smoke payloads, confirm the Composio account for `AOJ_WORKBENCH_USER_ID` is connected to a Google account with Google Forms access. Without that connected account, discovery can pass while Forms execution correctly fails with provider-auth guidance.

## Redaction Rules

The script redacts configured bearer tokens, Composio API keys, AOJ Workbench MCP client tokens, and legacy Google token env values before printing failures.

Do not include raw secrets, private aliases, connected-account inventories, raw email data, or provider result bodies in smoke payloads, logs, PRs, issues, or docs. Keep live execute payloads minimal and synthetic.
