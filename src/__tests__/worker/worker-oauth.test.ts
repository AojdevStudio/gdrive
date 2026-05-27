import { describe, it, expect, afterEach, jest } from '@jest/globals';
import worker, { type Env } from '../../../worker.js';
import { encryptToken } from '../../storage/kv-store.js';
import type { WorkersTokenData } from '../../auth/workers-auth.js';
import { GOOGLE_WORKSPACE_SCOPES } from '../../auth/workers-oauth.js';

const TEST_KEY = Buffer.alloc(32, 9).toString('base64');

class MemoryKV {
  values = new Map<string, string>();
  putCalls: Array<[string, string, { expirationTtl?: number } | undefined]> = [];
  deleteCalls: string[] = [];

  async get(key: string): Promise<string | null> {
    return this.values.get(key) ?? null;
  }

  async put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void> {
    this.values.set(key, value);
    this.putCalls.push([key, value, options]);
  }

  async delete(key: string): Promise<void> {
    this.values.delete(key);
    this.deleteCalls.push(key);
  }
}

function makeEnv(kv = new MemoryKV(), overrides: Partial<Env> = {}): Env {
  return {
    GDRIVE_KV: kv,
    GDRIVE_CLIENT_ID: 'client-id',
    GDRIVE_CLIENT_SECRET: 'client-secret',
    GDRIVE_TOKEN_ENCRYPTION_KEY: TEST_KEY,
    MCP_BEARER_TOKEN: 'mcp-secret',
    MCP_SETUP_TOKEN: 'setup-secret',
    ...overrides,
  };
}

function setupRequest(path: string): Request {
  return new Request(`https://worker.example.com${path}`, {
    method: 'GET',
    headers: { Authorization: 'Bearer setup-secret' },
  });
}

function makeTokens(overrides: Partial<WorkersTokenData> = {}): WorkersTokenData {
  return {
    access_token: 'access-token',
    refresh_token: 'refresh-token',
    expiry_date: Date.now() + 60 * 60_000,
    token_type: 'Bearer',
    scope: GOOGLE_WORKSPACE_SCOPES.join(' '),
    ...overrides,
  };
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe('remote Google OAuth setup routes', () => {
  it('creates a protected Google OAuth redirect and persists expiring state', async () => {
    const kv = new MemoryKV();
    const response = await worker.fetch(setupRequest('/setup/google/start'), makeEnv(kv), {});

    expect(response.status).toBe(302);
    const location = response.headers.get('location');
    expect(location).toBeTruthy();

    const oauthUrl = new URL(location as string);
    expect(oauthUrl.origin).toBe('https://accounts.google.com');
    expect(oauthUrl.searchParams.get('client_id')).toBe('client-id');
    expect(oauthUrl.searchParams.get('redirect_uri')).toBe(
      'https://worker.example.com/setup/google/callback'
    );
    expect(oauthUrl.searchParams.get('scope')?.split(' ').sort()).toEqual(
      [...GOOGLE_WORKSPACE_SCOPES].sort()
    );
    expect(oauthUrl.searchParams.get('access_type')).toBe('offline');
    expect(oauthUrl.searchParams.get('prompt')).toBe('consent');

    const state = oauthUrl.searchParams.get('state');
    expect(state).toMatch(/^[A-Za-z0-9_-]{40,}$/);
    expect(kv.putCalls).toHaveLength(1);
    expect(kv.putCalls[0]?.[0]).toBe(`gdrive:oauth:state:${state}`);
    expect(kv.putCalls[0]?.[2]?.expirationTtl).toBe(600);
  });

  it('rejects setup start without setup bearer auth', async () => {
    const response = await worker.fetch(
      new Request('https://worker.example.com/setup/google/start', { method: 'GET' }),
      makeEnv(),
      {}
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: 'Unauthorized',
      detail: 'Missing or invalid bearer token',
    });
  });

  it('validates callback state once and stores encrypted refresh-capable tokens', async () => {
    const kv = new MemoryKV();
    await worker.fetch(setupRequest('/setup/google/start'), makeEnv(kv), {});
    const state = [...kv.values.keys()][0]?.replace('gdrive:oauth:state:', '');

    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        expires_in: 3600,
        token_type: 'Bearer',
        scope: GOOGLE_WORKSPACE_SCOPES.join(' '),
      }),
    } as Response);

    const response = await worker.fetch(
      new Request(`https://worker.example.com/setup/google/callback?state=${state}&code=auth-code`, {
        method: 'GET',
      }),
      makeEnv(kv),
      {}
    );

    expect(response.status).toBe(200);
    const bodyText = await response.text();
    expect(bodyText).toContain('configured');
    expect(bodyText).not.toContain('new-access-token');
    expect(bodyText).not.toContain('new-refresh-token');
    expect(bodyText).not.toContain('auth-code');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(kv.deleteCalls).toContain(`gdrive:oauth:state:${state}`);

    const stored = kv.values.get('gdrive:oauth:tokens');
    expect(stored).toBeTruthy();
    expect(stored).not.toContain('new-access-token');
    expect(stored).not.toContain('new-refresh-token');
    expect(stored).not.toContain('auth-code');
    expect(JSON.parse(stored as string)).toMatchObject({ format: 'workers-aes-gcm-v1' });

    const reused = await worker.fetch(
      new Request(`https://worker.example.com/setup/google/callback?state=${state}&code=auth-code`, {
        method: 'GET',
      }),
      makeEnv(kv),
      {}
    );
    expect(reused.status).toBe(400);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('rejects reused or missing callback state before token exchange', async () => {
    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true } as Response);
    const response = await worker.fetch(
      new Request('https://worker.example.com/setup/google/callback?state=missing&code=auth-code', {
        method: 'GET',
      }),
      makeEnv(),
      {}
    );

    expect(response.status).toBe(400);
    const body = await response.json() as { detail: string };
    expect(body.detail).toContain('/setup/google/start');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('rejects expired callback state exactly once', async () => {
    const kv = new MemoryKV();
    await kv.put(
      'gdrive:oauth:state:expired-state',
      JSON.stringify({
        createdAt: Date.now() - 20 * 60_000,
        expiresAt: Date.now() - 10 * 60_000,
        redirectUri: 'https://worker.example.com/setup/google/callback',
      })
    );
    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true } as Response);

    const response = await worker.fetch(
      new Request('https://worker.example.com/setup/google/callback?state=expired-state&code=auth-code', {
        method: 'GET',
      }),
      makeEnv(kv),
      {}
    );

    expect(response.status).toBe(400);
    expect(kv.deleteCalls).toContain('gdrive:oauth:state:expired-state');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('returns redacted token exchange failures', async () => {
    const kv = new MemoryKV();
    await worker.fetch(setupRequest('/setup/google/start'), makeEnv(kv), {});
    const state = [...kv.values.keys()][0]?.replace('gdrive:oauth:state:', '');
    jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => 'access_token=leaked-token&client_secret=leaked-secret',
    } as Response);

    const response = await worker.fetch(
      new Request(`https://worker.example.com/setup/google/callback?state=${state}&code=auth-code`, {
        method: 'GET',
      }),
      makeEnv(kv),
      {}
    );

    expect(response.status).toBe(502);
    const text = await response.text();
    expect(text).toContain('Google OAuth token exchange failed');
    expect(text).not.toContain('auth-code');
    expect(text).not.toContain('leaked-token');
    expect(text).not.toContain('leaked-secret');
  });
});

