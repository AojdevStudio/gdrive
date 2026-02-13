/**
 * Tests for Gmail validation utilities
 */

import { describe, test, expect } from '@jest/globals';
import { assertRequiredString, assertModifyLabelsOperation } from '../validation.js';

describe('assertRequiredString', () => {
  test('throws on null value', () => {
    expect(() => {
      assertRequiredString(null, 'response.id', 'getMessage');
    }).toThrow('getMessage: response.id is null');
  });

  test('throws on undefined value', () => {
    expect(() => {
      assertRequiredString(undefined, 'response.id', 'getMessage');
    }).toThrow('getMessage: response.id is undefined');
  });

  test('passes on valid string', () => {
    expect(() => {
      assertRequiredString('abc123', 'response.id', 'getMessage');
    }).not.toThrow();
  });

  test('error message includes context arguments', () => {
    expect(() => {
      assertRequiredString(undefined, 'response.id', 'getMessage', "messageId='abc123'");
    }).toThrow("getMessage: response.id is undefined for messageId='abc123'");
  });

  test('error message includes multiple context arguments', () => {
    expect(() => {
      assertRequiredString(null, 'msg.id', 'listMessages', "index=3", "labelIds=['INBOX']");
    }).toThrow("listMessages: msg.id is null for index=3, labelIds=['INBOX']");
  });

  test('passes on empty string (empty string is a valid string)', () => {
    expect(() => {
      assertRequiredString('', 'response.id', 'getMessage');
    }).not.toThrow();
  });
});

describe('assertModifyLabelsOperation', () => {
  test('throws when both arrays are empty', () => {
    expect(() => {
      assertModifyLabelsOperation([], []);
    }).toThrow('modifyLabels: at least one of addLabelIds or removeLabelIds must be provided');
  });

  test('throws when both are undefined', () => {
    expect(() => {
      assertModifyLabelsOperation(undefined, undefined);
    }).toThrow('modifyLabels: at least one of addLabelIds or removeLabelIds must be provided');
  });

  test('throws when one is empty and other is undefined', () => {
    expect(() => {
      assertModifyLabelsOperation([], undefined);
    }).toThrow('modifyLabels: at least one of addLabelIds or removeLabelIds must be provided');
  });

  test('passes when addLabelIds has items', () => {
    expect(() => {
      assertModifyLabelsOperation(['Label_12345'], undefined);
    }).not.toThrow();
  });

  test('passes when removeLabelIds has items', () => {
    expect(() => {
      assertModifyLabelsOperation(undefined, ['UNREAD']);
    }).not.toThrow();
  });

  test('passes when both have items', () => {
    expect(() => {
      assertModifyLabelsOperation(['Label_12345'], ['UNREAD', 'INBOX']);
    }).not.toThrow();
  });
});
