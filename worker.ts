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
 *   3. Legacy /setup/google routes remain only as migration scaffolding until removed.
 *
 * To deploy:
 *   1. Create KV namespace: wrangler kv:namespace create GDRIVE_KV --preview false
 *   2. Fill in the id in wrangler.toml
 *   3. Set secrets: COMPOSIO_API_KEY, AOJ_WORKBENCH_USER_ID, MCP_BEARER_TOKEN
 *   4. Deploy: wrangler deploy
 */

import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { WorkersKVCache, NullCache } from './src/storage/kv-store.js';
import type { KVNamespace } from './src/auth/workers-auth.js';
import {
  handleGoogleOAuthCallback,
  handleGoogleOAuthStart,
  handleGoogleOAuthStatus,
} from './src/auth/workers-oauth.js';
import { createConfiguredServer } from './src/server/factory.js';
import { jsonError, validateBearerRequest } from './src/server/http-auth.js';
import { WORKER_ROOT_RESPONSE } from './src/server/identity.js';
import {
  jsonMetadata,
  oauthAuthorizationServerNotImplemented,
  protectedResourceMetadata,
} from './src/server/http-metadata.js';

export interface Env {
  GDRIVE_KV: KVNamespace;
  GDRIVE_CLIENT_ID?: string;
  GDRIVE_CLIENT_SECRET?: string;
  GDRIVE_TOKEN_ENCRYPTION_KEY?: string;
  COMPOSIO_API_KEY?: string;
  AOJ_WORKBENCH_USER_ID?: string;
  MCP_BEARER_TOKEN?: string;
  MCP_SETUP_TOKEN?: string;
  MCP_ALLOWED_ORIGINS?: string;
  MCP_AUTHORIZATION_SERVER_URL?: string;
  LOG_LEVEL?: string;
}

/**
 * Validate an incoming Cloudflare Worker request's bearer authentication using environment configuration.
 *
 * @param request - The incoming HTTP request to validate.
 * @param env - Worker environment providing MCP authentication settings (e.g., `MCP_BEARER_TOKEN`, `MCP_ALLOWED_ORIGINS`).
 * @returns An error `Response` when authentication fails, `null` when authentication succeeds.
 */
export function validateWorkerRequestAuth(request: Request, env: Env): Response | null {
  return validateBearerRequest(request, {
    requiredToken: env.MCP_BEARER_TOKEN,
    allowedOrigins: env.MCP_ALLOWED_ORIGINS,
    runtimeName: 'Cloudflare Worker',
  });
}

/**
 * Creates a minimal logger whose methods write prefixed messages to the console.
 *
 * @returns An object with methods `info`, `warn`, `error`, and `debug` that forward their arguments to the corresponding console method prefixed with `[INFO]`, `[WARN]`, `[ERROR]`, and `[DEBUG]` respectively.
 */
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

    if (request.method === 'GET' && url.pathname === '/setup/google/start') {
      return handleGoogleOAuthStart(request, env);
    }

    if (request.method === 'GET' && url.pathname === '/setup/google/callback') {
      return handleGoogleOAuthCallback(request, env);
    }

    if (request.method === 'GET' && url.pathname === '/setup/status') {
      return handleGoogleOAuthStatus(request, env);
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
