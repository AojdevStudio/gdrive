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

// Auth adapter that satisfies googleapis' OAuth2Client contract on Workers.
// googleapis internally calls authClient.request() for API calls.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeAuth(accessToken: string): any {
  const authObj = {
    getAccessToken: async () => ({ token: accessToken, res: null }),
    getClient: async () => authObj,
    // googleapis' gaxios calls request() to make authenticated HTTP calls
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    request: async (opts: any) => {
      const url = opts.url || opts.uri;
      const method = (opts.method || 'GET').toUpperCase();
      const headers: Record<string, string> = {
        ...(opts.headers || {}),
        'Authorization': `Bearer ${accessToken}`,
      };

      // Build fetch options
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fetchOpts: any = { method, headers };
      if (opts.body) {
        fetchOpts.body = typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body);
        if (!headers['Content-Type']) {
          headers['Content-Type'] = 'application/json';
        }
      }
      if (opts.data) {
        fetchOpts.body = typeof opts.data === 'string' ? opts.data : JSON.stringify(opts.data);
        if (!headers['Content-Type']) {
          headers['Content-Type'] = 'application/json';
        }
      }

      // Handle query params
      const fetchUrl = new URL(url);
      if (opts.params) {
        for (const [key, val] of Object.entries(opts.params)) {
          if (val !== undefined && val !== null) {
            fetchUrl.searchParams.set(key, String(val));
          }
        }
      }

      const workerFetch = globalThis.fetch;
      if (typeof workerFetch !== 'function') {
        throw new Error('Fetch API is not available in this runtime');
      }
      const response = await workerFetch(fetchUrl.toString(), fetchOpts);
      if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        throw new Error(
          `Google API request failed: ${response.status} ${response.statusText}${errorBody ? ` — ${errorBody}` : ''}`
        );
      }
      const contentType = response.headers.get('content-type') ?? '';
      const data = contentType.includes('application/json')
        ? await response.json()
        : await response.text();

      return { data, status: response.status, statusText: response.statusText, headers: response.headers };
    },
  };
  return authObj;
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
    const url = new URL(request.url);

    // Tracking pixel route: GET /track/:campaignId/:recipientId/pixel.gif
    // Handled before auth — tracking pixels are fire-and-forget from email clients.
    if (request.method === 'GET' && url.pathname.startsWith('/track/')) {
      const { handleTrackingRequest } = await import('./src/server/tracking.js');
      return handleTrackingRequest(request, env.GDRIVE_KV);
    }

    // Only handle POST requests to /mcp (or root)
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
