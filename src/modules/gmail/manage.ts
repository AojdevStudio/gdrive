/**
 * Gmail message management operations
 * trashMessage, untrashMessage, deleteMessage, markAsRead, markAsUnread, archiveMessage
 */

import type { gmail_v1 } from 'googleapis';
import type { GmailContext } from '../types.js';
import type {
  TrashMessageOptions,
  TrashMessageResult,
  UntrashMessageOptions,
  UntrashMessageResult,
  DeleteMessageOptions,
  DeleteMessageResult,
  MarkAsReadOptions,
  MarkAsReadResult,
  MarkAsUnreadOptions,
  MarkAsUnreadResult,
  ArchiveMessageOptions,
  ArchiveMessageResult,
} from './types.js';

/**
 * Move a message to the trash.
 *
 * The message can be recovered with untrashMessage().
 * Use deleteMessage() for permanent deletion.
 *
 * @param options Message ID to trash
 * @param context Gmail API context
 * @returns Updated message info with TRASH label
 *
 * @example
 * ```typescript
 * const result = await trashMessage({ id: '18c123abc' }, context);
 * console.log(result.message); // 'Message moved to trash'
 * ```
 */
export async function trashMessage(
  options: TrashMessageOptions,
  context: GmailContext
): Promise<TrashMessageResult> {
  const { id } = options;

  const response = await context.gmail.users.messages.trash({
    userId: 'me',
    id,
  });

  const labelIds = response.data.labelIds || [];

  await context.cacheManager.invalidate(`gmail:getMessage:${id}`);
  await context.cacheManager.invalidate('gmail:list');

  context.performanceMonitor.track('gmail:trashMessage', Date.now() - context.startTime);
  context.logger.info('Trashed message', { id });

  return {
    id,
    labelIds,
    message: 'Message moved to trash',
  };
}

/**
 * Restore a message from the trash.
 *
 * @param options Message ID to restore
 * @param context Gmail API context
 * @returns Updated message info
 *
 * @example
 * ```typescript
 * const result = await untrashMessage({ id: '18c123abc' }, context);
 * console.log(result.message); // 'Message restored from trash'
 * ```
 */
export async function untrashMessage(
  options: UntrashMessageOptions,
  context: GmailContext
): Promise<UntrashMessageResult> {
  const { id } = options;

  const response = await context.gmail.users.messages.untrash({
    userId: 'me',
    id,
  });

  const labelIds = response.data.labelIds || [];

  await context.cacheManager.invalidate(`gmail:getMessage:${id}`);
  await context.cacheManager.invalidate('gmail:list');

  context.performanceMonitor.track('gmail:untrashMessage', Date.now() - context.startTime);
  context.logger.info('Untrashed message', { id });

  return {
    id,
    labelIds,
    message: 'Message restored from trash',
  };
}

/**
 * Permanently and irrecoverably delete a message.
 *
 * This operation CANNOT be undone. The safetyAcknowledged parameter must be
 * set to true to confirm the caller understands the message cannot be recovered.
 * Use trashMessage() instead if recovery might be needed.
 *
 * @param options Message ID and required safety acknowledgment
 * @param context Gmail API context
 * @returns Deletion confirmation
 *
 * @example
 * ```typescript
 * const result = await deleteMessage({
 *   id: '18c123abc',
 *   safetyAcknowledged: true,
 * }, context);
 * ```
 */
export async function deleteMessage(
  options: DeleteMessageOptions,
  context: GmailContext
): Promise<DeleteMessageResult> {
  const { id, safetyAcknowledged } = options;

  if (!safetyAcknowledged) {
    throw new Error(
      'deleteMessage requires safetyAcknowledged: true. ' +
      'This operation permanently deletes the message and cannot be undone. ' +
      'Use trashMessage() if you want a recoverable deletion.'
    );
  }

  await context.gmail.users.messages.delete({
    userId: 'me',
    id,
  });

  await context.cacheManager.invalidate(`gmail:getMessage:${id}`);
  await context.cacheManager.invalidate('gmail:list');

  context.performanceMonitor.track('gmail:deleteMessage', Date.now() - context.startTime);
  context.logger.info('Permanently deleted message', { id });

  return {
    id,
    message: `Message ${id} permanently deleted`,
  };
}

/**
 * Mark a message as read by removing the UNREAD label.
 *
 * @param options Message ID to mark as read
 * @param context Gmail API context
 * @returns Updated message info
 *
 * @example
 * ```typescript
 * await markAsRead({ id: '18c123abc' }, context);
 * ```
 */
export async function markAsRead(
  options: MarkAsReadOptions,
  context: GmailContext
): Promise<MarkAsReadResult> {
  const { id } = options;

  const requestBody: gmail_v1.Schema$ModifyMessageRequest = {
    removeLabelIds: ['UNREAD'],
  };

  const response = await context.gmail.users.messages.modify({
    userId: 'me',
    id,
    requestBody,
  });

  const labelIds = response.data.labelIds || [];

  await context.cacheManager.invalidate(`gmail:getMessage:${id}`);
  await context.cacheManager.invalidate('gmail:list');

  context.performanceMonitor.track('gmail:markAsRead', Date.now() - context.startTime);
  context.logger.info('Marked message as read', { id });

  return {
    id,
    labelIds,
    message: 'Message marked as read',
  };
}

/**
 * Mark a message as unread by adding the UNREAD label.
 *
 * @param options Message ID to mark as unread
 * @param context Gmail API context
 * @returns Updated message info
 *
 * @example
 * ```typescript
 * await markAsUnread({ id: '18c123abc' }, context);
 * ```
 */
export async function markAsUnread(
  options: MarkAsUnreadOptions,
  context: GmailContext
): Promise<MarkAsUnreadResult> {
  const { id } = options;

  const requestBody: gmail_v1.Schema$ModifyMessageRequest = {
    addLabelIds: ['UNREAD'],
  };

  const response = await context.gmail.users.messages.modify({
    userId: 'me',
    id,
    requestBody,
  });

  const labelIds = response.data.labelIds || [];

  await context.cacheManager.invalidate(`gmail:getMessage:${id}`);
  await context.cacheManager.invalidate('gmail:list');

  context.performanceMonitor.track('gmail:markAsUnread', Date.now() - context.startTime);
  context.logger.info('Marked message as unread', { id });

  return {
    id,
    labelIds,
    message: 'Message marked as unread',
  };
}

/**
 * Archive a message by removing the INBOX label.
 *
 * The message remains searchable but is removed from the inbox view.
 *
 * @param options Message ID to archive
 * @param context Gmail API context
 * @returns Updated message info
 *
 * @example
 * ```typescript
 * await archiveMessage({ id: '18c123abc' }, context);
 * ```
 */
export async function archiveMessage(
  options: ArchiveMessageOptions,
  context: GmailContext
): Promise<ArchiveMessageResult> {
  const { id } = options;

  const requestBody: gmail_v1.Schema$ModifyMessageRequest = {
    removeLabelIds: ['INBOX'],
  };

  const response = await context.gmail.users.messages.modify({
    userId: 'me',
    id,
    requestBody,
  });

  const labelIds = response.data.labelIds || [];

  await context.cacheManager.invalidate(`gmail:getMessage:${id}`);
  await context.cacheManager.invalidate('gmail:list');

  context.performanceMonitor.track('gmail:archiveMessage', Date.now() - context.startTime);
  context.logger.info('Archived message', { id });

  return {
    id,
    labelIds,
    message: 'Message archived',
  };
}
