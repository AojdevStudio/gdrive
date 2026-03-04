/**
 * Gmail reply operations - replyToMessage and replyAllToMessage
 */

import type { gmail_v1 } from 'googleapis';
import type { GmailContext } from '../types.js';
import type {
  ReplyToMessageOptions,
  ReplyToMessageResult,
  ReplyAllToMessageOptions,
  ReplyAllToMessageResult,
} from './types.js';
import { buildEmailMessage, encodeToBase64Url } from './utils.js';

/**
 * Extract email address from a "Name <email>" format or plain email string
 */
function extractEmailAddress(value: string): string {
  const match = value.match(/<([^>]+)>/);
  return match ? (match[1] ?? '').trim() : value.trim();
}

/**
 * Parse a comma-separated list of email addresses
 */
function parseEmailList(value: string | undefined): string[] {
  if (!value || value.trim() === '') {return [];}
  return value.split(',').map(e => e.trim()).filter(e => e.length > 0);
}

/**
 * Parse headers from raw gmail message headers array
 */
function findHeader(headers: gmail_v1.Schema$MessagePartHeader[], name: string): string {
  const lower = name.toLowerCase();
  const header = headers.find(h => h.name?.toLowerCase() === lower);
  return header?.value || '';
}

/**
 * Get subject prefix for replies — adds Re: if not already present
 */
function replySubject(subject: string): string {
  if (/^re:/i.test(subject.trim())) {
    return subject;
  }
  return `Re: ${subject}`;
}

/**
 * Reply to a specific message, maintaining proper MIME threading headers.
 *
 * Fetches the original message to extract its MIME Message-ID header (not the
 * Gmail UI ID) and sets In-Reply-To and References headers accordingly.
 *
 * @param options Reply content and message to reply to
 * @param context Gmail API context
 * @returns Sent reply info
 *
 * @example
 * ```typescript
 * const result = await replyToMessage({
 *   messageId: '18c123abc',
 *   body: 'Thanks for reaching out!',
 * }, context);
 *
 * console.log(`Reply sent: ${result.messageId}`);
 * ```
 */
export async function replyToMessage(
  options: ReplyToMessageOptions,
  context: GmailContext
): Promise<ReplyToMessageResult> {
  const { messageId, body, isHtml, cc, bcc, from } = options;

  // Fetch original message to get threading headers
  const originalResponse = await context.gmail.users.messages.get({
    userId: 'me',
    id: messageId,
    format: 'metadata',
    metadataHeaders: ['From', 'Subject', 'Message-ID', 'References', 'To'],
  });

  const originalData = originalResponse.data;
  const headers = originalData.payload?.headers || [];

  const originalFrom = findHeader(headers, 'From');
  const originalSubject = findHeader(headers, 'Subject');
  const originalMessageId = findHeader(headers, 'Message-ID');
  const originalReferences = findHeader(headers, 'References');
  const threadId = originalData.threadId || '';

  // Build threading headers from the original message's MIME Message-ID
  let inReplyTo: string | undefined;
  let references: string | undefined;

  if (originalMessageId) {
    inReplyTo = originalMessageId;
    // References = original References + original Message-ID
    references = originalReferences
      ? `${originalReferences} ${originalMessageId}`
      : originalMessageId;
  }

  // Determine subject
  const subject = replySubject(originalSubject);

  // Build params without passing undefined to optional fields (exactOptionalPropertyTypes)
  const messageParams: Parameters<typeof buildEmailMessage>[0] = {
    to: [originalFrom],
    subject,
    body,
  };
  if (cc && cc.length > 0) {messageParams.cc = cc;}
  if (bcc && bcc.length > 0) {messageParams.bcc = bcc;}
  if (isHtml !== undefined) {messageParams.isHtml = isHtml;}
  if (from) {messageParams.from = from;}
  if (inReplyTo) {messageParams.inReplyTo = inReplyTo;}
  if (references) {messageParams.references = references;}

  // Build the email message
  const emailMessage = buildEmailMessage(messageParams);

  const encodedMessage = encodeToBase64Url(emailMessage);

  // Build params with threadId to keep reply in the same thread
  const params: gmail_v1.Params$Resource$Users$Messages$Send = {
    userId: 'me',
    requestBody: {
      raw: encodedMessage,
      threadId,
    },
  };

  const response = await context.gmail.users.messages.send(params);

  const sentMessageId = response.data.id;
  const sentThreadId = response.data.threadId;
  const labelIds = response.data.labelIds || [];

  if (!sentMessageId) {
    throw new Error('Failed to send reply - no message ID returned');
  }

  // Invalidate cached message/thread lists
  await context.cacheManager.invalidate('gmail:list');
  await context.cacheManager.invalidate('gmail:search');

  context.performanceMonitor.track('gmail:replyToMessage', Date.now() - context.startTime);
  context.logger.info('Sent reply', {
    originalMessageId: messageId,
    messageId: sentMessageId,
  });

  return {
    messageId: sentMessageId,
    threadId: sentThreadId || '',
    labelIds,
    message: 'Reply sent successfully',
  };
}

