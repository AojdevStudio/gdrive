import { afterEach, describe, it, expect, jest } from '@jest/globals';
import worker, { validateWorkerRequestAuth, type Env } from '../../../worker.js';
import { encryptToken } from '../../storage/kv-store.js';
import { KV_TOKEN_KEY, type WorkersTokenData } from '../../auth/workers-auth.js';

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
    MCP_BEARER_TOKEN: 'secret-token',
    ...overrides,
  };
}

function makeTokens(overrides: Partial<WorkersTokenData> = {}): WorkersTokenData {
  return {
    access_token: 'access-token-secret',
    refresh_token: 'refresh-token-secret',
    expiry_date: Date.now() + 10 * 60_000,
    token_type: 'Bearer',
    scope: 'scope',
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

describe('worker Google OAuth failures', () => {
  it('points missing Google OAuth token state to remote setup routes', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);

    const response = await worker.fetch(
      new Request('https://example.com/mcp', {
        method: 'POST',
        headers: { Authorization: 'Bearer secret-token' },
      }),
      makeEnv(),
      {}
    );

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body).toEqual({
      error: 'Google OAuth token resolution failed',
      detail: 'Use /setup/status to inspect remote Google OAuth state, then /setup/google/start to recover.',
    });
    expect(JSON.stringify(body)).not.toMatch(/node|dist\/index|stdio|docker|local auth/i);
  });

  it('points Google OAuth refresh failures to remote setup and does not leak secrets', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);

    const key = Buffer.alloc(32).toString('base64');
    const expiredTokens = makeTokens({ expiry_date: Date.now() - 60_000 });
    const encrypted = await encryptToken(JSON.stringify(expiredTokens), key);
    const kv = {
      get: jest.fn(async (keyName: string) =>
        keyName === KV_TOKEN_KEY
          ? JSON.stringify({ format: 'workers-aes-gcm-v1', data: encrypted })
          : null
      ),
      put: jest.fn(async () => undefined),
      delete: jest.fn(async () => undefined),
    };

    jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: 'invalid_grant', refresh_token: 'refresh-token-secret' }),
      text: async () => 'refresh-token-secret client-secret secret-token',
    } as unknown as Response);

    const response = await worker.fetch(
      new Request('https://example.com/mcp', {
        method: 'POST',
        headers: { Authorization: 'Bearer secret-token' },
      }),
      makeEnv({
        GDRIVE_KV: kv,
        GDRIVE_TOKEN_ENCRYPTION_KEY: key,
        GDRIVE_CLIENT_SECRET: 'client-secret',
      }),
      {}
    );

    expect(response.status).toBe(401);
    const body = await response.json();
    const serialized = JSON.stringify(body);
    expect(body.detail).toBe(
      'Use /setup/status to inspect remote Google OAuth state, then /setup/google/start to recover.'
    );
    expect(serialized).not.toContain('access-token-secret');
    expect(serialized).not.toContain('refresh-token-secret');
    expect(serialized).not.toContain('client-secret');
    expect(serialized).not.toContain('secret-token');
    expect(serialized).not.toMatch(/node|dist\/index|stdio|docker|local auth/i);
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
