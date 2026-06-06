import { afterEach, describe, expect, it, jest } from '@jest/globals';
import worker, { type Env } from '../../../worker.js';

const SENSITIVE_VALUES = [
  'mcp-secret',
  'composio-key-secret',
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
    COMPOSIO_API_KEY: 'composio-key-secret',
    AOJ_WORKBENCH_USER_ID: 'aoj-workbench-user',
    MCP_BEARER_TOKEN: 'mcp-secret',
    ...overrides,
  };
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

  it('does not contact legacy provider auth before authenticated tool listing', async () => {
    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({}),
    } as Response);

    const response = await worker.fetch(
      mcpToolsListRequest({ Authorization: 'Bearer mcp-secret' }),
      makeEnv(),
      {}
    );

    expect(response.status).toBe(200);
    const body = await readJsonResponse(response);
    expectRedacted(body);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
