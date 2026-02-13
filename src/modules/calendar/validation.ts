/**
 * Calendar validation utilities
 * Assertion functions for validating Google Calendar API responses
 */

/**
 * Assert that a value is a non-null/non-undefined string.
 * Uses TypeScript `asserts` keyword for compile-time type narrowing.
 *
 * @param value - The value to validate
 * @param fieldName - Name of the field being validated (e.g., "response.id")
 * @param operationName - Name of the operation (e.g., "getEvent")
 * @param contextArgs - Additional context key-value pairs (e.g., "eventId='abc123'")
 * @throws Error with descriptive message when value is null or undefined
 *
 * @example
 * ```typescript
 * assertRequiredString(response.data.id, 'response.id', 'getEvent', "eventId='abc123'");
 * // After this call, TypeScript knows response.data.id is string (not null | undefined)
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
