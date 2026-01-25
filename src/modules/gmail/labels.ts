/**
 * Gmail label operations - listLabels and modifyLabels
 */

import type { gmail_v1 } from 'googleapis';
import type { GmailContext } from '../types.js';
import type {
  ListLabelsOptions,
  ListLabelsResult,
  LabelInfo,
  ModifyLabelsOptions,
  ModifyLabelsResult,
} from './types.js';

/**
 * List all labels in the user's mailbox
 *
 * @param _options Options (currently unused, for API consistency)
 * @param context Gmail API context
 * @returns List of all labels
 *
 * @example
 * ```typescript
 * const result = await listLabels({}, context);
 *
 * console.log(`Found ${result.labels.length} labels`);
 * result.labels.forEach(label => {
 *   console.log(`- ${label.name} (${label.type})`);
 * });
 * ```
 */
export async function listLabels(
  _options: ListLabelsOptions,
  context: GmailContext
): Promise<ListLabelsResult> {
  // Check cache first
  const cacheKey = 'gmail:listLabels';
  const cached = await context.cacheManager.get(cacheKey);
  if (cached) {
    context.performanceMonitor.track('gmail:listLabels', Date.now() - context.startTime);
    return cached as ListLabelsResult;
  }

  const response = await context.gmail.users.labels.list({
    userId: 'me',
  });

  const labels: LabelInfo[] = (response.data.labels || []).map((label: gmail_v1.Schema$Label) => {
    const info: LabelInfo = {
      id: label.id!,
      name: label.name!,
      type: label.type === 'system' ? 'system' : 'user',
    };

    // Add optional properties only if they exist (exactOptionalPropertyTypes compliance)
    if (label.messageListVisibility) {
      info.messageListVisibility = label.messageListVisibility as 'show' | 'hide';
    }
    if (label.labelListVisibility) {
      info.labelListVisibility = label.labelListVisibility as 'labelShow' | 'labelShowIfUnread' | 'labelHide';
    }
    if (label.messagesTotal !== undefined && label.messagesTotal !== null) {
      info.messagesTotal = label.messagesTotal;
    }
    if (label.messagesUnread !== undefined && label.messagesUnread !== null) {
      info.messagesUnread = label.messagesUnread;
    }
    if (label.threadsTotal !== undefined && label.threadsTotal !== null) {
      info.threadsTotal = label.threadsTotal;
    }
    if (label.threadsUnread !== undefined && label.threadsUnread !== null) {
      info.threadsUnread = label.threadsUnread;
    }
    if (label.color) {
      const colorInfo: { textColor?: string; backgroundColor?: string } = {};
      if (label.color.textColor) {
        colorInfo.textColor = label.color.textColor;
      }
      if (label.color.backgroundColor) {
        colorInfo.backgroundColor = label.color.backgroundColor;
      }
      if (Object.keys(colorInfo).length > 0) {
        info.color = colorInfo;
      }
    }

    return info;
  });

  const result: ListLabelsResult = { labels };

  // Cache the result
  await context.cacheManager.set(cacheKey, result);
  context.performanceMonitor.track('gmail:listLabels', Date.now() - context.startTime);
  context.logger.info('Listed labels', { count: labels.length });

  return result;
}

/**
 * Modify labels on a message (add or remove)
 *
 * @param options Message ID and label changes
 * @param context Gmail API context
 * @returns Updated label IDs
 *
 * @example
 * ```typescript
 * // Mark as read and archive
 * const result = await modifyLabels({
 *   id: '18c123abc',
 *   removeLabelIds: ['UNREAD', 'INBOX'],
 * }, context);
 *
 * // Add a custom label
 * const result2 = await modifyLabels({
 *   id: '18c123abc',
 *   addLabelIds: ['Label_12345'],
 * }, context);
 * ```
 */
export async function modifyLabels(
  options: ModifyLabelsOptions,
  context: GmailContext
): Promise<ModifyLabelsResult> {
  const { id, addLabelIds, removeLabelIds } = options;

  // Build the request body - only include arrays if they have items
  const requestBody: gmail_v1.Schema$ModifyMessageRequest = {};

  if (addLabelIds && addLabelIds.length > 0) {
    requestBody.addLabelIds = addLabelIds;
  }

  if (removeLabelIds && removeLabelIds.length > 0) {
    requestBody.removeLabelIds = removeLabelIds;
  }

  const response = await context.gmail.users.messages.modify({
    userId: 'me',
    id: id,
    requestBody,
  });

  const labelIds = response.data.labelIds || [];

  // Invalidate cached message data
  await context.cacheManager.invalidate(`gmail:getMessage:${id}`);
  await context.cacheManager.invalidate('gmail:list');

  context.performanceMonitor.track('gmail:modifyLabels', Date.now() - context.startTime);
  context.logger.info('Modified labels', {
    id,
    added: addLabelIds?.length || 0,
    removed: removeLabelIds?.length || 0,
  });

  return {
    id,
    labelIds,
    message: 'Labels modified successfully',
  };
}
