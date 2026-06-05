import { afterEach, describe, it, expect, jest } from '@jest/globals';
import worker, { validateWorkerRequestAuth, type Env } from '../../../worker.js';

function makeEnv(overrides: Partial<Env> = {}): Env {
  return {
    GDRIVE_KV: {
      get: async () => null,
      put: async () => undefined,
      delete: async () => undefined,
    },
    GDRIVE_CLIENT_ID: 'client-id',
    GDRIVE_CLIENT_SECRET: 'client-secret',
    GDRIVE_TOKEN_ENCRYPTION_KEY: Buffer.alloc(32).toString('base64'),
    COMPOSIO_API_KEY: 'composio-key-secret',
    AOJ_WORKBENCH_USER_ID: 'aoj-workbench-user',
    MCP_BEARER_TOKEN: 'secret-token',
    ...overrides,
  };
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe('validateWorkerRequestAuth', () => {
  it('returns 500 when bearer token secret is missing', async () => {
    const request = new Request('https://example.com/mcp', { method: 'POST' });
    const env = makeEnv();
    delete env.MCP_BEARER_TOKEN;

    const response = validateWorkerRequestAuth(request, env);

    expect(response?.status).toBe(500);
    const body = await response?.json();
    expect(body.error).toBe('Server misconfiguration');
  });

  it('returns 401 for missing Authorization header', async () => {
    const request = new Request('https://example.com/mcp', { method: 'POST' });

    const response = validateWorkerRequestAuth(request, makeEnv());

    expect(response?.status).toBe(401);
    expect(response?.headers.get('www-authenticate')).toBe('Bearer');
    const body = await response?.json();
    expect(body.error).toBe('Unauthorized');
  });

  it('returns 403 for disallowed origin when allowlist configured', async () => {
    const request = new Request('https://example.com/mcp', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer secret-token',
        Origin: 'https://evil.example.com',
      },
    });

    const response = validateWorkerRequestAuth(
      request,
      makeEnv({ MCP_ALLOWED_ORIGINS: 'https://trusted.example.com' })
    );

    expect(response?.status).toBe(403);
    const body = await response?.json();
    expect(body.error).toBe('Forbidden');
  });

  it('allows valid bearer token and allowed origin', () => {
    const request = new Request('https://example.com/mcp', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer secret-token',
        Origin: 'https://trusted.example.com',
      },
    });

    const response = validateWorkerRequestAuth(
      request,
      makeEnv({ MCP_ALLOWED_ORIGINS: 'https://trusted.example.com' })
    );

    expect(response).toBeNull();
  });
});

describe('worker Composio provider failures', () => {
  it('points missing Composio provider config to remote Worker secrets', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const env = makeEnv();
    delete env.COMPOSIO_API_KEY;

    const response = await worker.fetch(
      new Request('https://example.com/mcp', {
        method: 'POST',
        headers: { Authorization: 'Bearer secret-token' },
      }),
      env,
      {}
    );

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body).toEqual({
      error: 'Composio provider runtime is not configured',
      detail: 'Set COMPOSIO_API_KEY and AOJ_WORKBENCH_USER_ID on the deployed Worker.',
    });
    expect(JSON.stringify(body)).not.toContain('composio-key-secret');
    expect(JSON.stringify(body)).not.toMatch(/node|dist\/index|stdio|docker|local auth/i);
  });

  it('does not consult legacy Google OAuth state before listing MCP tools', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: 'invalid_grant', refresh_token: 'refresh-token-secret' }),
      text: async () => 'refresh-token-secret client-secret secret-token',
    } as unknown as Response);

    const response = await worker.fetch(
      new Request('https://example.com/mcp', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer secret-token',
          'Content-Type': 'application/json',
          Accept: 'application/json, text/event-stream',
        },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }),
      }),
      makeEnv({ GDRIVE_CLIENT_SECRET: 'client-secret' }),
      {}
    );

    expect(response.status).toBe(200);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('worker metadata endpoints', () => {
  it('returns protected resource metadata', async () => {
    const response = await worker.fetch(
      new Request('https://example.com/.well-known/oauth-protected-resource', { method: 'GET' }),
      makeEnv(),
      {}
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      resource: 'https://example.com/mcp',
      authorization_servers: [],
      auth_mode: 'static_bearer',
      mcp_endpoint: '/mcp',
      note: 'Static bearer auth is currently required. OAuth authorization server metadata is not implemented.',
    });
  });

  it('advertises external authorization server metadata when configured', async () => {
    const response = await worker.fetch(
      new Request('https://example.com/.well-known/oauth-protected-resource', { method: 'GET' }),
      makeEnv({ MCP_AUTHORIZATION_SERVER_URL: 'https://auth.example.com' }),
      {}
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      resource: 'https://example.com/mcp',
      authorization_servers: ['https://auth.example.com'],
      auth_mode: 'external_oauth_metadata',
      mcp_endpoint: '/mcp',
      note: 'External OAuth authorization server metadata is advertised, but this server still validates static bearer auth only.',
    });
  });

  it('returns a clear OAuth authorization server metadata error', async () => {
    const response = await worker.fetch(
      new Request('https://example.com/.well-known/oauth-authorization-server', { method: 'GET' }),
      makeEnv(),
      {}
    );

    expect(response.status).toBe(501);
    expect(await response.json()).toEqual({
      error: 'OAuth authorization server is not implemented',
      auth_mode: 'static_bearer',
      mcp_endpoint: '/mcp',
    });
  });
});
