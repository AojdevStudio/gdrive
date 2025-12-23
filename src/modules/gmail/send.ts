/**
 * Gmail send operations - sendMessage and sendDraft
 */

import type { gmail_v1 } from 'googleapis';
import type { GmailContext } from '../types.js';
import type {
  SendMessageOptions,
  SendMessageResult,
  SendDraftOptions,
  SendDraftResult,
} from './types.js';

/**
 * Simple RFC 5322-like email address validation
 * Validates basic structure: local-part@domain
 */
function isValidEmailAddress(email: string): boolean {
  // Extract email from "Name <email>" format if present
  const match = email.match(/<([^>]+)>/) || [null, email];
  const address = match[1]?.trim() || email.trim();

  // Basic RFC 5322 pattern: local-part@domain
  // Local part: alphanumeric, dots, underscores, hyphens, plus signs
  // Domain: alphanumeric segments separated by dots
  const emailPattern = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  return emailPattern.test(address);
}

/**
 * Sanitize header field value by stripping CR/LF to prevent header injection
 */
function sanitizeHeaderValue(value: string): string {
  // Remove any CR (\r) or LF (\n) characters to prevent header injection attacks
  return value.replace(/[\r\n]/g, '');
}

/**
 * Encode subject using RFC 2047 MIME encoded-word for non-ASCII characters
 * Uses UTF-8 base64 encoding: =?UTF-8?B?<base64>?=
 */
function encodeSubject(subject: string): string {
  // Check if subject contains non-ASCII characters (char codes > 127)
  const hasNonAscii = [...subject].some(char => char.charCodeAt(0) > 127);

  if (!hasNonAscii) {
    // ASCII only - just sanitize and return
    return sanitizeHeaderValue(subject);
  }

  // Encode as RFC 2047 MIME encoded-word using UTF-8 base64
  const encoded = Buffer.from(subject, 'utf-8').toString('base64');
  return `=?UTF-8?B?${encoded}?=`;
}

/**
 * Validate and sanitize email addresses
 * Returns sanitized addresses or throws on invalid
 */
function validateAndSanitizeRecipients(emails: string[], fieldName: string): string[] {
  return emails.map(email => {
    const sanitized = sanitizeHeaderValue(email);
    if (!isValidEmailAddress(sanitized)) {
      throw new Error(`Invalid email address in ${fieldName}: ${sanitized}`);
    }
    return sanitized;
  });
}

/**
 * Build an RFC 2822 formatted email message with security hardening
 *
 * Security measures:
 * - CR/LF stripped from all header fields to prevent header injection
 * - Email addresses validated against RFC 5322 pattern
 * - Subject encoded using RFC 2047 for non-ASCII characters
 * - Bcc removed from headers (handled by Gmail in SMTP envelope)
 * - Proper CRLF CRLF separator before body
 */
function buildEmailMessage(options: SendMessageOptions): string {
  const { to, cc, subject, body, isHtml = false, from, inReplyTo, references } = options;
  // Note: bcc is intentionally not destructured - it's handled by Gmail's envelope, not message headers

  const lines: string[] = [];

  // Add headers with sanitization and validation
  if (from) {
    const sanitizedFrom = sanitizeHeaderValue(from);
    if (!isValidEmailAddress(sanitizedFrom)) {
      throw new Error(`Invalid from email address: ${sanitizedFrom}`);
    }
    lines.push(`From: ${sanitizedFrom}`);
  }

  // Validate and sanitize recipients
  const sanitizedTo = validateAndSanitizeRecipients(to, 'to');
  lines.push(`To: ${sanitizedTo.join(', ')}`);

  if (cc && cc.length > 0) {
    const sanitizedCc = validateAndSanitizeRecipients(cc, 'cc');
    lines.push(`Cc: ${sanitizedCc.join(', ')}`);
  }

  // Note: Bcc header is NOT included in the message body
  // Gmail handles Bcc recipients in the SMTP envelope automatically
  // Including Bcc in headers would expose recipients to each other

  // Encode subject with RFC 2047 for non-ASCII support
  lines.push(`Subject: ${encodeSubject(subject)}`);

  if (inReplyTo) {
    lines.push(`In-Reply-To: ${sanitizeHeaderValue(inReplyTo)}`);
  }
  if (references) {
    lines.push(`References: ${sanitizeHeaderValue(references)}`);
  }

  lines.push('MIME-Version: 1.0');
  lines.push(`Content-Type: ${isHtml ? 'text/html' : 'text/plain'}; charset="UTF-8"`);

  // RFC 2822 requires CRLF CRLF (empty line) to separate headers from body
  lines.push('');
  lines.push(body);

  return lines.join('\r\n');
}

