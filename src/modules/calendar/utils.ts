/**
 * Shared calendar utilities
 */

import type { EventDateTime } from './types.js';

/**
 * Input type for datetime normalization - accepts string or EventDateTime object
 */
export type DateTimeInput = string | EventDateTime;

/**
 * Normalize datetime input to EventDateTime object
 *
 * Supports multiple input formats:
 * - ISO 8601 datetime string: "2026-01-10T14:00:00-06:00" → {dateTime: "..."}
 * - Date-only string: "2026-01-10" → {date: "..."}
 * - EventDateTime object: {dateTime: "...", timeZone: "..."} → passthrough
 *
 * @param input - String or EventDateTime to normalize
 * @param fieldName - Field name for error messages (e.g., "start", "end")
 * @returns Normalized EventDateTime object or undefined if input is undefined
 * @throws Error if input is an invalid datetime format
 *
 * @example
 * // ISO string with timezone offset
 * normalizeEventDateTime("2026-01-10T14:00:00-06:00", "start")
 * // Returns: {dateTime: "2026-01-10T14:00:00-06:00"}
 *
 * @example
 * // Date-only string (all-day event)
 * normalizeEventDateTime("2026-01-10", "start")
 * // Returns: {date: "2026-01-10"}
 *
 * @example
 * // EventDateTime object (passthrough)
 * normalizeEventDateTime({dateTime: "2026-01-10T14:00:00-06:00", timeZone: "America/Chicago"}, "start")
 * // Returns: {dateTime: "2026-01-10T14:00:00-06:00", timeZone: "America/Chicago"}
 */
export function normalizeEventDateTime(
  input: DateTimeInput | undefined,
  fieldName: string = 'datetime'
): EventDateTime | undefined {
  // Handle undefined/null input
  if (input === undefined || input === null) {
    return undefined;
  }

  // If already an EventDateTime object, validate and return
  if (typeof input === 'object') {
    // Validate that it has at least one of the expected fields
    if (!input.dateTime && !input.date) {
      throw new Error(
        `Invalid ${fieldName} format: EventDateTime object must have 'dateTime' or 'date' field. ` +
        `Example: {dateTime: "2026-01-10T14:00:00-06:00"} or {date: "2026-01-10"}`
      );
    }
    return input;
  }

  // Handle string input
  if (typeof input === 'string') {
    const trimmed = input.trim();

    if (trimmed === '') {
      throw new Error(
        `Invalid ${fieldName} format: empty string provided. ` +
        `Expected ISO 8601 datetime or date string.`
      );
    }

    // Check if it's a date-only string (YYYY-MM-DD format, exactly 10 chars, no 'T')
    const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(trimmed);

    if (isDateOnly) {
      // Validate the date is parseable
      const parsed = new Date(trimmed);
      if (isNaN(parsed.getTime())) {
        throw new Error(
          `Invalid ${fieldName} format: "${trimmed}" is not a valid date. ` +
          `Expected format: YYYY-MM-DD (e.g., "2026-01-10")`
        );
      }
      return { date: trimmed };
    }

    // Otherwise treat as datetime string
    // Validate the datetime is parseable
    const parsed = new Date(trimmed);
    if (isNaN(parsed.getTime())) {
      throw new Error(
        `Invalid ${fieldName} format: "${trimmed}" is not a valid datetime. ` +
        `Expected ISO 8601 format (e.g., "2026-01-10T14:00:00-06:00") or EventDateTime object.`
      );
    }

    return { dateTime: trimmed };
  }

  // Unknown type
  throw new Error(
    `Invalid ${fieldName} format: expected string or EventDateTime object, got ${typeof input}. ` +
    `Example: "2026-01-10T14:00:00-06:00" or {dateTime: "...", timeZone: "..."}`
  );
}

/**
 * Validate event time parameters
 * - Ensures end time is after start time
 * - Validates all-day events use 'date' field, not 'dateTime'
 *
 * @param start Event start time
 * @param end Event end time
 * @throws Error if validation fails
 */
export function validateEventTimes(
  start: { dateTime?: string; date?: string },
  end: { dateTime?: string; date?: string }
): void {
  // Check all-day event consistency
  if (start.date && start.dateTime) {
    throw new Error("All-day events should use 'date' field, not 'dateTime'");
  }
  if (end.date && end.dateTime) {
    throw new Error("All-day events should use 'date' field, not 'dateTime'");
  }

  // Check end is after start (for dateTime events)
  if (start.dateTime && end.dateTime) {
    const startTime = new Date(start.dateTime).getTime();
    const endTime = new Date(end.dateTime).getTime();

    if (endTime <= startTime) {
      throw new Error('Event end time must be after start time');
    }
  }

  // Check end is after start (for all-day events)
  if (start.date && end.date) {
    const startTime = new Date(start.date).getTime();
    const endTime = new Date(end.date).getTime();

    if (endTime <= startTime) {
      throw new Error('Event end time must be after start time');
    }
  }
}
