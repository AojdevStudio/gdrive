import { describe, it, expect } from '@jest/globals';
import { NodeSandbox } from '../../sdk/sandbox-node.js';

describe('NodeSandbox timeout handling', () => {
  it('returns a timeout error for async code that never resolves', async () => {
    const sandbox = new NodeSandbox(50);
    const startedAt = Date.now();

    const result = await sandbox.execute('await new Promise(() => {});', {});

    const durationMs = Date.now() - startedAt;
    expect(result.error?.message).toContain('Sandbox execution timed out after 50ms');
    expect(durationMs).toBeLessThan(500);
  });
});
