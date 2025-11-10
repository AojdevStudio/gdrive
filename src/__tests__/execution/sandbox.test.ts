/**
 * Tests for CodeSandbox - Secure code execution environment
 *
 * These tests verify:
 * 1. Basic code execution works
 * 2. Module imports work correctly
 * 3. Resource limits are enforced
 * 4. Security isolation is maintained
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { CodeSandbox, type CombinedContext } from '../../execution/sandbox.js';
import type { Logger } from 'winston';

// Mock logger
const mockLogger: Logger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
} as unknown as Logger;

// Mock context with minimal stubs
const createMockContext = (): CombinedContext => ({
  drive: {} as any,
  sheets: {} as any,
  forms: {} as any,
  docs: {} as any,
  logger: mockLogger,
  cacheManager: {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    invalidate: jest.fn().mockResolvedValue(undefined),
  },
  performanceMonitor: {
    track: jest.fn(),
  },
  startTime: Date.now(),
});

describe('CodeSandbox', () => {
  let sandbox: CodeSandbox;
  let mockContext: CombinedContext;

  beforeEach(() => {
    sandbox = new CodeSandbox(
      {
        timeout: 5000,
        memoryLimit: 64,
        cpuLimit: 5000,
      },
      mockLogger
    );
    mockContext = createMockContext();
  });

  afterEach(() => {
    sandbox.dispose();
  });

  describe('Basic Execution', () => {
    it('should execute simple JavaScript code', async () => {
      const code = 'return 2 + 2;';
      const result = await sandbox.execute(code, mockContext);

      expect(result.success).toBe(true);
      expect(result.result).toBe(4);
      expect(result.stats.executionTime).toBeGreaterThan(0);
    });

    it('should execute async code with await', async () => {
      const code = `
        // Use a simple async operation that doesn't require setTimeout
        const asyncOperation = async () => {
          return 'completed';
        };
        const result = await asyncOperation();
        return result;
      `;
      const result = await sandbox.execute(code, mockContext);

      expect(result.success).toBe(true);
      expect(result.result).toBe('completed');
    });

    it('should handle arrays and objects', async () => {
      const code = `
        const data = { name: 'test', values: [1, 2, 3] };
        return data;
      `;
      const result = await sandbox.execute(code, mockContext);

      expect(result.success).toBe(true);
      expect(result.result).toEqual({ name: 'test', values: [1, 2, 3] });
    });
  });

  describe('Error Handling', () => {
    it('should catch syntax errors', async () => {
      const code = 'this is invalid javascript!!!';
      const result = await sandbox.execute(code, mockContext);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('SyntaxError');
    });

    it('should catch runtime errors', async () => {
      const code = `
        throw new Error('Test error');
      `;
      const result = await sandbox.execute(code, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('Test error');
    });

    it('should handle undefined variables', async () => {
      const code = 'return nonExistentVariable;';
      const result = await sandbox.execute(code, mockContext);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Resource Limits', () => {
    it('should enforce timeout on infinite loop', async () => {
      const code = 'while (true) { }';

      // Create sandbox with short timeout for this test
      const shortTimeoutSandbox = new CodeSandbox(
        { timeout: 1000, memoryLimit: 64, cpuLimit: 1000 },
        mockLogger
      );

      const result = await shortTimeoutSandbox.execute(code, mockContext);

      expect(result.success).toBe(false);
      // Error message should mention timeout or execution
      expect(result.error?.message).toMatch(/timeout|timed out|execution/i);

      shortTimeoutSandbox.dispose();
    }, 10000); // Give Jest 10s timeout for this test

    it('should track execution statistics', async () => {
      const code = `
        const arr = new Array(1000).fill(0);
        return arr.length;
      `;
      const result = await sandbox.execute(code, mockContext);

      expect(result.success).toBe(true);
      expect(result.stats.executionTime).toBeGreaterThanOrEqual(0);
      expect(result.stats.memoryUsed).toBeGreaterThanOrEqual(0);
      expect(result.stats.cpuTime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Module Loading', () => {
    it('should reject unknown module paths', async () => {
      const code = `
        const module = await import('./modules/unknown');
        return module;
      `;
      const result = await sandbox.execute(code, mockContext);

      expect(result.success).toBe(false);
      // Should fail when trying to import unknown module
      expect(result.error?.message).toMatch(/not supported|unknown|cannot find/i);
    });
  });

  describe('Security', () => {
    it('should not have access to process object', async () => {
      const code = `
        try {
          return typeof process;
        } catch (e) {
          return 'error: ' + e.message;
        }
      `;
      const result = await sandbox.execute(code, mockContext);

      expect(result.success).toBe(true);
      // process should be undefined in the sandbox
      expect(result.result).toBe('undefined');
    });

    it('should not have access to require', async () => {
      const code = `
        try {
          return typeof require;
        } catch (e) {
          return 'error: ' + e.message;
        }
      `;
      const result = await sandbox.execute(code, mockContext);

      expect(result.success).toBe(true);
      // require should be undefined in the sandbox
      expect(result.result).toBe('undefined');
    });

    it('should isolate global scope from main process', async () => {
      const code = `
        globalThis.testValue = 'sandbox';
        return globalThis.testValue;
      `;
      const result = await sandbox.execute(code, mockContext);

      expect(result.success).toBe(true);
      expect(result.result).toBe('sandbox');

      // Verify main process global is not affected
      expect((globalThis as any).testValue).toBeUndefined();
    });
  });
});
