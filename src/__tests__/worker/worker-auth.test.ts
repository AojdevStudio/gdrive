import { describe, it, expect } from '@jest/globals';
import { validateWorkerRequestAuth, type Env } from '../../../worker.js';

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

describe('validateWorkerRequestAuth', () => {
  it('returns 500 when bearer token secret is missing', async () => {
    const request = new Request('https://example.com/mcp', { method: 'POST' });
    const env = makeEnv();
    delete env.MCP_BEARER_TOKEN;

    const response = validateWorkerRequestAuth(request, env);

    expect(response?.status).toBe(500);
    const body = await response?.json();
    expect(body.error).toBe('Worker misconfiguration');
  });

  it('returns 401 for missing Authorization header', async () => {
    const request = new Request('https://example.com/mcp', { method: 'POST' });

    const response = validateWorkerRequestAuth(request, makeEnv());

    expect(response?.status).toBe(401);
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
