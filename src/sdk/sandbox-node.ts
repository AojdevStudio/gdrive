/**
 * Node.js sandbox implementation using the built-in `vm` module.
 * Phase 1: Local Node runtime. Phase 2 uses Workers' native V8 scope.
 *
 * Uses vm.createContext() for sandboxing. This provides isolation from the
 * global scope while allowing async/await and complex SDK objects.
 * Sufficient for a personal, trusted-user tool.
 */

import { createContext, Script } from 'node:vm';
import type { Executor, ExecuteResult } from './executor.js';

export class NodeSandbox implements Executor {
  private readonly timeout: number;

  constructor(timeout = 10000) {
    this.timeout = timeout;
  }

  async execute(code: string, globals: Record<string, unknown>): Promise<ExecuteResult> {
    const logs: string[] = [];

    const sandboxContext = createContext({
      ...globals,
      console: {
        log: (...args: unknown[]) => logs.push(args.map((a) => safeStringify(a)).join(' ')),
        warn: (...args: unknown[]) => logs.push('[warn] ' + args.map((a) => safeStringify(a)).join(' ')),
        error: (...args: unknown[]) => logs.push('[error] ' + args.map((a) => safeStringify(a)).join(' ')),
        info: (...args: unknown[]) => logs.push('[info] ' + args.map((a) => safeStringify(a)).join(' ')),
      },
      JSON,
      Math,
      Date,
      Array,
      Object,
      Promise,
      Error,
      TypeError,
      RangeError,
      parseInt,
      parseFloat,
      isNaN,
      isFinite,
      encodeURIComponent,
      decodeURIComponent,
      // Explicitly block dangerous globals
      process: undefined,
      require: undefined,
      __dirname: undefined,
      __filename: undefined,
      global: undefined,
      globalThis: undefined,
      setTimeout: undefined,
      setInterval: undefined,
      clearTimeout: undefined,
      clearInterval: undefined,
      fetch: undefined,
      XMLHttpRequest: undefined,
    });

    // Wrap user code in async IIFE to support top-level await and return values
    const wrappedCode = `(async () => { ${code} })()`;

    try {
      const script = new Script(wrappedCode, {
        filename: 'agent-code.js',
      });

      const result = await script.runInContext(sandboxContext, {
        timeout: this.timeout,
      });

      return { result, logs };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      return {
        result: undefined,
        logs,
        error: {
          message: err.message,
          ...(err.stack !== undefined ? { stack: err.stack } : {}),
        },
      };
    }
  }
}

function safeStringify(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
