import { describe, expect, it, jest } from '@jest/globals';
import http, { type IncomingMessage, type ServerResponse } from 'node:http';
import { AddressInfo } from 'node:net';
import { createHttpRequestHandler } from '../../server/transports/http.js';

function makeCreateServer() {
  return jest.fn(() => ({
    connect: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
  }));
}

function request(
  server: http.Server,
  path: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  } = {}
): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: string }> {
  const address = server.address() as AddressInfo;

  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: '127.0.0.1',
        port: address.port,
        path,
        method: options.method ?? 'GET',
        headers: options.headers,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => {
          resolve({
            status: res.statusCode ?? 0,
            headers: res.headers,
            body: Buffer.concat(chunks).toString('utf8'),
          });
        });
      }
    );

    req.on('error', reject);
    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

async function withServer(
  handler: (req: IncomingMessage, res: ServerResponse) => Promise<void> | void,
  testFn: (server: http.Server) => Promise<void>
): Promise<void> {
  const server = http.createServer((req, res) => {
    void handler(req, res);
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    await testFn(server);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  }
}

describe('createHttpRequestHandler', () => {
  it('returns health status from GET /healthz', async () => {
    const handler = createHttpRequestHandler({
      bearerToken: 'secret-token',
      createServer: makeCreateServer(),
    });

    await withServer(handler, async (server) => {
      const response = await request(server, '/healthz');

      expect(response.status).toBe(200);
      expect(JSON.parse(response.body)).toEqual({
        ok: true,
        transport: 'http',
        mcp_endpoint: '/mcp',
      });
    });
  });

  it('returns a banner from GET /', async () => {
    const handler = createHttpRequestHandler({
      bearerToken: 'secret-token',
      createServer: makeCreateServer(),
    });

    await withServer(handler, async (server) => {
      const response = await request(server, '/');

      expect(response.status).toBe(200);
      expect(response.body).toContain('POST /mcp');
    });
  });

  it('returns protected resource metadata', async () => {
    const handler = createHttpRequestHandler({
      bearerToken: 'secret-token',
      createServer: makeCreateServer(),
    });

    await withServer(handler, async (server) => {
      const response = await request(server, '/.well-known/oauth-protected-resource');

      expect(response.status).toBe(200);
      expect(JSON.parse(response.body)).toEqual({
        resource: expect.stringContaining('/mcp'),
        authorization_servers: [],
        auth_mode: 'static_bearer',
        mcp_endpoint: '/mcp',
        note: 'Static bearer auth is currently required. OAuth authorization server metadata is not implemented.',
      });
    });
  });

  it('advertises external authorization server metadata when configured', async () => {
    const handler = createHttpRequestHandler({
      bearerToken: 'secret-token',
      authorizationServerUrl: 'https://auth.example.com',
      createServer: makeCreateServer(),
    });

    await withServer(handler, async (server) => {
      const response = await request(server, '/.well-known/oauth-protected-resource');

      expect(response.status).toBe(200);
      expect(JSON.parse(response.body)).toEqual({
        resource: expect.stringContaining('/mcp'),
        authorization_servers: ['https://auth.example.com'],
        auth_mode: 'external_oauth_metadata',
        mcp_endpoint: '/mcp',
        note: 'External OAuth authorization server metadata is advertised, but this server still validates static bearer auth only.',
      });
    });
  });

  it('returns a clear OAuth authorization server metadata error', async () => {
    const handler = createHttpRequestHandler({
      bearerToken: 'secret-token',
      createServer: makeCreateServer(),
    });

    await withServer(handler, async (server) => {
      const response = await request(server, '/.well-known/oauth-authorization-server');

      expect(response.status).toBe(501);
      expect(JSON.parse(response.body)).toEqual({
        error: 'OAuth authorization server is not implemented',
        auth_mode: 'static_bearer',
        mcp_endpoint: '/mcp',
      });
    });
  });

  it('returns 404 for non-MCP paths', async () => {
    const handler = createHttpRequestHandler({
      bearerToken: 'secret-token',
      createServer: makeCreateServer(),
    });

    await withServer(handler, async (server) => {
      const response = await request(server, '/missing');

      expect(response.status).toBe(404);
      expect(JSON.parse(response.body).error).toBe('Not Found');
    });
  });

  it('returns 401 for POST /mcp without bearer auth', async () => {
    const createServer = makeCreateServer();
    const handler = createHttpRequestHandler({
      bearerToken: 'secret-token',
      createServer,
    });

    await withServer(handler, async (server) => {
      const response = await request(server, '/mcp', { method: 'POST', body: '{}' });

      expect(response.status).toBe(401);
      expect(response.headers['www-authenticate']).toBe('Bearer');
      expect(JSON.parse(response.body).error).toBe('Unauthorized');
      expect(createServer).not.toHaveBeenCalled();
    });
  });

  it('does not expose raw internal errors in MCP error responses', async () => {
    const createServer = jest.fn(() => {
      throw new Error('sensitive stack detail');
    });
    const handler = createHttpRequestHandler({
      bearerToken: 'secret-token',
      createServer,
    });

    await withServer(handler, async (server) => {
      const response = await request(server, '/mcp', {
        method: 'POST',
        headers: { Authorization: 'Bearer secret-token' },
        body: '{}',
      });

      expect(response.status).toBe(500);
      expect(JSON.parse(response.body)).toEqual({
        error: 'MCP request failed',
        detail: 'Internal MCP request failure',
      });
      expect(response.body).not.toContain('sensitive stack detail');
    });
  });
});
