import { describe, it, expect, jest } from '@jest/globals';
import { createConfiguredServer } from '../../server/factory.js';
import type { ServerConfig } from '../../server/factory.js';
import type { Executor } from '../../sdk/types.js';

function makeDeps(overrides: Partial<ServerConfig> = {}): ServerConfig {
  return {
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } as unknown as ServerConfig['logger'],
    cacheManager: { get: jest.fn(), set: jest.fn(), invalidate: jest.fn() } as unknown as ServerConfig['cacheManager'],
    performanceMonitor: { track: jest.fn() } as unknown as ServerConfig['performanceMonitor'],
    auth: {},
    ...overrides,
  };
}

describe('createConfiguredServer', () => {
  it('returns a Server instance', () => {
    const server = createConfiguredServer(makeDeps());
    expect(server).toBeDefined();
    expect(typeof server.connect).toBe('function');
  });

  it('accepts an optional sandbox parameter', () => {
    const mockSandbox: Executor = {
      execute: jest.fn<Executor['execute']>().mockResolvedValue({ result: null, logs: [] }),
    };
    const server = createConfiguredServer(makeDeps({ sandbox: mockSandbox }));
    expect(server).toBeDefined();
  });
});
