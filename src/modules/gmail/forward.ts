/**
 * Gmail forward operations - forwardMessage
 */

import type { gmail_v1 } from 'googleapis';
import type { GmailContext } from '../types.js';
import type {
  ForwardMessageOptions,
  ForwardMessageResult,
} from './types.js';
import { buildEmailMessage, encodeToBase64Url } from './utils.js';

/**
 * Find a header value (case-insensitive) from headers array
 */
function findHeader(headers: gmail_v1.Schema$MessagePartHeader[], name: string): string {
  const lower = name.toLowerCase();
  const header = headers.find(h => h.name?.toLowerCase() === lower);
  return header?.value || '';
}

/**
 * Extract plain text body from a Gmail message payload
 */
function extractPlainBody(payload: gmail_v1.Schema$MessagePart | undefined): string {
  if (!payload) {return '';}

  const decode = (data: string | undefined | null): string => {
    if (!data) {return '';}
    return Buffer.from(data, 'base64url').toString('utf-8');
  };

  // Simple single-part message
  if (payload.body?.data) {
    const mimeType = payload.mimeType || '';
    if (mimeType === 'text/plain' || mimeType === 'text/html') {
      return decode(payload.body.data);
    }
    return decode(payload.body.data);
  }

  // Multipart — prefer text/plain
  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        return decode(part.body.data);
      }
    }
    // Fallback to first part with data
    for (const part of payload.parts) {
      if (part.body?.data) {
        return decode(part.body.data);
      }
      // Recurse into nested multipart
      if (part.mimeType?.startsWith('multipart/') && part.parts) {
        const nested = extractPlainBody(part);
        if (nested) {return nested;}
      }
    }
  }

  return '';
}

/**
 * Get subject prefix for forwards — adds Fwd: if not already present
 */
function forwardSubject(subject: string): string {
  if (/^fwd:/i.test(subject.trim())) {
    return subject;
  }
  return `Fwd: ${subject}`;
}

/**
 * Forward a message to new recipients with the original content quoted.
 *
 * Does not set threading headers (forwarding creates a new thread).
 * Optionally prepends a custom body before the quoted original.
 *
 * @param options Forward content, recipients, and message to forward
 * @param context Gmail API context
 * @returns Sent message info
 *
 * @example
 * ```typescript
 * const result = await forwardMessage({
 *   messageId: '18c123abc',
 *   to: ['colleague@example.com'],
 *   body: 'FYI, see below.',
 * }, context);
 *
 * console.log(`Forwarded as: ${result.messageId}`);
 * ```
 */
export async function forwardMessage(
  options: ForwardMessageOptions,
  context: GmailContext
): Promise<ForwardMessageResult> {
  const { messageId, to, cc, bcc, body, isHtml, from } = options;

  // Fetch original message for content and headers
  const originalResponse = await context.gmail.users.messages.get({
    userId: 'me',
    id: messageId,
    format: 'full',
  });

  const originalData = originalResponse.data;
  const headers = originalData.payload?.headers || [];

  const originalFrom = findHeader(headers, 'From');
  const originalSubject = findHeader(headers, 'Subject');
  const originalDate = findHeader(headers, 'Date');
  const originalTo = findHeader(headers, 'To');

  // Build forward subject
  const subject = forwardSubject(originalSubject);

  // Extract original body text
  const originalBody = extractPlainBody(originalData.payload || undefined);

  // Build quoted forward body
  const quotedHeader = [
    `---------- Forwarded message ---------`,
    `From: ${originalFrom}`,
    `Date: ${originalDate}`,
    `Subject: ${originalSubject}`,
    `To: ${originalTo}`,
    ``,
  ].join('\r\n');

  const forwardedBody = body
    ? `${body}\r\n\r\n${quotedHeader}${originalBody}`
    : `${quotedHeader}${originalBody}`;

  // Build params object without undefined optional fields (exactOptionalPropertyTypes)
  const messageParams: Parameters<typeof buildEmailMessage>[0] = {
    to,
    subject,
    body: forwardedBody,
  };
  if (cc && cc.length > 0) {messageParams.cc = cc;}
  if (bcc && bcc.length > 0) {messageParams.bcc = bcc;}
  if (isHtml !== undefined) {messageParams.isHtml = isHtml;}
  if (from) {messageParams.from = from;}
  // No inReplyTo or references — forward creates a new thread

  const emailMessage = buildEmailMessage(messageParams);

  const encodedMessage = encodeToBase64Url(emailMessage);

  // Forward does NOT include threadId (new thread)
  const params: gmail_v1.Params$Resource$Users$Messages$Send = {
    userId: 'me',
    requestBody: {
      raw: encodedMessage,
    },
  };

  const response = await context.gmail.users.messages.send(params);

  const sentMessageId = response.data.id;
  const sentThreadId = response.data.threadId;
  const labelIds = response.data.labelIds || [];

  if (!sentMessageId) {
    throw new Error('Failed to forward message - no message ID returned');
  }

  await context.cacheManager.invalidate('gmail:list');
  await context.cacheManager.invalidate('gmail:search');

  context.performanceMonitor.track('gmail:forwardMessage', Date.now() - context.startTime);
  context.logger.info('Forwarded message', {
    originalMessageId: messageId,
    messageId: sentMessageId,
    to,
  });

  return {
    messageId: sentMessageId,
    threadId: sentThreadId || '',
    labelIds,
    message: 'Message forwarded successfully',
  };
}
