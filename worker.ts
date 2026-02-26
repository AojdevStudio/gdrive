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

export interface Env {
  GDRIVE_KV: KVNamespace;
  GDRIVE_CLIENT_ID: string;
  GDRIVE_CLIENT_SECRET: string;
  GDRIVE_TOKEN_ENCRYPTION_KEY: string;
  MCP_BEARER_TOKEN?: string;
  MCP_ALLOWED_ORIGINS?: string;
  LOG_LEVEL?: string;
}

function jsonError(status: number, error: string, detail?: string): Response {
  return new Response(
    JSON.stringify({
      error,
      ...(detail ? { detail } : {}),
    }),
    {
      status,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}

function parseAllowedOrigins(raw?: string): Set<string> {
  if (!raw) {
    return new Set();
  }
  return new Set(
    raw
      .split(',')
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0)
  );
}

export function validateWorkerRequestAuth(request: Request, env: Env): Response | null {
  if (!env.MCP_BEARER_TOKEN) {
    return jsonError(500, 'Worker misconfiguration', 'MCP_BEARER_TOKEN is not configured');
  }

  const authHeader = request.headers.get('authorization');
  const expected = `Bearer ${env.MCP_BEARER_TOKEN}`;
  if (!authHeader || authHeader !== expected) {
    return jsonError(401, 'Unauthorized', 'Missing or invalid bearer token');
  }

  const allowedOrigins = parseAllowedOrigins(env.MCP_ALLOWED_ORIGINS);
  if (allowedOrigins.size > 0) {
    const origin = request.headers.get('origin');
    if (origin && !allowedOrigins.has(origin)) {
      return jsonError(403, 'Forbidden', 'Origin not allowed');
    }
  }

  return null;
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

    const authError = validateWorkerRequestAuth(request, env);
    if (authError) {
      return authError;
    }

    const logger = makeLogger();

    // Resolve auth
    let accessToken: string;
    try {
      accessToken = await getValidAccessToken(
        env.GDRIVE_KV,
        env.GDRIVE_CLIENT_ID,
        env.GDRIVE_CLIENT_SECRET,
        env.GDRIVE_TOKEN_ENCRYPTION_KEY
      );
    } catch (err) {
      logger.error('Auth failed', err);
      return jsonError(401, 'Authentication failed', String(err));
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

    // No sessionIdGenerator means stateless mode in MCP SDK transport.
    const transport = new WebStandardStreamableHTTPServerTransport();

    await server.connect(transport);

    return transport.handleRequest(request);
  },
};
