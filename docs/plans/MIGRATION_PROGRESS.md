# v4.0.0 Migration Progress
Branch: feat/v4-cloudflare-workers-migration

## Files Created ✅
- src/sdk/executor.ts — Executor interface + ExecuteResult type
- src/sdk/rate-limiter.ts — RateLimiter class (token bucket, 10 req/s per service)
- src/sdk/sandbox-node.ts — NodeSandbox using Node vm.createContext()
- src/sdk/spec.ts — Full SDK_SPEC with all 47 operations across 6 services
- src/sdk/types.ts — FullContext, SDKRuntime, re-exports from executor.ts

## Files Created ✅ (Phase 2 — 2026-02-25)
- src/sdk/runtime.ts — createSDKRuntime(context: FullContext): SDKRuntime (47 rate-limited operations)
- src/server/bootstrap.ts — createLogger(), createPerformanceMonitor(), createCacheManager()
- src/server/factory.ts — createConfiguredServer() with ONLY search + execute tools
- src/server/transports/stdio.ts — runStdioServer() + authenticateAndSave()
- index.ts — Thin entry point (73 lines)
- wrangler.toml — Worker config (KV namespace ID still TO_BE_FILLED — run: wrangler kv:namespace create GDRIVE_KV --preview false)
- src/auth/workers-auth.ts — refreshAccessToken() + getValidAccessToken() via fetch()
- src/storage/kv-store.ts — WorkersKVCache + encryptToken/decryptToken (Web Crypto / AES-GCM)
- worker.ts — Workers entry point with WebStandardStreamableHTTPServerTransport
- tsconfig.worker.json — Workers TS config (WebWorker lib)
- package.json — version 4.0.0-alpha + deploy:worker/dev:worker/build:worker scripts
- scripts/rotate-key.ts — Extracted key rotation utility
- scripts/verify-keys.ts — Extracted token verification utility

## Remaining Work
- Fill in wrangler.toml KV namespace id (run: wrangler kv:namespace create GDRIVE_KV --preview false)
- Upload tokens to KV: wrangler kv:key put --namespace-id=<id> "gdrive:oauth:tokens" "$(cat .tokens.json)"
- Set Worker secrets: wrangler secret put GDRIVE_CLIENT_ID && wrangler secret put GDRIVE_CLIENT_SECRET
- Deploy: npm run deploy:worker
- Phase 2 sandbox: Replace NodeSandbox with Workers-native V8 isolation (no vm module needed)

## Key Technical Facts
- MCP SDK: v1.27.1 installed
- Workers transport: @modelcontextprotocol/sdk/server/webStandardStreamableHttp.js (WebStandardStreamableHTTPServerTransport)
- Node transport: @modelcontextprotocol/sdk/server/streamableHttp.js (StreamableHTTPServerTransport)
- Stdio transport: @modelcontextprotocol/sdk/server/stdio.js (StdioServerTransport)
- No googleapis on Workers — use direct fetch() REST calls
- No isolated-vm — using Node vm.createContext() for Phase 1 sandbox
- wrangler v4.68.1 in devDeps, user already logged in + repo connected to CF

## runtime.ts Design
```typescript
import type { FullContext } from './types.js';
import { RateLimiter } from './rate-limiter.js';

export function createSDKRuntime(context: FullContext) {
  const limiter = new RateLimiter();
  return {
    drive: {
      search: limiter.wrap('drive', async (opts) => {
        const { search } = await import('../modules/drive/index.js');
        return search(opts as Parameters<typeof search>[0], context);
      }),
      // ... all 47 ops
    }
  };
}
```

## factory.ts Design
- server.setRequestHandler(ListToolsRequestSchema) → returns ONLY 2 tools: search + execute
- search tool: NodeSandbox.execute(code, { spec: SDK_SPEC })
- execute tool: NodeSandbox.execute(code, { sdk: createSDKRuntime(context) })
- REMOVE all 6 legacy tool registrations

## worker.ts Transport
```typescript
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined });
await server.connect(transport);
return transport.handleRequest(request);
```

## wrangler.toml
```toml
name = "gdrive-mcp"
main = "worker.ts"
compatibility_date = "2026-02-01"
compatibility_flags = ["nodejs_compat"]
[[kv_namespaces]]
binding = "GDRIVE_KV"
id = "TO_BE_FILLED"  # wrangler kv:namespace create GDRIVE_KV --preview false
```
