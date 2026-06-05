import { afterEach, describe, expect, it, jest } from '@jest/globals';
import worker, { type Env } from '../../../worker.js';
import { GOOGLE_WORKSPACE_SCOPES } from '../../auth/workers-oauth.js';
import { KV_TOKEN_KEY, type WorkersTokenData } from '../../auth/workers-auth.js';
import { encryptToken } from '../../storage/kv-store.js';

const TEST_KEY = Buffer.alloc(32, 7).toString('base64');
const SENSITIVE_VALUES = [
  'mcp-secret',
  'setup-secret',
  'client-secret',
  'access-token-secret',
  'refresh-token-secret',
  'refreshed-access-token-secret',
  'auth-code-secret',
  'composio-key-secret',
  TEST_KEY,
];

class MemoryKV {
  values = new Map<string, string>();

  async get(key: string): Promise<string | null> {
    return this.values.get(key) ?? null;
  }

  async put(key: string, value: string): Promise<void> {
    this.values.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.values.delete(key);
  }
}

function makeEnv(kv = new MemoryKV(), overrides: Partial<Env> = {}): Env {
  return {
    GDRIVE_KV: kv,
    GDRIVE_CLIENT_ID: 'client-id',
    GDRIVE_CLIENT_SECRET: 'client-secret',
    GDRIVE_TOKEN_ENCRYPTION_KEY: TEST_KEY,
    COMPOSIO_API_KEY: 'composio-key-secret',
    AOJ_WORKBENCH_USER_ID: 'aoj-workbench-user',
    MCP_BEARER_TOKEN: 'mcp-secret',
    MCP_SETUP_TOKEN: 'setup-secret',
    ...overrides,
  };
}

function makeTokens(overrides: Partial<WorkersTokenData> = {}): WorkersTokenData {
  return {
    access_token: 'access-token-secret',
    refresh_token: 'refresh-token-secret',
    expiry_date: Date.now() + 60 * 60_000,
    token_type: 'Bearer',
    scope: GOOGLE_WORKSPACE_SCOPES.join(' '),
    ...overrides,
  };
}

async function storeTokens(kv: MemoryKV, tokens: WorkersTokenData): Promise<void> {
  const encrypted = await encryptToken(JSON.stringify(tokens), TEST_KEY);
  await kv.put(KV_TOKEN_KEY, JSON.stringify({ format: 'workers-aes-gcm-v1', data: encrypted }));
}

function mcpToolsListRequest(headers: Record<string, string> = {}): Request {
  return new Request('https://worker.example.com/mcp', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      ...headers,
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }),
  });
}

async function readJsonResponse(response: Response): Promise<unknown> {
  const text = await response.text();
  if (response.headers.get('content-type')?.includes('text/event-stream')) {
    const dataLine = text.split('\n').find((line) => line.startsWith('data: '));
    return dataLine ? JSON.parse(dataLine.slice('data: '.length)) : text;
  }
  return JSON.parse(text);
}

function expectRedacted(value: unknown): void {
  const serialized = typeof value === 'string' ? value : JSON.stringify(value);
  for (const secret of SENSITIVE_VALUES) {
    expect(serialized).not.toContain(secret);
  }
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe('remote Worker smoke contract', () => {
  it('reports setup/status state through the protected remote route', async () => {
    const response = await worker.fetch(
      new Request('https://worker.example.com/setup/status', {
        method: 'GET',
        headers: { Authorization: 'Bearer setup-secret' },
      }),
      makeEnv(),
      {}
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      status: 'missing-token',
      configured: false,
      tokenStateExists: false,
      recovery: expect.stringContaining('/setup/google/start'),
    });
    expectRedacted(body);
  });

  it('rejects unauthenticated /mcp when bearer auth is configured', async () => {
    const response = await worker.fetch(mcpToolsListRequest(), makeEnv(), {});

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({
      error: 'Unauthorized',
    });
  });

  it('lists the search and execute tools through authenticated /mcp', async () => {
    const response = await worker.fetch(
      mcpToolsListRequest({ Authorization: 'Bearer mcp-secret' }),
      makeEnv(),
      {}
    );

    expect(response.status).toBe(200);
    const body = await readJsonResponse(response) as {
      result?: { tools?: Array<{ name: string }> };
    };
    expect(body.result?.tools?.map((tool) => tool.name).sort()).toEqual(['execute', 'search']);
    expectRedacted(body);
  });

  it('returns remote recovery guidance for missing Composio provider config', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const env = makeEnv();
    delete env.COMPOSIO_API_KEY;

    const response = await worker.fetch(
      mcpToolsListRequest({ Authorization: 'Bearer mcp-secret' }),
      env,
      {}
    );

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body).toEqual({
      error: 'Composio provider runtime is not configured',
      detail: 'Set COMPOSIO_API_KEY and AOJ_WORKBENCH_USER_ID on the deployed Worker.',
    });
    expectRedacted(body);
  });

  it('does not refresh legacy Google token state before authenticated tool listing', async () => {
    const kv = new MemoryKV();
    await storeTokens(kv, makeTokens({ expiry_date: Date.now() - 60_000 }));
    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: 'refreshed-access-token-secret',
        expires_in: 3600,
        token_type: 'Bearer',
      }),
    } as Response);

    const response = await worker.fetch(
      mcpToolsListRequest({ Authorization: 'Bearer mcp-secret' }),
      makeEnv(kv),
      {}
    );

    expect(response.status).toBe(200);
    const body = await readJsonResponse(response);
    expectRedacted(body);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(kv.values.get(KV_TOKEN_KEY)).not.toContain('refreshed-access-token-secret');
    expect(kv.values.get(KV_TOKEN_KEY)).not.toContain('refresh-token-secret');
  });
});