/**
 * Reply-all to a message, including all original recipients except yourself.
 *
 * Fetches the user's own email via users.getProfile to exclude from recipients.
 * Deduplicates the final recipient list.
 *
 * @param options Reply-all content and message to reply to
 * @param context Gmail API context
 * @returns Sent reply info
 *
 * @example
 * ```typescript
 * const result = await replyAllToMessage({
 *   messageId: '18c123abc',
 *   body: 'Thanks all!',
 * }, context);
 * ```
 */
export async function replyAllToMessage(
  options: ReplyAllToMessageOptions,
  context: GmailContext
): Promise<ReplyAllToMessageResult> {
  const { messageId, body, isHtml, bcc, from } = options;

  // Fetch own email address to exclude from recipients
  const profileResponse = await context.gmail.users.getProfile({ userId: 'me' });
  const ownEmail = profileResponse.data.emailAddress || '';
  const ownEmailLower = ownEmail.toLowerCase();

  // Fetch original message threading and recipient headers
  const originalResponse = await context.gmail.users.messages.get({
    userId: 'me',
    id: messageId,
    format: 'metadata',
    metadataHeaders: ['From', 'To', 'Cc', 'Subject', 'Message-ID', 'References'],
  });

  const originalData = originalResponse.data;
  const headers = originalData.payload?.headers || [];

  const originalFrom = findHeader(headers, 'From');
  const originalTo = findHeader(headers, 'To');
  const originalCc = findHeader(headers, 'Cc');
  const originalSubject = findHeader(headers, 'Subject');
  const originalMessageId = findHeader(headers, 'Message-ID');
  const originalReferences = findHeader(headers, 'References');
  const threadId = originalData.threadId || '';

  // Build threading headers
  let inReplyTo: string | undefined;
  let references: string | undefined;

  if (originalMessageId) {
    inReplyTo = originalMessageId;
    references = originalReferences
      ? `${originalReferences} ${originalMessageId}`
      : originalMessageId;
  }

  // Collect all To recipients: original From + original To recipients
  const toAddresses: string[] = [];
  toAddresses.push(originalFrom);
  toAddresses.push(...parseEmailList(originalTo));

  // Deduplicate To recipients and exclude self
  const seenEmails = new Set<string>();
  const filteredTo: string[] = [];
  for (const addr of toAddresses) {
    const bare = extractEmailAddress(addr).toLowerCase();
    if (bare !== ownEmailLower && !seenEmails.has(bare)) {
      seenEmails.add(bare);
      filteredTo.push(addr);
    }
  }

  // Collect Cc recipients from original Cc, excluding self and already-in-To
  const ccAddresses = parseEmailList(originalCc);
  const filteredCc: string[] = [];
  for (const addr of ccAddresses) {
    const bare = extractEmailAddress(addr).toLowerCase();
    if (bare !== ownEmailLower && !seenEmails.has(bare)) {
      seenEmails.add(bare);
      filteredCc.push(addr);
    }
  }

  const subject = replySubject(originalSubject);

  // Build params without passing undefined to optional fields (exactOptionalPropertyTypes)
  const messageParams: Parameters<typeof buildEmailMessage>[0] = {
    to: filteredTo,
    subject,
    body,
  };
  if (filteredCc.length > 0) {messageParams.cc = filteredCc;}
  if (bcc && bcc.length > 0) {messageParams.bcc = bcc;}
  if (isHtml !== undefined) {messageParams.isHtml = isHtml;}
  if (from) {messageParams.from = from;}
  if (inReplyTo) {messageParams.inReplyTo = inReplyTo;}
  if (references) {messageParams.references = references;}

  const emailMessage = buildEmailMessage(messageParams);

  const encodedMessage = encodeToBase64Url(emailMessage);

  const params: gmail_v1.Params$Resource$Users$Messages$Send = {
    userId: 'me',
    requestBody: {
      raw: encodedMessage,
      threadId,
    },
  };

  const response = await context.gmail.users.messages.send(params);

  const sentMessageId = response.data.id;
  const sentThreadId = response.data.threadId;
  const labelIds = response.data.labelIds || [];

  if (!sentMessageId) {
    throw new Error('Failed to send reply-all - no message ID returned');
  }

  await context.cacheManager.invalidate('gmail:list');
  await context.cacheManager.invalidate('gmail:search');

  context.performanceMonitor.track('gmail:replyAllToMessage', Date.now() - context.startTime);
  context.logger.info('Sent reply-all', {
    originalMessageId: messageId,
    messageId: sentMessageId,
    toCount: filteredTo.length,
    ccCount: filteredCc.length,
  });

  return {
    messageId: sentMessageId,
    threadId: sentThreadId || '',
    labelIds,
    message: 'Reply sent successfully',
  };
}
