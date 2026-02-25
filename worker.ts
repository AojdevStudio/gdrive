/**
 * Cloudflare Workers entry point for the gdrive MCP server.
 *
 * Uses WebStandardStreamableHTTPServerTransport (MCP SDK v1.27+) to handle
 * MCP-over-HTTP. Each request is stateless; the Worker does NOT maintain
 * per-session state (sessionIdGenerator: undefined).
 *
 * Auth flow:
 *   1. getValidAccessToken() reads tokens from GDRIVE_KV, refreshes if needed.
 *   2. A lightweight fetch-based auth object is injected into every Google API call.
 *
 * To deploy:
 *   1. Create KV namespace: wrangler kv:namespace create GDRIVE_KV --preview false
 *   2. Fill in the id in wrangler.toml
 *   3. Upload tokens: wrangler kv:key put --namespace-id=<id> "gdrive:oauth:tokens" "$(cat .tokens.json)"
 *   4. Set secrets: wrangler secret put GDRIVE_CLIENT_ID && wrangler secret put GDRIVE_CLIENT_SECRET
 *   5. Deploy: wrangler deploy
 */

import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { WorkersKVCache, NullCache } from './src/storage/kv-store.js';
import { getValidAccessToken, type KVNamespace } from './src/auth/workers-auth.js';
import { createConfiguredServer } from './src/server/factory.js';

// Workers runtime globals — declared locally to avoid requiring @cloudflare/workers-types
declare const ExecutionContext: unknown;

export interface Env {
  GDRIVE_KV: KVNamespace;
  GDRIVE_CLIENT_ID: string;
  GDRIVE_CLIENT_SECRET: string;
  LOG_LEVEL?: string;
}

// Minimal auth object that satisfies googleapis' getAccessToken() contract
function makeAuth(accessToken: string) {
  return {
    getAccessToken: async () => ({ token: accessToken, res: null }),
    getClient: async () => ({ getAccessToken: async () => ({ token: accessToken }) }),
  };
}

// Minimal logger for Workers (no winston — uses console which routes to CF logs)
function makeLogger() {
  return {
    info: (...args: unknown[]) => console.log('[INFO]', ...args),
    warn: (...args: unknown[]) => console.warn('[WARN]', ...args),
    error: (...args: unknown[]) => console.error('[ERROR]', ...args),
    debug: (...args: unknown[]) => console.debug('[DEBUG]', ...args),
  };
}

export default {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async fetch(request: Request, env: Env, _ctx: any): Promise<Response> {
    // Only handle POST requests to /mcp (or root)
    const url = new URL(request.url);
    if (request.method !== 'POST' || (url.pathname !== '/' && url.pathname !== '/mcp')) {
      return new Response('gdrive-mcp Worker v4.0.0-alpha\nPOST /mcp to connect.', {
        status: url.pathname === '/' ? 200 : 404,
      });
    }

    const logger = makeLogger();

    // Resolve auth
    let accessToken: string;
    try {
      accessToken = await getValidAccessToken(
        env.GDRIVE_KV,
        env.GDRIVE_CLIENT_ID,
        env.GDRIVE_CLIENT_SECRET
      );
    } catch (err) {
      logger.error('Auth failed', err);
      return new Response(JSON.stringify({ error: 'Authentication failed', detail: String(err) }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const auth = makeAuth(accessToken);
    const cache = env.GDRIVE_KV ? new WorkersKVCache(env.GDRIVE_KV) : new NullCache();

    const performanceMonitor = {
      track: (_op: string, _dur: number, _err?: boolean) => { /* noop in Workers */ },
    };

    const server = createConfiguredServer({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      logger: logger as any,
      cacheManager: cache,
      performanceMonitor,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      auth: auth as any,
    });

    // Stateless mode: omit sessionIdGenerator entirely so the transport doesn't
    // maintain per-session state (required for Workers' ephemeral environment).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const transport = new WebStandardStreamableHTTPServerTransport({} as any);

    await server.connect(transport);

    return transport.handleRequest(request);
  },
};
