/**
 * Anthropic tool schema compatibility checks.
 *
 * Anthropic's tools API requires top-level input schemas to be plain objects:
 *   { "type": "object", "properties": { ... } }
 *
 * Composition keywords (oneOf / anyOf / allOf) are only allowed nested inside
 * properties — not at the schema root. MCP clients may accept richer JSON Schema,
 * but this server targets both MCP and Anthropic-hosted runtimes.
 */

const TOP_LEVEL_COMPOSITION_KEYWORDS = ['oneOf', 'anyOf', 'allOf'] as const;

export type CompositionKeyword = (typeof TOP_LEVEL_COMPOSITION_KEYWORDS)[number];

export class IncompatibleInputSchemaError extends Error {
  constructor(
    message: string,
    readonly toolName?: string,
    readonly keyword?: CompositionKeyword
  ) {
    super(message);
    this.name = 'IncompatibleInputSchemaError';
  }
}

/**
 * Assert that a tool input schema satisfies Anthropic's top-level constraints.
 */
export function assertAnthropicCompatibleInputSchema(
  schema: Record<string, unknown>,
  toolName?: string
): void {
  if (schema.type !== 'object') {
    throw new IncompatibleInputSchemaError(
      toolName
        ? `Tool '${toolName}' inputSchema.type must be 'object'`
        : "inputSchema.type must be 'object'",
      toolName
    );
  }

  for (const keyword of TOP_LEVEL_COMPOSITION_KEYWORDS) {
    if (Object.prototype.hasOwnProperty.call(schema, keyword)) {
      throw new IncompatibleInputSchemaError(
        toolName
          ? `Tool '${toolName}' inputSchema must not use top-level '${keyword}' (Anthropic tools API rejects root composition keywords)`
          : `inputSchema must not use top-level '${keyword}'`,
        toolName,
        keyword
      );
    }
  }
}

/**
 * Validate every tool advertised by tools/list.
 */
export function assertAnthropicCompatibleToolList(
  tools: Array<{ name: string; inputSchema: Record<string, unknown> }>
): void {
  for (const tool of tools) {
    assertAnthropicCompatibleInputSchema(tool.inputSchema, tool.name);
  }
}
