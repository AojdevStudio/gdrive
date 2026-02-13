/**
 * Tests for calendar validation utilities
 */

import { describe, test, expect } from '@jest/globals';
import { assertRequiredString } from '../validation.js';

describe('assertRequiredString', () => {
  test('throws on null with descriptive message', () => {
    expect(() =>
      assertRequiredString(null, 'response.id', 'getEvent', "eventId='abc123'")
    ).toThrow("getEvent: response.id is null for eventId='abc123'");
  });

  test('throws on undefined with descriptive message', () => {
    expect(() =>
      assertRequiredString(undefined, 'response.id', 'getEvent', "eventId='abc123'")
    ).toThrow("getEvent: response.id is undefined for eventId='abc123'");
  });

  test('passes on valid string without throwing', () => {
    expect(() =>
      assertRequiredString('valid-id', 'response.id', 'getEvent', "eventId='abc123'")
    ).not.toThrow();
  });

  test('error message includes operation name', () => {
    try {
      assertRequiredString(null, 'response.id', 'checkFreeBusy');
      // Should not reach here
      expect(true).toBe(false);
    } catch (error) {
      expect((error as Error).message).toContain('checkFreeBusy');
    }
  });

  test('error message includes context arguments', () => {
    try {
      assertRequiredString(
        undefined,
        'period.start',
        'checkFreeBusy',
        "calendarId='primary'",
        "index=0"
      );
      // Should not reach here
      expect(true).toBe(false);
    } catch (error) {
      const message = (error as Error).message;
      expect(message).toContain("calendarId='primary'");
      expect(message).toContain('index=0');
      expect(message).toBe(
        "checkFreeBusy: period.start is undefined for calendarId='primary', index=0"
      );
    }
  });

  test('works without context arguments', () => {
    expect(() =>
      assertRequiredString(null, 'response.id', 'getCalendar')
    ).toThrow('getCalendar: response.id is null');
  });

  test('narrows type after assertion (compile-time check)', () => {
    const value: string | null | undefined = 'test-value';
    assertRequiredString(value, 'field', 'op');
    // After assertion, TypeScript knows value is string
    const length: number = value.length;
    expect(length).toBe(10);
  });
});
