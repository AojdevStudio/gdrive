import { describe, it, expect, jest } from '@jest/globals';
import { createConfiguredServer } from '../../server/factory.js';
import type { ServerConfig } from '../../server/factory.js';
import { PROJECT_IDENTITY } from '../../server/identity.js';
import { assertAnthropicCompatibleToolList } from '../../server/schema-compat.js';
import type { ComposioDiscoveryResult, ComposioProviderRuntime } from '../../provider/composio/runtime.js';

const fakeComposioProvider: ComposioProviderRuntime = {
  discover: jest.fn(async (service?: string, operation?: string): Promise<ComposioDiscoveryResult> => {
    const result: ComposioDiscoveryResult = {
      provider: 'composio',
      configured: true,
      operations: {
        [operation ?? 'search']: {
          service: service ?? 'drive',
          operation: operation ?? 'search',
          provider: 'composio',
          toolkit: 'googledrive',
          signature: 'search(options: { query: string, pageSize?: number })',
          auth: {
            toolkit: 'googledrive',
            connected: true,
            status: 'active',
            auth: { managed: true },
          },
        },
      },
      toolkits: {},
      guidance: 'Use AOJ Workbench execute.',
    };
    if (service) {
      result.service = service;
    }
    if (operation) {
      result.operation = operation;
    }
    return result;
  }),
  execute: jest.fn(async () => ({ ok: true })),
};

function makeDeps(overrides: Partial<ServerConfig> = {}): ServerConfig {
  return {
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } as unknown as ServerConfig['logger'],
    cacheManager: { get: jest.fn(), set: jest.fn(), invalidate: jest.fn() } as unknown as ServerConfig['cacheManager'],
    performanceMonitor: { track: jest.fn() } as unknown as ServerConfig['performanceMonitor'],
    auth: {},
    composioProvider: fakeComposioProvider,
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

async function callTool(
  server: ReturnType<typeof createConfiguredServer>,
  name: string,
  args: Record<string, unknown>
) {
  const handlers = (server as unknown as {
    _requestHandlers: Map<string, (request: unknown, extra: unknown) => Promise<unknown>>;
  })._requestHandlers;
  const handler = handlers.get('tools/call');
  if (!handler) {
    throw new Error('tools/call handler not registered');
  }
  return handler({
    method: 'tools/call',
    params: { name, arguments: args },
  }, {}) as Promise<{
    content: Array<{ type: string; text: string }>;
    isError?: boolean;
  }>;
}

describe('createConfiguredServer', () => {
  it('returns a Server instance', () => {
    const server = createConfiguredServer(makeDeps());
    expect(server).toBeDefined();
    expect(typeof server.connect).toBe('function');
  });

  it('uses the configured MCP server identity', () => {
    const server = createConfiguredServer(makeDeps()) as unknown as {
      _serverInfo: { name: string };
    };

    expect(server._serverInfo.name).toBe(PROJECT_IDENTITY.mcpServerName);
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

  it('describes execute as a read/write AOJ Workbench operation runner', async () => {
    const server = createConfiguredServer(makeDeps());
    const result = await listTools(server);

    const execute = result.tools.find((tool) => tool.name === 'execute');

    expect(execute?.description).toContain('AOJ Workbench operation through the Composio-backed provider runtime');
    expect(execute?.description).toContain('Some operations modify files, send email, or update calendar events');
  });

  it('documents execute structured operation parameters', async () => {
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
    expect(schema.properties?.code).toBeUndefined();
  });

  it('advertises Anthropic-compatible top-level input schemas', async () => {
    const server = createConfiguredServer(makeDeps());
    const result = await listTools(server);

    expect(() => assertAnthropicCompatibleToolList(result.tools)).not.toThrow();
  });

  it('routes operation search through the Composio provider wrapper', async () => {
    const composioProvider = {
      ...fakeComposioProvider,
      discover: jest.fn(fakeComposioProvider.discover),
    };
    const server = createConfiguredServer(makeDeps({ composioProvider }));

    const result = await callTool(server, 'search', { service: 'drive', operation: 'search' });
    const body = JSON.parse(result.content[0]?.text ?? '{}') as Record<string, unknown>;

    expect(composioProvider.discover).toHaveBeenCalledWith('drive', 'search');
    expect(JSON.stringify(body)).not.toContain('GOOGLEDRIVE_FIND_FILE');
  });

  it('routes execute through the Composio provider wrapper', async () => {
    const composioProvider = {
      ...fakeComposioProvider,
      execute: jest.fn(fakeComposioProvider.execute),
    };
    const server = createConfiguredServer(makeDeps({ composioProvider }));

    const result = await callTool(server, 'execute', {
      service: 'drive',
      operation: 'search',
      args: { query: 'smoke' },
    });

    expect(composioProvider.execute).toHaveBeenCalledWith({
      service: 'drive',
      operation: 'search',
      args: { query: 'smoke' },
    });
    expect(JSON.parse(result.content[0]?.text ?? '{}')).toEqual({ result: { ok: true } });
  });
});
