/**
 * Executor interface for running agent code in a sandboxed environment.
 * Implemented by NodeSandbox (Phase 1) and WorkersSandbox (Phase 2).
 */

export interface ExecuteResult {
  result: unknown;
  logs: string[];
  error?: {
    message: string;
    line?: number;
    stack?: string;
  };
}

export interface Executor {
  execute(code: string, globals: Record<string, unknown>): Promise<ExecuteResult>;
}
