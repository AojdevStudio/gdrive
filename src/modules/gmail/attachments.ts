/**
 * Gmail attachment operations - getAttachment, listAttachments
 */

import type { GmailContext } from '../types.js';
import type {
  GetAttachmentOptions,
  GetAttachmentResult,
  ListAttachmentsOptions,
  ListAttachmentsResult,
  AttachmentInfo,
} from './types.js';

/**
 * Get attachment content from a message
 *
 * Downloads the raw attachment data as base64 encoded string.
 * Use this to retrieve file content for saving or processing.
 *
 * @param options Message and attachment IDs
 * @param context Gmail API context
 * @returns Base64 encoded attachment data and size
 *
 * @example
 * ```typescript
 * // First list attachments to get the attachment ID
 * const list = await listAttachments({ messageId: '18c123abc' }, context);
 *
 * // Then download the attachment
 * const attachment = await getAttachment({
 *   messageId: '18c123abc',
 *   attachmentId: list.attachments[0].attachmentId,
 * }, context);
 *
 * // Decode and save
 * const buffer = Buffer.from(attachment.data, 'base64');
 * fs.writeFileSync('document.pdf', buffer);
 * ```
 */
export async function getAttachment(
  options: GetAttachmentOptions,
  context: GmailContext
): Promise<GetAttachmentResult> {
  const { messageId, attachmentId } = options;

  const response = await context.gmail.users.messages.attachments.get({
    userId: 'me',
    messageId,
    id: attachmentId,
  });

  if (!response.data.data) {
    throw new Error(`Attachment ${attachmentId} not found in message ${messageId}`);
  }

  // Gmail returns base64url encoding, convert to standard base64
  const base64Data = response.data.data
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  context.performanceMonitor.track('gmail:getAttachment', Date.now() - context.startTime);
  context.logger.info('Retrieved attachment', {
    messageId,
    attachmentId,
    size: response.data.size,
  });

  return {
    data: base64Data,
    size: response.data.size || 0,
  };
}

/**
 * List attachments in a message
 *
 * Returns metadata about all attachments in a message without downloading
 * the actual content. Use getAttachment() to download individual attachments.
 *
 * @param options Message ID to list attachments from
 * @param context Gmail API context
 * @returns List of attachment metadata
 *
 * @example
 * ```typescript
 * const result = await listAttachments({ messageId: '18c123abc' }, context);
 *
 * for (const att of result.attachments) {
 *   console.log(`${att.filename} (${att.mimeType}) - ${att.size} bytes`);
 * }
 * ```
 */
export async function listAttachments(
  options: ListAttachmentsOptions,
  context: GmailContext
): Promise<ListAttachmentsResult> {
  const { messageId } = options;

  // Get the message with full payload to see parts
  const response = await context.gmail.users.messages.get({
    userId: 'me',
    id: messageId,
    format: 'full',
  });

  const attachments: AttachmentInfo[] = [];

  type MessagePart = NonNullable<NonNullable<typeof response.data.payload>['parts']>[number];

  // Recursively find attachments in message parts
  function findAttachments(parts: MessagePart[] | undefined): void {
    if (!parts) {
      return;
    }

    for (const part of parts) {
      // Check if this part is an attachment
      if (part.filename && part.filename.length > 0 && part.body?.attachmentId) {
        attachments.push({
          attachmentId: part.body.attachmentId,
          filename: part.filename,
          mimeType: part.mimeType || 'application/octet-stream',
          size: part.body.size || 0,
        });
      }

      // Recurse into nested parts (for multipart messages)
      if (part.parts) {
        findAttachments(part.parts);
      }
    }
  }

  // Check top-level body first
  if (response.data.payload?.body?.attachmentId && response.data.payload?.filename) {
    attachments.push({
      attachmentId: response.data.payload.body.attachmentId,
      filename: response.data.payload.filename,
      mimeType: response.data.payload.mimeType || 'application/octet-stream',
      size: response.data.payload.body.size || 0,
    });
  }

  // Then check all parts
  findAttachments(response.data.payload?.parts);

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