/**
 * Send a new email message
 *
 * @param options Message content and recipients
 * @param context Gmail API context
 * @returns Sent message info
 *
 * @example
 * ```typescript
 * // Send a simple email
 * const result = await sendMessage({
 *   to: ['recipient@example.com'],
 *   subject: 'Hello',
 *   body: 'This is a test message.',
 * }, context);
 *
 * console.log(`Message sent: ${result.messageId}`);
 *
 * // Send from an alias (send-as)
 * const result2 = await sendMessage({
 *   to: ['recipient@example.com'],
 *   from: 'myalias@example.com',
 *   subject: 'From alias',
 *   body: 'Sent from my alias email.',
 * }, context);
 * ```
 */
export async function sendMessage(
  options: SendMessageOptions,
  context: GmailContext
): Promise<SendMessageResult> {
  const emailMessage = buildEmailMessage(options);

  // Convert to base64url encoding (Gmail's format)
  const encodedMessage = Buffer.from(emailMessage)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  // Build params - only include threadId if provided
  const params: gmail_v1.Params$Resource$Users$Messages$Send = {
    userId: 'me',
    requestBody: {
      raw: encodedMessage,
    },
  };

  // If replying to a thread, include the threadId
  if (options.threadId) {
    params.requestBody!.threadId = options.threadId;
  }

  const response = await context.gmail.users.messages.send(params);

  const messageId = response.data.id;
  const threadId = response.data.threadId;
  const labelIds = response.data.labelIds || [];

  if (!messageId) {
    throw new Error('Failed to send message - no message ID returned');
  }

  // Invalidate cached message/thread lists
  await context.cacheManager.invalidate('gmail:list');
  await context.cacheManager.invalidate('gmail:search');

  context.performanceMonitor.track('gmail:sendMessage', Date.now() - context.startTime);
  context.logger.info('Sent message', {
    messageId,
    to: options.to,
    subject: options.subject,
  });

  return {
    messageId,
    threadId: threadId || '',
    labelIds,
    message: 'Message sent successfully',
  };
}

/**
 * Send an existing draft
 *
 * @param options Draft ID to send
 * @param context Gmail API context
 * @returns Sent message info
 *
 * @example
 * ```typescript
 * const result = await sendDraft({
 *   draftId: 'r1234567890'
 * }, context);
 *
 * console.log(`Draft sent as message: ${result.messageId}`);
 * ```
 */
export async function sendDraft(
  options: SendDraftOptions,
  context: GmailContext
): Promise<SendDraftResult> {
  const { draftId } = options;

  const response = await context.gmail.users.drafts.send({
    userId: 'me',
    requestBody: {
      id: draftId,
    },
  });

  const messageId = response.data.id;
  const threadId = response.data.threadId;
  const labelIds = response.data.labelIds || [];

  if (!messageId) {
    throw new Error('Failed to send draft - no message ID returned');
  }

  // Invalidate cached lists
  await context.cacheManager.invalidate('gmail:list');
  await context.cacheManager.invalidate('gmail:search');

  context.performanceMonitor.track('gmail:sendDraft', Date.now() - context.startTime);
  context.logger.info('Sent draft', { draftId, messageId });

  return {
    messageId,
    threadId: threadId || '',
    labelIds,
    message: 'Draft sent successfully',
  };
}
