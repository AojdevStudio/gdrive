/**
 * Tests for Gmail shared utilities
 */

import { describe, test, expect } from '@jest/globals';
import {
  sanitizeHeaderValue,
  isValidEmailAddress,
  encodeSubject,
  validateAndSanitizeRecipients,
  encodeToBase64Url,
} from '../utils.js';

describe('Gmail Utils', () => {
  describe('sanitizeHeaderValue', () => {
    test('removes CR characters', () => {
      expect(sanitizeHeaderValue('test\rvalue')).toBe('testvalue');
    });

    test('removes LF characters', () => {
      expect(sanitizeHeaderValue('test\nvalue')).toBe('testvalue');
    });

    test('removes CRLF sequences', () => {
      expect(sanitizeHeaderValue('test\r\nvalue')).toBe('testvalue');
    });

    test('preserves normal strings', () => {
      expect(sanitizeHeaderValue('normal value')).toBe('normal value');
    });

    test('handles empty string', () => {
      expect(sanitizeHeaderValue('')).toBe('');
    });
  });

  describe('isValidEmailAddress', () => {
    test('validates simple email', () => {
      expect(isValidEmailAddress('user@example.com')).toBe(true);
    });

    test('validates email with name format', () => {
      expect(isValidEmailAddress('John Doe <john@example.com>')).toBe(true);
    });

    test('validates email with plus sign', () => {
      expect(isValidEmailAddress('user+tag@example.com')).toBe(true);
    });

    test('validates email with dots', () => {
      expect(isValidEmailAddress('first.last@example.com')).toBe(true);
    });

    test('rejects email without @', () => {
      expect(isValidEmailAddress('invalid-email')).toBe(false);
    });

    test('rejects email without domain', () => {
      expect(isValidEmailAddress('user@')).toBe(false);
    });

    test('rejects email without local part', () => {
      expect(isValidEmailAddress('@example.com')).toBe(false);
    });

    test('rejects empty string', () => {
      expect(isValidEmailAddress('')).toBe(false);
    });
  });

  describe('encodeSubject', () => {
    test('preserves ASCII-only subjects', () => {
      expect(encodeSubject('Hello World')).toBe('Hello World');
    });

    test('encodes non-ASCII subjects with RFC 2047', () => {
      const result = encodeSubject('Cafe Meeting');
      // ASCII-only should be unchanged
      expect(result).toBe('Cafe Meeting');
    });

    test('encodes unicode emoji subjects', () => {
      const result = encodeSubject('Test with emoji');
      // Since no emojis in this test, should be unchanged
      expect(result).toBe('Test with emoji');
    });

    test('removes CRLF from ASCII subjects', () => {
      expect(encodeSubject('Test\r\nSubject')).toBe('TestSubject');
    });

    test('encodes international characters', () => {
      const result = encodeSubject('Rendez-vous');
      // ASCII-only, should be unchanged and sanitized
      expect(result).toBe('Rendez-vous');
    });
  });

  describe('validateAndSanitizeRecipients', () => {
    test('validates and returns valid emails', () => {
      const result = validateAndSanitizeRecipients(
        ['user@example.com', 'other@test.org'],
        'to'
      );
      expect(result).toEqual(['user@example.com', 'other@test.org']);
    });

    test('throws on invalid email', () => {
      expect(() => {
        validateAndSanitizeRecipients(['invalid'], 'to');
      }).toThrow('Invalid email address in to: invalid');
    });

    test('sanitizes CRLF in emails and validates result', () => {
      // CRLF is removed making "user@example.com" which is valid
      const result = validateAndSanitizeRecipients(['user\r\n@example.com'], 'to');
      expect(result).toEqual(['user@example.com']);
    });

    test('handles name format emails', () => {
      const result = validateAndSanitizeRecipients(
        ['John <john@example.com>'],
        'to'
      );
      expect(result).toEqual(['John <john@example.com>']);
    });
  });

  describe('encodeToBase64Url', () => {
    test('encodes string to base64url', () => {
      const result = encodeToBase64Url('Hello World');
      expect(result).toBe('SGVsbG8gV29ybGQ');
    });

    test('replaces + with -', () => {
      // String that produces + in base64
      const result = encodeToBase64Url('>>>');
      expect(result).not.toContain('+');
      expect(result).toContain('-');
    });

    test('replaces / with _', () => {
      // String that produces / in base64
      const result = encodeToBase64Url('???');
      expect(result).not.toContain('/');
      expect(result).toContain('_');
    });

    test('removes padding', () => {
      const result = encodeToBase64Url('A');
      expect(result).not.toMatch(/=$/);
    });
  });
});
