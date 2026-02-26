import { describe, it, expect } from '@jest/globals';
import { serializeLogMetadata } from '../../server/bootstrap.js';

describe('serializeLogMetadata', () => {
  it('replaces circular references with [Circular]', () => {
    const obj: { self?: unknown; nested?: Record<string, unknown> } = {};
    obj.self = obj;
    obj.nested = { ref: obj };

    const serialized = serializeLogMetadata(obj) as Record<string, unknown>;

    expect(serialized.self).toBe('[Circular]');
    expect((serialized.nested as Record<string, unknown>).ref).toBe('[Circular]');
  });

  it('serializes Error objects with circular cause safely', () => {
    const err = new Error('root');
    (err as Error & { cause?: unknown }).cause = err;

    const serialized = serializeLogMetadata(err) as Record<string, unknown>;

    expect(serialized.message).toBe('root');
    expect(serialized.cause).toBe('[Circular]');
  });
});
