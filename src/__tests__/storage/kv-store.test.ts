import { describe, it, expect, jest } from '@jest/globals';
import { WorkersKVCache, encryptToken } from '../../storage/kv-store.js';
import type { KVNamespace } from '../../auth/workers-auth.js';

describe('WorkersKVCache', () => {
  it('throws clear error for non-32-byte encryption keys', async () => {
    const shortKey = Buffer.alloc(16, 1).toString('base64');
    await expect(encryptToken('hello', shortKey)).rejects.toThrow('exactly 32 bytes');
  });

  it('uses kv.delete for exact-key invalidation', async () => {
    const kv: KVNamespace = {
      get: async () => null,
      put: async () => undefined,
      delete: jest.fn(async () => undefined),
    };

    const cache = new WorkersKVCache(kv);
    await cache.invalidate('cache:key:1');

    expect(kv.delete).toHaveBeenCalledTimes(1);
    expect(kv.delete).toHaveBeenCalledWith('cache:key:1');
  });

  it('no-ops invalidation when wildcard pattern is provided', async () => {
    const kv: KVNamespace = {
      get: async () => null,
      put: async () => undefined,
      delete: jest.fn(async () => undefined),
    };

    const cache = new WorkersKVCache(kv);
    await cache.invalidate('cache:*');

    expect(kv.delete).not.toHaveBeenCalled();
  });

  it('treats cached JSON null as a cache miss', async () => {
    const kv: KVNamespace = {
      get: async () => 'null',
      put: async () => undefined,
      delete: async () => undefined,
    };

    const cache = new WorkersKVCache(kv);
    const value = await cache.get('cache:key:2');

    expect(value).toBeNull();
  });
});
