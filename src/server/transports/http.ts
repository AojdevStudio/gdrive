import http, { type IncomingMessage, type ServerResponse } from 'node:http';
import * as fs from 'node:fs';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { google } from 'googleapis';
import { AuthManager, AuthState } from '../../auth/AuthManager.js';
import { createCacheManager, createLogger, createPerformanceMonitor } from '../bootstrap.js';
import { createConfiguredServer } from '../factory.js';
import { jsonError, validateBearerRequest } from '../http-auth.js';
import {
  oauthAuthorizationServerNotImplemented,
  protectedResourceMetadata,
} from '../http-metadata.js';
import { NodeSandbox } from '../../sdk/sandbox-node.js';
import { resolveOAuthPath } from './stdio.js';

export interface HttpServerOptions {
  host?: string | undefined;
  port?: number | undefined;
}

export interface HttpRequestHandlerConfig {
  bearerToken?: string | undefined;
  allowedOrigins?: string | undefined;
  createServer: () => {
    connect(transport: unknown): Promise<void>;
  };
}

function writeText(res: ServerResponse, status: number, body: string): void {
  res.writeHead(status, {
    'Content-Type': 'text/plain; charset=utf-8',
  });
  res.end(body);
}

function writeJson(res: ServerResponse, status: number, body: Record<string, unknown>): void {
  res.writeHead(status, {
    'Content-Type': 'application/json',
  });
  res.end(JSON.stringify(body));
}

async function writeWebResponse(res: ServerResponse, response: Response): Promise<void> {
  const headers: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    headers[key] = value;
  });

  res.writeHead(response.status, headers);
  const body = Buffer.from(await response.arrayBuffer());
  res.end(body);
}

function requestUrl(req: IncomingMessage): string {
  const host = req.headers.host ?? '127.0.0.1';
  return `http://${host}${req.url ?? '/'}`;
}

function authRequestFrom(req: IncomingMessage): Request {
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        headers.append(key, item);
      }
    } else if (value !== undefined) {
      headers.set(key, value);
    }
  }

  return new Request(requestUrl(req), {
    method: req.method ?? 'GET',
    headers,
  });
}

export function createHttpRequestHandler(
  config: HttpRequestHandlerConfig
): (req: IncomingMessage, res: ServerResponse) => Promise<void> {
  return async (req, res) => {
    const url = new URL(requestUrl(req));

    if (req.method === 'GET' && url.pathname === '/healthz') {
      writeJson(res, 200, {
        ok: true,
        transport: 'http',
        mcp_endpoint: '/mcp',
      });
      return;
    }

    if (req.method === 'GET' && url.pathname === '/') {
      writeText(res, 200, 'gdrive-mcp HTTP transport v4.0.0-alpha\nPOST /mcp to connect.');
      return;
    }

    if (req.method === 'GET' && url.pathname === '/.well-known/oauth-protected-resource') {
      writeJson(res, 200, protectedResourceMetadata(requestUrl(req)));
      return;
    }

    if (req.method === 'GET' && url.pathname === '/.well-known/oauth-authorization-server') {
      writeJson(res, 501, oauthAuthorizationServerNotImplemented());
      return;
    }

    if (req.method !== 'POST' || url.pathname !== '/mcp') {
      writeJson(res, 404, {
        error: 'Not Found',
        detail: 'Use POST /mcp for MCP requests.',
      });
      return;
    }

    const authError = validateBearerRequest(authRequestFrom(req), {
      requiredToken: config.bearerToken,
      allowedOrigins: config.allowedOrigins,
      runtimeName: 'Node HTTP transport',
    });
    if (authError) {
      await writeWebResponse(res, authError);
      return;
    }

    try {
      const server = config.createServer();
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
      } as unknown as ConstructorParameters<typeof StreamableHTTPServerTransport>[0]);
      await server.connect(transport);
      await transport.handleRequest(req, res);
    } catch (err) {
      if (!res.headersSent) {
        await writeWebResponse(
          res,
          jsonError(500, 'MCP request failed', err instanceof Error ? err.message : String(err))
        );
      } else {
        res.end();
      }
    }
  };
}

function readOAuthKeys(oauthPath: string): unknown {
  const keysContent = fs.readFileSync(oauthPath, 'utf-8');
  return JSON.parse(keysContent) as unknown;
}

function getOAuthConfig(keys: unknown): unknown {
  if (!keys || typeof keys !== 'object') {
    return null;
  }

  const record = keys as Record<string, unknown>;
  return record.web ?? record.installed ?? null;
}

export async function runHttpServer(options: HttpServerOptions = {}): Promise<void> {
  const logger = createLogger();

  if (!process.env.GDRIVE_TOKEN_ENCRYPTION_KEY) {
    throw new Error('GDRIVE_TOKEN_ENCRYPTION_KEY environment variable is required.');
  }

  if (!process.env.MCP_BEARER_TOKEN) {
    throw new Error('MCP_BEARER_TOKEN environment variable is required for HTTP transport.');
  }

  const oauthPath = resolveOAuthPath();
  if (!fs.existsSync(oauthPath)) {
    throw new Error('OAuth keys file not found. Set GDRIVE_OAUTH_PATH or place keys in credentials/.');
  }

  const oauthKeys = getOAuthConfig(readOAuthKeys(oauthPath));
  if (!oauthKeys) {
    throw new Error("Invalid OAuth keys format. Expected 'web' or 'installed' configuration.");
  }

  // AuthManager accepts the OAuth config shape parsed from Google OAuth keys.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const authManager = AuthManager.getInstance(oauthKeys as any, logger);
  await authManager.initialize();

  if (authManager.getState() === AuthState.UNAUTHENTICATED) {
    throw new Error('Authentication required. Run node ./dist/index.js auth first.');
  }

  const oauth2Client = authManager.getOAuth2Client();
  google.options({ auth: oauth2Client });

  const cacheManager = await createCacheManager(logger);
  const performanceMonitor = createPerformanceMonitor();
  const host = options.host ?? '127.0.0.1';
  const port = options.port ?? 8788;

  const handler = createHttpRequestHandler({
    bearerToken: process.env.MCP_BEARER_TOKEN,
    allowedOrigins: process.env.MCP_ALLOWED_ORIGINS,
    createServer: () =>
      createConfiguredServer({
        logger,
        cacheManager,
        performanceMonitor,
        auth: oauth2Client,
        sandbox: new NodeSandbox(),
      }) as unknown as { connect(transport: unknown): Promise<void> },
  });

  const httpServer = http.createServer((req, res) => {
    void handler(req, res);
  });

  await new Promise<void>((resolve, reject) => {
    httpServer.once('error', reject);
    httpServer.listen(port, host, () => {
      httpServer.off('error', reject);
      resolve();
    });
  });

  logger.info('MCP server started successfully (http).', {
    url: `http://${host}:${port}/mcp`,
  });
}