describe('remote setup status route', () => {
  it('rejects status without setup bearer auth', async () => {
    const response = await worker.fetch(
      new Request('https://worker.example.com/setup/status', { method: 'GET' }),
      makeEnv(),
      {}
    );

    expect(response.status).toBe(401);
  });

  it('reports missing token state with remote recovery guidance', async () => {
    const response = await worker.fetch(setupRequest('/setup/status'), makeEnv(), {});

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      status: 'missing-token',
      configured: false,
      tokenStateExists: false,
      recovery: expect.stringContaining('/setup/google/start'),
    });
  });

  it('distinguishes expired refreshable token state', async () => {
    const kv = new MemoryKV();
    const encrypted = await encryptToken(
      JSON.stringify(makeTokens({ expiry_date: Date.now() - 60_000 })),
      TEST_KEY
    );
    await kv.put('gdrive:oauth:tokens', JSON.stringify({ format: 'workers-aes-gcm-v1', data: encrypted }));
    jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: 'refreshed-access-token',
        expires_in: 3600,
        token_type: 'Bearer',
      }),
    } as Response);

    const response = await worker.fetch(setupRequest('/setup/status'), makeEnv(kv), {});

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      status: 'expired-or-refreshable',
      configured: true,
      tokenStateExists: true,
      refreshAttempted: true,
    });
    expect(kv.values.get('gdrive:oauth:tokens')).not.toContain('refreshed-access-token');
  });

  it('distinguishes refresh failure without leaking secrets', async () => {
    const kv = new MemoryKV();
    const encrypted = await encryptToken(
      JSON.stringify(makeTokens({ expiry_date: Date.now() - 60_000 })),
      TEST_KEY
    );
    await kv.put('gdrive:oauth:tokens', JSON.stringify({ format: 'workers-aes-gcm-v1', data: encrypted }));
    jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => 'refresh_token=leaked-refresh-token&client_secret=leaked-secret',
    } as Response);

    const response = await worker.fetch(setupRequest('/setup/status'), makeEnv(kv), {});

    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).toContain('refresh-failed');
    expect(text).not.toContain('leaked-refresh-token');
    expect(text).not.toContain('leaked-secret');
  });

  it('reports malformed token state without throwing', async () => {
    const kv = new MemoryKV();
    await kv.put('gdrive:oauth:tokens', JSON.stringify({ format: 'workers-aes-gcm-v1', data: 'not-valid' }));

    const response = await worker.fetch(setupRequest('/setup/status'), makeEnv(kv), {});

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      status: 'malformed-token',
      configured: false,
      tokenStateExists: true,
      refreshAttempted: false,
      recovery: expect.stringContaining('/setup/google/start'),
    });
  });
});

describe('worker Google OAuth failures', () => {
  it('returns remote recovery guidance for missing token state on /mcp', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const response = await worker.fetch(
      new Request('https://worker.example.com/mcp', {
        method: 'POST',
        headers: { Authorization: 'Bearer mcp-secret' },
        body: '{}',
      }),
      makeEnv(),
      {}
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: 'Google OAuth token resolution failed',
      detail: 'Use /setup/status to inspect remote Google OAuth state, then /setup/google/start to recover.',
    });
    expect(JSON.stringify(consoleErrorSpy.mock.calls)).not.toContain('mcp-secret');
  });
});
