/**
 * Tests for dryRunMessage — preview rendered email without sending
 */

import { describe, test, expect } from '@jest/globals';
import { dryRunMessage } from '../compose.js';

describe('dryRunMessage', () => {
  test('renders template variables in subject and body', () => {
    const result = dryRunMessage({
      to: ['amy@todaysdental.com'],
      subject: '{{firstName}}, quick follow-up',
      template: 'Hey {{firstName}},\n\n{{personalNote}}',
      variables: { firstName: 'Amy', personalNote: 'We rebuilt your claims sheet' },
    });

    expect(result.subject).toBe('Amy, quick follow-up');
    expect(result.body).toBe('Hey Amy,\n\nWe rebuilt your claims sheet');
    expect(result.wouldSend).toBe(false);
  });

  test('validates recipient email addresses', () => {
    expect(() =>
      dryRunMessage({
        to: ['not-an-email'],
        subject: 'Test',
        template: 'Hello',
        variables: {},
      })
    ).toThrow('Invalid email address in to');
  });

  test('returns sanitized to array', () => {
    const result = dryRunMessage({
      to: ['amy@todaysdental.com', 'haley@todaysdental.com'],
      subject: 'Hi',
      template: 'Body',
      variables: {},
    });

    expect(result.to).toEqual(['amy@todaysdental.com', 'haley@todaysdental.com']);
    expect(result.isHtml).toBe(false);
  });

  test('HTML-escapes variables when isHtml is true', () => {
    const result = dryRunMessage({
      to: ['user@example.com'],
      subject: 'Hello {{name}}',
      template: '<p>{{content}}</p>',
      variables: { name: 'Amy', content: '<script>alert("xss")</script>' },
      isHtml: true,
    });

    expect(result.isHtml).toBe(true);
    expect(result.body).toBe('<p>&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;</p>');
    // Subject is never HTML-escaped (it's always plain text in email headers)
    expect(result.subject).toBe('Hello Amy');
  });
});
