/**
 * Gmail validation utilities
 *
 * Assertion functions that replace non-null assertions (!) with runtime validation
 * providing descriptive error messages for debugging.
 */

/**
 * Assert that a value is a non-null/undefined string.
 * Uses TypeScript `asserts` keyword for type narrowing after the call.
 *
 * @param value - The value to check
 * @param fieldName - The field name for error messages (e.g., "response.id")
 * @param operationName - The operation name for error context (e.g., "getMessage")
 * @param contextArgs - Additional context key-value pairs (e.g., "messageId='abc123'")
 *
 * @throws Error with descriptive message if value is null or undefined
 *
 * @example
 * ```typescript
 * assertRequiredString(message.id, 'response.id', 'getMessage', `messageId='${inputId}'`);
 * // After this call, TypeScript knows message.id is string
 * ```
 */
export function assertRequiredString(
  value: string | null | undefined,
  fieldName: string,
  operationName: string,
  ...contextArgs: string[]
): asserts value is string {
  if (value === null || value === undefined) {
    const state = value === null ? 'null' : 'undefined';
    const context = contextArgs.length > 0 ? ` for ${contextArgs.join(', ')}` : '';
    throw new Error(`${operationName}: ${fieldName} is ${state}${context}`);
  }
}

/**
 * Assert that at least one of addLabelIds or removeLabelIds is non-empty.
 * A modifyLabels call with no label changes is a no-op and likely a bug.
 *
 * @param addLabelIds - Label IDs to add
 * @param removeLabelIds - Label IDs to remove
 *
 * @throws Error if both arrays are empty or undefined
 *
 * @example
 * ```typescript
 * assertModifyLabelsOperation(addLabelIds, removeLabelIds);
 * // Throws if both are empty/missing
 * ```
 */
export function assertModifyLabelsOperation(
  addLabelIds: string[] | undefined,
  removeLabelIds: string[] | undefined,
): void {
  const hasAdd = addLabelIds && addLabelIds.length > 0;
  const hasRemove = removeLabelIds && removeLabelIds.length > 0;

  if (!hasAdd && !hasRemove) {
    throw new Error('modifyLabels: at least one of addLabelIds or removeLabelIds must be provided');
  }
}
