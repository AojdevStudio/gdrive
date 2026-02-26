import { describe, it, expect, afterEach, jest } from '@jest/globals';
import { encryptToken } from '../../storage/kv-store.js';
import { getValidAccessToken, type KVNamespace, type WorkersTokenData } from '../../auth/workers-auth.js';

const TEST_KEY = Buffer.alloc(32, 7).toString('base64');

function makeTokens(overrides: Partial<WorkersTokenData> = {}): WorkersTokenData {
  return {
    access_token: 'access-token',
    refresh_token: 'refresh-token',
    expiry_date: Date.now() + 10 * 60_000,
    token_type: 'Bearer',
    scope: 'scope',
    ...overrides,
  };
}

function makeKV(rawPayload: string): {
  kv: KVNamespace;
  get: jest.MockedFunction<KVNamespace['get']>;
  put: jest.MockedFunction<KVNamespace['put']>;
} {
  const get = jest.fn<KVNamespace['get']>().mockResolvedValue(rawPayload);
  const put = jest.fn<KVNamespace['put']>().mockResolvedValue(undefined);
  const del = jest.fn<KVNamespace['delete']>().mockResolvedValue(undefined);
  return {
    kv: { get, put, delete: del },
    get,
    put,
  };
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe('workers-auth token handling', () => {
  it('migrates plaintext KV tokens to encrypted format', async () => {
    const tokens = makeTokens();
    const { kv, put } = makeKV(JSON.stringify(tokens));

    const accessToken = await getValidAccessToken(kv, 'client-id', 'client-secret', TEST_KEY);

    expect(accessToken).toBe(tokens.access_token);
    expect(put).toHaveBeenCalledTimes(1);

    const storedPayload = JSON.stringify(put.mock.calls[0]?.[1]);
    expect(storedPayload).not.toContain(tokens.access_token);

    const parsed = JSON.parse(put.mock.calls[0]?.[1] as string) as { format: string; data: string };
    expect(parsed.format).toBe('workers-aes-gcm-v1');
    expect(typeof parsed.data).toBe('string');
    expect(parsed.data.length).toBeGreaterThan(0);
  });

  it('reads encrypted KV tokens without rewriting them', async () => {
    const tokens = makeTokens();
    const encrypted = await encryptToken(JSON.stringify(tokens), TEST_KEY);
    const { kv, put } = makeKV(
      JSON.stringify({
        format: 'workers-aes-gcm-v1',
        data: encrypted,
      })
    );

    const accessToken = await getValidAccessToken(kv, 'client-id', 'client-secret', TEST_KEY);

    expect(accessToken).toBe(tokens.access_token);
    expect(put).not.toHaveBeenCalled();
  });

  it('throws a clear error for TokenManager versioned payloads', async () => {
    const { kv } = makeKV(
      JSON.stringify({
        version: 'v1',
        algorithm: 'aes-256-gcm',
        data: 'abc',
      })
    );

    await expect(getValidAccessToken(kv, 'client-id', 'client-secret', TEST_KEY)).rejects.toThrow(
      'TokenManager versioned format'
    );
  });

  it('throws a clear error for malformed payload shape', async () => {
    const { kv } = makeKV(JSON.stringify({ foo: 'bar' }));

    await expect(getValidAccessToken(kv, 'client-id', 'client-secret', TEST_KEY)).rejects.toThrow(
      'KV token payload is malformed'
    );
  });

  it('refreshes expired tokens and persists encrypted updated payload', async () => {
    const expiredTokens = makeTokens({ expiry_date: Date.now() - 60_000 });
    const encrypted = await encryptToken(JSON.stringify(expiredTokens), TEST_KEY);
    const { kv, put } = makeKV(
      JSON.stringify({
        format: 'workers-aes-gcm-v1',
        data: encrypted,
      })
    );

    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: 'new-access-token',
        expires_in: 3600,
        token_type: 'Bearer',
      }),
    } as Response);

    const accessToken = await getValidAccessToken(kv, 'client-id', 'client-secret', TEST_KEY);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(accessToken).toBe('new-access-token');
    expect(put).toHaveBeenCalledTimes(1);

    const encryptedPayload = JSON.parse(put.mock.calls[0]?.[1] as string) as {
      format: string;
      data: string;
    };
    expect(encryptedPayload.format).toBe('workers-aes-gcm-v1');
    expect(encryptedPayload.data).not.toContain('new-access-token');
  });
});
