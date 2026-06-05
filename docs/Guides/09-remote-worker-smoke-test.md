# Remote Worker Smoke Test

The smoke test validates the remote-only Worker contract without starting local MCP transports.

## Fixture Smoke Test

The Jest fixture covers:

- `/setup/status` behavior
- unauthenticated `/mcp` rejection
- authenticated `tools/list` exposing `search` and `execute`
- missing legacy Google OAuth state recovery guidance
- expired legacy token refresh through the Worker path
- redaction of access tokens, refresh tokens, authorization codes, client secrets, encryption keys, and bearer tokens

Run it with:

```bash
npm test -- --runTestsByPath src/__tests__/worker/remote-worker-smoke.test.ts
```

## Deployed Worker Smoke Test

Target a deployed Worker URL:

```bash
WORKER_URL=https://your-worker.workers.dev \
MCP_BEARER_TOKEN=replace-with-worker-mcp-token \
MCP_SETUP_TOKEN=replace-with-worker-setup-token \
npm run smoke:worker
```

The live smoke test verifies:

- root Worker identity response
- unauthenticated `/mcp` rejection
- `/setup/status` response when `MCP_SETUP_TOKEN` is provided
- authenticated `tools/list` when `MCP_BEARER_TOKEN` is provided

Legacy direct-Google smoke paths may still require Google OAuth state until provider replacement slices remove them.

The script redacts configured secret values before printing failures.
