/**
 * Gmail attachment operations - listAttachments, downloadAttachment, sendWithAttachments
 */

import type { gmail_v1 } from 'googleapis';
import type { GmailContext } from '../types.js';
import type {
  ListAttachmentsOptions,
  ListAttachmentsResult,
  AttachmentInfo,
  DownloadAttachmentOptions,
  DownloadAttachmentResult,
  SendWithAttachmentsOptions,
  SendWithAttachmentsResult,
} from './types.js';
import { buildMultipartMessage, encodeToBase64Url, validateAndSanitizeRecipients } from './utils.js';

/**
 * Recursively extract attachment metadata from a message part tree
 */
function extractAttachments(
  parts: gmail_v1.Schema$MessagePart[] | undefined,
  result: AttachmentInfo[]
): void {
  if (!parts) {return;}

  for (const part of parts) {
    // A part is an attachment if it has an attachmentId and a filename
    if (part.body?.attachmentId && part.filename && part.filename.length > 0) {
      result.push({
        attachmentId: part.body.attachmentId,
        filename: part.filename,
        mimeType: part.mimeType || 'application/octet-stream',
        size: part.body.size || 0,
      });
    }

    // Recurse into nested parts
    if (part.parts) {
      extractAttachments(part.parts, result);
    }
  }
}

/**
 * List all attachments for a given message.
 *
 * Returns attachment metadata (filename, mimeType, size, attachmentId).
 * Use downloadAttachment() to retrieve the actual file content.
 *
 * @param options Message ID to list attachments for
 * @param context Gmail API context
 * @returns List of attachment metadata
 *
 * @example
 * ```typescript
 * const result = await listAttachments({ messageId: '18c123abc' }, context);
 *
 * result.attachments.forEach(att => {
 *   console.log(`${att.filename} (${att.size} bytes)`);
 * });
 * ```
 */
export async function listAttachments(
  options: ListAttachmentsOptions,
  context: GmailContext
): Promise<ListAttachmentsResult> {
  const { messageId } = options;

  const response = await context.gmail.users.messages.get({
    userId: 'me',
    id: messageId,
    format: 'full',
  });

  const payload = response.data.payload;
  const attachments: AttachmentInfo[] = [];

  if (payload) {
    // Check top-level body (for simple non-multipart messages)
    if (payload.body?.attachmentId && payload.filename && payload.filename.length > 0) {
      attachments.push({
        attachmentId: payload.body.attachmentId,
        filename: payload.filename,
        mimeType: payload.mimeType || 'application/octet-stream',
        size: payload.body.size || 0,
      });
    }

    // Recursively check parts
    extractAttachments(payload.parts, attachments);
  }

  context.performanceMonitor.track('gmail:listAttachments', Date.now() - context.startTime);
  context.logger.info('Listed attachments', {
    messageId,
    count: attachments.length,
  });

  return {
    messageId,
    attachments,
  };
}

/**
 * Download a specific attachment from a message.
 *
 * Returns the attachment content as base64-encoded data along with metadata.
 *
 * @param options Message ID and attachment ID to download
 * @param context Gmail API context
 * @returns Attachment data and metadata
 *
 * @example
 * ```typescript
 * const att = await downloadAttachment({
 *   messageId: '18c123abc',
 *   attachmentId: 'ANGjdJ...',
 * }, context);
 *
 * // Write to file: Buffer.from(att.data, 'base64').toString()
 * console.log(`Downloaded: ${att.filename} (${att.size} bytes)`);
 * ```
 */
export async function downloadAttachment(
  options: DownloadAttachmentOptions,
  context: GmailContext
): Promise<DownloadAttachmentResult> {
  const { messageId, attachmentId } = options;

  // First get the message to find the attachment metadata (filename, mimeType)
  const messageResponse = await context.gmail.users.messages.get({
    userId: 'me',
    id: messageId,
    format: 'full',
  });

  // Find the attachment part to get its metadata
  const allAttachments: AttachmentInfo[] = [];
  if (messageResponse.data.payload) {
    const payload = messageResponse.data.payload;
    if (payload.body?.attachmentId && payload.filename) {
      allAttachments.push({
        attachmentId: payload.body.attachmentId,
        filename: payload.filename,
        mimeType: payload.mimeType || 'application/octet-stream',
        size: payload.body.size || 0,
      });
    }
    extractAttachments(payload.parts, allAttachments);
  }

  const attachmentMeta = allAttachments.find(a => a.attachmentId === attachmentId);

  // Download the attachment content
  const response = await context.gmail.users.messages.attachments.get({
    userId: 'me',
    messageId,
    id: attachmentId,
  });

  const data = response.data.data || '';
  const size = response.data.size || 0;

  context.performanceMonitor.track('gmail:downloadAttachment', Date.now() - context.startTime);
  context.logger.info('Downloaded attachment', {
    messageId,
    attachmentId,
    size,
  });

  return {
    messageId,
    attachmentId,
    filename: attachmentMeta?.filename || '',
    mimeType: attachmentMeta?.mimeType || 'application/octet-stream',
    size,
    data,
  };
}

/**
 * Send a message with file attachments using multipart/mixed MIME encoding.
 *
 * @param options Message content, recipients, and attachments
 * @param context Gmail API context
 * @returns Sent message info
 *
 * @example
 * ```typescript
 * const result = await sendWithAttachments({
 *   to: ['recipient@example.com'],
 *   subject: 'Here is the report',
 *   body: 'Please find the report attached.',
 *   attachments: [{
 *     filename: 'report.pdf',
 *     mimeType: 'application/pdf',
 *     data: pdfBase64String,
 *   }],
 * }, context);
 * ```
 */
export async function sendWithAttachments(
  options: SendWithAttachmentsOptions,
  context: GmailContext
): Promise<SendWithAttachmentsResult> {
  const { to, cc, bcc, subject, body, isHtml, from, attachments } = options;

  // Validate recipients (throws if any invalid)
  validateAndSanitizeRecipients(to, 'to');
  if (cc && cc.length > 0) {validateAndSanitizeRecipients(cc, 'cc');}
  if (bcc && bcc.length > 0) {validateAndSanitizeRecipients(bcc, 'bcc');}

  // Build params without passing undefined to optional fields (exactOptionalPropertyTypes)
  const messageParams: Parameters<typeof buildMultipartMessage>[0] = {
    to,
    subject,
    body,
    attachments: attachments || [],
  };
  if (cc && cc.length > 0) {messageParams.cc = cc;}
  if (bcc && bcc.length > 0) {messageParams.bcc = bcc;}
  if (isHtml !== undefined) {messageParams.isHtml = isHtml;}
  if (from) {messageParams.from = from;}

  // Build the multipart MIME message
  const emailMessage = buildMultipartMessage(messageParams);

  const encodedMessage = encodeToBase64Url(emailMessage);

  const response = await context.gmail.users.messages.send({
    userId: 'me',
    requestBody: {
      raw: encodedMessage,
    },
  });

  const messageId = response.data.id;
  const threadId = response.data.threadId;
  const labelIds = response.data.labelIds || [];

  if (!messageId) {
    throw new Error('Failed to send message with attachments - no message ID returned');
  }

  await context.cacheManager.invalidate('gmail:list');
  await context.cacheManager.invalidate('gmail:search');

  context.performanceMonitor.track('gmail:sendWithAttachments', Date.now() - context.startTime);
  context.logger.info('Sent message with attachments', {
    messageId,
    to,
    subject,
    attachmentCount: attachments?.length || 0,
  });

  return {
    messageId,
    threadId: threadId || '',
    labelIds,
    message: 'Message sent successfully',
  };
}
