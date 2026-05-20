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
});
