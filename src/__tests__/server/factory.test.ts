import { describe, it, expect, jest } from '@jest/globals';
import { createConfiguredServer } from '../../server/factory.js';
import type { ServerConfig } from '../../server/factory.js';
import type { Executor } from '../../sdk/types.js';
import { assertAnthropicCompatibleToolList } from '../../server/schema-compat.js';

function makeDeps(overrides: Partial<ServerConfig> = {}): ServerConfig {
  return {
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } as unknown as ServerConfig['logger'],
    cacheManager: { get: jest.fn(), set: jest.fn(), invalidate: jest.fn() } as unknown as ServerConfig['cacheManager'],
    performanceMonitor: { track: jest.fn() } as unknown as ServerConfig['performanceMonitor'],
    auth: {},
    ...overrides,
  };
}

async function listTools(server: ReturnType<typeof createConfiguredServer>) {
  const handlers = (server as unknown as {
    _requestHandlers: Map<string, (request: unknown, extra: unknown) => Promise<unknown>>;
  })._requestHandlers;
  const handler = handlers.get('tools/list');
  if (!handler) {
    throw new Error('tools/list handler not registered');
  }
  return handler({ method: 'tools/list' }, {}) as Promise<{
    tools: Array<{
      name: string;
      description?: string;
      annotations?: Record<string, unknown>;
      inputSchema: Record<string, unknown>;
    }>;
  }>;
}

describe('createConfiguredServer', () => {
  it('returns a Server instance', () => {
    const server = createConfiguredServer(makeDeps());
    expect(server).toBeDefined();
    expect(typeof server.connect).toBe('function');
  });

  it('uses the Google Workspace MCP server identity', () => {
    const server = createConfiguredServer(makeDeps()) as unknown as {
      _serverInfo: { name: string };
    };

    expect(server._serverInfo.name).toBe('google-workspace');
  });

  it('accepts an optional sandbox parameter', () => {
    const mockSandbox: Executor = {
      execute: jest.fn<Executor['execute']>().mockResolvedValue({ result: null, logs: [] }),
    };
    const server = createConfiguredServer(makeDeps({ sandbox: mockSandbox }));
    expect(server).toBeDefined();
  });

  it('marks search as read-only for clients', async () => {
    const server = createConfiguredServer(makeDeps());
    const result = await listTools(server);

    const search = result.tools.find((tool) => tool.name === 'search');

    expect(search?.annotations?.readOnlyHint).toBe(true);
  });

  it('describes unfiltered search results as a summary', async () => {
    const server = createConfiguredServer(makeDeps());
    const result = await listTools(server);

    const search = result.tools.find((tool) => tool.name === 'search');

    expect(search?.description).toContain('Without filters, returns a service-to-operation summary');
    expect(search?.description).toContain('returns the matching detailed spec subset');
  });

  it('describes execute as a read/write Google Workspace operation runner', async () => {
    const server = createConfiguredServer(makeDeps());
    const result = await listTools(server);

    const execute = result.tools.find((tool) => tool.name === 'execute');

    expect(execute?.description).toContain('read and write Google Workspace data');
    expect(execute?.description).toContain('Some operations modify files, send email, or update calendar events');
  });

  it('documents execute input alternatives and parameter descriptions', async () => {
    const server = createConfiguredServer(makeDeps());
    const result = await listTools(server);

    const execute = result.tools.find((tool) => tool.name === 'execute');
    const schema = execute?.inputSchema as {
      anyOf?: unknown;
      properties?: Record<string, { description?: string }>;
    };

    expect(schema.anyOf).toBeUndefined();
    expect(schema.properties?.service?.description).toBeTruthy();
    expect(schema.properties?.operation?.description).toBeTruthy();
    expect(schema.properties?.args?.description).toBeTruthy();
    expect(schema.properties?.code?.description).toBeTruthy();
  });

  it('advertises Anthropic-compatible top-level input schemas', async () => {
    const server = createConfiguredServer(makeDeps());
    const result = await listTools(server);

    expect(() => assertAnthropicCompatibleToolList(result.tools)).not.toThrow();
  });
});
