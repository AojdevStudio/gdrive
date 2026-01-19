/**
 * Tests for calendar utility functions
 */

import { normalizeEventDateTime } from '../utils.js';

describe('normalizeEventDateTime', () => {
  describe('with undefined/null input', () => {
    it('should return undefined for undefined input', () => {
      expect(normalizeEventDateTime(undefined, 'start')).toBeUndefined();
    });

    it('should return undefined for null input', () => {
      expect(normalizeEventDateTime(null as unknown as undefined, 'start')).toBeUndefined();
    });
  });

  describe('with ISO datetime string input', () => {
    it('should convert ISO string with timezone offset to EventDateTime', () => {
      const result = normalizeEventDateTime('2026-01-10T14:00:00-06:00', 'start');
      expect(result).toEqual({ dateTime: '2026-01-10T14:00:00-06:00' });
    });

    it('should convert ISO string with Z timezone to EventDateTime', () => {
      const result = normalizeEventDateTime('2026-01-10T20:00:00Z', 'start');
      expect(result).toEqual({ dateTime: '2026-01-10T20:00:00Z' });
    });

    it('should convert ISO string without timezone to EventDateTime', () => {
      const result = normalizeEventDateTime('2026-01-10T14:00:00', 'start');
      expect(result).toEqual({ dateTime: '2026-01-10T14:00:00' });
    });
  });

  describe('with date-only string input', () => {
    it('should convert YYYY-MM-DD string to date format', () => {
      const result = normalizeEventDateTime('2026-01-10', 'start');
      expect(result).toEqual({ date: '2026-01-10' });
    });

    it('should handle end of month dates', () => {
      const result = normalizeEventDateTime('2026-12-31', 'end');
      expect(result).toEqual({ date: '2026-12-31' });
    });

    it('should handle leap year dates', () => {
      const result = normalizeEventDateTime('2028-02-29', 'start');
      expect(result).toEqual({ date: '2028-02-29' });
    });
  });

  describe('with EventDateTime object input', () => {
    it('should pass through EventDateTime with dateTime', () => {
      const input = { dateTime: '2026-01-10T14:00:00-06:00' };
      const result = normalizeEventDateTime(input, 'start');
      expect(result).toEqual(input);
    });

    it('should pass through EventDateTime with dateTime and timeZone', () => {
      const input = { dateTime: '2026-01-10T14:00:00', timeZone: 'America/Chicago' };
      const result = normalizeEventDateTime(input, 'start');
      expect(result).toEqual(input);
    });

    it('should pass through EventDateTime with date only', () => {
      const input = { date: '2026-01-10' };
      const result = normalizeEventDateTime(input, 'start');
      expect(result).toEqual(input);
    });

    it('should pass through EventDateTime with date and timeZone', () => {
      const input = { date: '2026-01-10', timeZone: 'America/Chicago' };
      const result = normalizeEventDateTime(input, 'end');
      expect(result).toEqual(input);
    });
  });

  describe('with invalid input', () => {
    it('should throw error for empty string', () => {
      expect(() => normalizeEventDateTime('', 'start')).toThrow(
        /Invalid start format: empty string/
      );
    });

    it('should throw error for whitespace-only string', () => {
      expect(() => normalizeEventDateTime('   ', 'start')).toThrow(
        /Invalid start format: empty string/
      );
    });

    it('should throw error for invalid date string', () => {
      expect(() => normalizeEventDateTime('not-a-date', 'start')).toThrow(
        /Invalid start format.*not a valid datetime/
      );
    });

    it('should throw error for malformed date', () => {
      expect(() => normalizeEventDateTime('2026-99-99', 'end')).toThrow(
        /Invalid end format.*not a valid date/
      );
    });

    it('should throw error for EventDateTime without date or dateTime', () => {
      const input = { timeZone: 'America/Chicago' } as { dateTime?: string; date?: string; timeZone?: string };
      expect(() => normalizeEventDateTime(input, 'start')).toThrow(
        /Invalid start format: EventDateTime object must have 'dateTime' or 'date' field/
      );
    });

    it('should include field name in error message', () => {
      expect(() => normalizeEventDateTime('invalid', 'end')).toThrow(/Invalid end format/);
    });

    it('should include examples in error message', () => {
      expect(() => normalizeEventDateTime('invalid', 'start')).toThrow(
        /2026-01-10T14:00:00-06:00/
      );
    });
  });

  describe('edge cases', () => {
    it('should handle midnight times', () => {
      const result = normalizeEventDateTime('2026-01-10T00:00:00Z', 'start');
      expect(result).toEqual({ dateTime: '2026-01-10T00:00:00Z' });
    });

    it('should handle end-of-day times', () => {
      const result = normalizeEventDateTime('2026-01-10T23:59:59-06:00', 'end');
      expect(result).toEqual({ dateTime: '2026-01-10T23:59:59-06:00' });
    });

    it('should handle positive timezone offsets', () => {
      const result = normalizeEventDateTime('2026-01-10T14:00:00+05:30', 'start');
      expect(result).toEqual({ dateTime: '2026-01-10T14:00:00+05:30' });
    });

    it('should use default fieldName if not provided', () => {
      expect(() => normalizeEventDateTime('invalid')).toThrow(/Invalid datetime format/);
    });
  });
});
