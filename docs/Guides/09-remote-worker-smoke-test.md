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
- AOJ Workbench `search` discovery is Composio-backed for migrated services
- optional AOJ Workbench `execute` smoke payloads run through the Composio provider runtime

The script redacts configured secret values before printing failures.
