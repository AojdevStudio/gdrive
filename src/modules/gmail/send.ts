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
 * Build an RFC 2822 formatted email message
 */
function buildEmailMessage(options: SendMessageOptions): string {
  const { to, cc, bcc, subject, body, isHtml = false, from, inReplyTo, references } = options;

  const lines: string[] = [];

  // Add headers
  if (from) {
    lines.push(`From: ${from}`);
  }
  lines.push(`To: ${to.join(', ')}`);
  if (cc && cc.length > 0) {
    lines.push(`Cc: ${cc.join(', ')}`);
  }
  if (bcc && bcc.length > 0) {
    lines.push(`Bcc: ${bcc.join(', ')}`);
  }
  lines.push(`Subject: ${subject}`);
  if (inReplyTo) {
    lines.push(`In-Reply-To: ${inReplyTo}`);
  }
  if (references) {
    lines.push(`References: ${references}`);
  }
  lines.push('MIME-Version: 1.0');
  lines.push(`Content-Type: ${isHtml ? 'text/html' : 'text/plain'}; charset="UTF-8"`);
  lines.push(''); // Empty line between headers and body
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
