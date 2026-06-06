import { afterEach, describe, expect, it, jest } from '@jest/globals';
import worker, { type Env } from '../../../worker.js';

class MemoryKV {
  async get(_key: string): Promise<string | null> {
    return null;
  }

  async put(_key: string, _value: string, _options?: { expirationTtl?: number }): Promise<void> {
    return undefined;
  }

  async delete(_key: string): Promise<void> {
    return undefined;
  }
}

function makeEnv(overrides: Partial<Env> = {}): Env {
  return {
    GDRIVE_KV: new MemoryKV(),
    COMPOSIO_API_KEY: 'composio-key-secret',
    AOJ_WORKBENCH_USER_ID: 'aoj-workbench-user',
    MCP_BEARER_TOKEN: 'mcp-secret',
    ...overrides,
  };
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe('legacy Google OAuth Worker routes', () => {
  it.each([
    '/setup/google/start',
    '/setup/google/callback?state=legacy-state&code=legacy-code',
    '/setup/status',
  ])('does not serve %s from the AOJ Workbench Worker', async (path) => {
    const fetchSpy = jest.spyOn(globalThis, 'fetch');

    const response = await worker.fetch(
      new Request(`https://worker.example.com${path}`, {
        method: 'GET',
        headers: { Authorization: 'Bearer setup-secret' },
      }),
      makeEnv(),
      {}
    );

    expect(response.status).toBe(404);
    expect(await response.text()).toContain('AOJ Workbench Worker');
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
