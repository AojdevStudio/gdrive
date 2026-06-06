/**
 * Cloudflare Workers entry point for AOJ Workbench.
 *
 * Uses WebStandardStreamableHTTPServerTransport (MCP SDK v1.27+) to handle
 * MCP-over-HTTP. Each request is stateless; the Worker does NOT maintain
 * per-session state (sessionIdGenerator: undefined).
 *
 * Auth flow:
 *   1. MCP clients authenticate to AOJ Workbench with MCP_BEARER_TOKEN.
 *   2. Provider auth is handled by Composio managed auth for AOJ_WORKBENCH_USER_ID.
 *
 * To deploy:
 *   1. Set secrets: COMPOSIO_API_KEY, AOJ_WORKBENCH_USER_ID, MCP_BEARER_TOKEN
 *   2. Deploy: wrangler deploy
 */

import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { WorkersKVCache, NullCache } from './src/storage/kv-store.js';
import { createConfiguredServer } from './src/server/factory.js';
import { jsonError, validateBearerRequest } from './src/server/http-auth.js';
import { WORKER_ROOT_RESPONSE } from './src/server/identity.js';
import {
  jsonMetadata,
  oauthAuthorizationServerNotImplemented,
  protectedResourceMetadata,
} from './src/server/http-metadata.js';

export interface KVNamespace {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
}

export interface Env {
  GDRIVE_KV: KVNamespace;
  COMPOSIO_API_KEY?: string;
  AOJ_WORKBENCH_USER_ID?: string;
  MCP_BEARER_TOKEN?: string;
  MCP_ALLOWED_ORIGINS?: string;
  MCP_AUTHORIZATION_SERVER_URL?: string;
  LOG_LEVEL?: string;
}

export function validateWorkerRequestAuth(request: Request, env: Env): Response | null {
  return validateBearerRequest(request, {
    requiredToken: env.MCP_BEARER_TOKEN,
    allowedOrigins: env.MCP_ALLOWED_ORIGINS,
    runtimeName: 'Cloudflare Worker',
  });
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

    if (request.method === 'GET' && url.pathname === '/.well-known/oauth-protected-resource') {
      return jsonMetadata(
        protectedResourceMetadata(request.url, {
          authorizationServerUrl: env.MCP_AUTHORIZATION_SERVER_URL,
        })
      );
    }

    if (request.method === 'GET' && url.pathname === '/.well-known/oauth-authorization-server') {
      return jsonMetadata(oauthAuthorizationServerNotImplemented(), 501);
    }

    // Only handle POST requests to /mcp (or root)
    if (request.method !== 'POST' || (url.pathname !== '/' && url.pathname !== '/mcp')) {
      return new Response(WORKER_ROOT_RESPONSE, {
        status: url.pathname === '/' ? 200 : 404,
      });
    }

    const authError = validateWorkerRequestAuth(request, env);
    if (authError) {
      return authError;
    }

    const logger = makeLogger();

    if (!env.COMPOSIO_API_KEY || !env.AOJ_WORKBENCH_USER_ID) {
      logger.error('Composio provider runtime configuration missing');
      return jsonError(
        500,
        'Composio provider runtime is not configured',
        'Set COMPOSIO_API_KEY and AOJ_WORKBENCH_USER_ID on the deployed Worker.'
      );
    }

    const cache = env.GDRIVE_KV ? new WorkersKVCache(env.GDRIVE_KV) : new NullCache();

    const performanceMonitor = {
      track: (_op: string, _dur: number, _err?: boolean) => { /* noop in Workers */ },
    };

    const server = createConfiguredServer({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      logger: logger as any,
      cacheManager: cache,
      performanceMonitor,
      composio: {
        apiKey: env.COMPOSIO_API_KEY,
        userId: env.AOJ_WORKBENCH_USER_ID,
      },
    });

    // No sessionIdGenerator means stateless mode in MCP SDK transport.
    const transport = new WebStandardStreamableHTTPServerTransport();

    await server.connect(transport);

    return transport.handleRequest(request);
  },
};
