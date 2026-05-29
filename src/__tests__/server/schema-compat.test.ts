import { describe, expect, it } from '@jest/globals';
import {
  assertAnthropicCompatibleInputSchema,
  assertAnthropicCompatibleToolList,
  IncompatibleInputSchemaError,
} from '../../server/schema-compat.js';

describe('schema-compat', () => {
  it('accepts a plain object schema', () => {
    expect(() =>
      assertAnthropicCompatibleInputSchema({
        type: 'object',
        properties: { query: { type: 'string' } },
      })
    ).not.toThrow();
  });

  it('rejects non-object root types', () => {
    expect(() =>
      assertAnthropicCompatibleInputSchema({ type: 'string' }, 'badTool')
    ).toThrow(IncompatibleInputSchemaError);
  });

  it.each(['oneOf', 'anyOf', 'allOf'] as const)(
    'rejects top-level %s',
    (keyword) => {
      expect(() =>
        assertAnthropicCompatibleInputSchema(
          {
            type: 'object',
            [keyword]: [{ required: ['service'] }],
            properties: { service: { type: 'string' } },
          },
          'execute'
        )
      ).toThrow(/execute.*must not use top-level/);
    }
  );

  it('allows composition keywords nested inside properties', () => {
    expect(() =>
      assertAnthropicCompatibleInputSchema({
        type: 'object',
        properties: {
          payload: {
            anyOf: [{ type: 'string' }, { type: 'object' }],
          },
        },
      })
    ).not.toThrow();
  });

  it('validates an entire tool list', () => {
    expect(() =>
      assertAnthropicCompatibleToolList([
        {
          name: 'search',
          inputSchema: { type: 'object', properties: {} },
        },
        {
          name: 'execute',
          inputSchema: {
            type: 'object',
            properties: { service: { type: 'string' } },
          },
        },
      ])
    ).not.toThrow();
  });
});
