/**
 * Tests for renderTemplate — shared template rendering utility
 */

import { describe, test, expect } from '@jest/globals';
import { renderTemplate } from '../templates.js';

describe('renderTemplate', () => {
  test('replaces single variable', () => {
    const result = renderTemplate('Hello {{name}}!', { name: 'Amy' });
    expect(result).toBe('Hello Amy!');
  });

  test('replaces multiple variables', () => {
    const result = renderTemplate(
      '{{greeting}} {{name}}, {{message}}',
      { greeting: 'Hi', name: 'Amy', message: 'welcome aboard' }
    );
    expect(result).toBe('Hi Amy, welcome aboard');
  });

  test('replaces same variable used twice', () => {
    const result = renderTemplate(
      '{{name}} is great. Thanks {{name}}!',
      { name: 'Amy' }
    );
    expect(result).toBe('Amy is great. Thanks Amy!');
  });

  test('throws on missing variable', () => {
    expect(() =>
      renderTemplate('Hello {{name}}, your code is {{code}}', { name: 'Amy' })
    ).toThrow('Missing template variable: code');
  });

  test('handles empty variables object with no placeholders', () => {
    const result = renderTemplate('No variables here', {});
    expect(result).toBe('No variables here');
  });

  test('preserves whitespace and newlines', () => {
    const result = renderTemplate(
      'Line 1: {{a}}\nLine 2: {{b}}',
      { a: 'hello', b: 'world' }
    );
    expect(result).toBe('Line 1: hello\nLine 2: world');
  });

  test('HTML-escapes values when isHtml is true', () => {
    const result = renderTemplate(
      '<p>{{content}}</p>',
      { content: '<script>alert("xss")</script>' },
      true
    );
    expect(result).toBe('<p>&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;</p>');
  });

  test('does not HTML-escape when isHtml is false', () => {
    const result = renderTemplate(
      'Value: {{val}}',
      { val: '<b>bold</b>' },
      false
    );
    expect(result).toBe('Value: <b>bold</b>');
  });
});
