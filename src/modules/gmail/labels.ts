/**
 * Gmail label operations - listLabels, createLabel, and modifyLabels
 */

import type { gmail_v1 } from 'googleapis';
import type { GmailContext } from '../types.js';
import type {
  ListLabelsOptions,
  ListLabelsResult,
  LabelInfo,
  CreateLabelOptions,
  CreateLabelResult,
  ModifyLabelsOptions,
  ModifyLabelsResult,
} from './types.js';

function toLabelInfo(label: gmail_v1.Schema$Label): LabelInfo | null {
  if (!label.id || !label.name) {
    return null;
  }

  const info: LabelInfo = {
    id: label.id,
    name: label.name,
    type: label.type === 'system' ? 'system' : 'user',
  };

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
}

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

  const labels: LabelInfo[] = (response.data.labels ?? [])
    .map(toLabelInfo)
    .filter((info): info is LabelInfo => info !== null);

  const result: ListLabelsResult = { labels };

  // Cache the result
  await context.cacheManager.set(cacheKey, result);
  context.performanceMonitor.track('gmail:listLabels', Date.now() - context.startTime);
  context.logger.info('Listed labels', { count: labels.length });

  return result;
}

/**
 * Create a user Gmail label.
 *
 * @param options Label name, visibility, and optional colors
 * @param context Gmail API context
 * @returns Created label details
 *
 * @example
 * ```typescript
 * const label = await createLabel({ name: 'Follow Up' }, context);
 * console.log(label.id);
 * ```
 */
export async function createLabel(
  options: CreateLabelOptions,
  context: GmailContext
): Promise<CreateLabelResult> {
  const { name, messageListVisibility, labelListVisibility, color } = options;

  if (!name || name.trim().length === 0) {
    throw new Error('createLabel requires a non-empty name');
  }

  const requestBody: gmail_v1.Schema$Label = { name: name.trim() };
  if (messageListVisibility) {
    requestBody.messageListVisibility = messageListVisibility;
  }
  if (labelListVisibility) {
    requestBody.labelListVisibility = labelListVisibility;
  }
  if (color) {
    requestBody.color = color;
  }

  const response = await context.gmail.users.labels.create({
    userId: 'me',
    requestBody,
  });

  const labelInfo = toLabelInfo(response.data);
  if (!labelInfo) {
    throw new Error('Gmail created a label without an id or name');
  }

  await context.cacheManager.invalidate('gmail:listLabels');
  context.performanceMonitor.track('gmail:createLabel', Date.now() - context.startTime);
  context.logger.info('Created label', { id: labelInfo.id, name: labelInfo.name });

  return {
    ...labelInfo,
    message: 'Label created successfully',
  };
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
 *   messageId: '18c123abc',
 *   removeLabelIds: ['UNREAD', 'INBOX'],
 * }, context);
 *
 * // Add a custom label
 * const result2 = await modifyLabels({
 *   messageId: '18c123abc',
 *   addLabelIds: ['Label_12345'],
 * }, context);
 * ```
 */
export async function modifyLabels(
  options: ModifyLabelsOptions,
  context: GmailContext
): Promise<ModifyLabelsResult> {
  const { addLabelIds, removeLabelIds } = options;
  const messageId = options.messageId ?? options.id;
  if (!messageId) {
    throw new Error('modifyLabels requires messageId');
  }

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
    id: messageId,
    requestBody,
  });

  const labelIds = response.data.labelIds ?? [];

  // Invalidate cached message data
  await context.cacheManager.invalidate(`gmail:getMessage:${messageId}`);
  await context.cacheManager.invalidate('gmail:list');

  context.performanceMonitor.track('gmail:modifyLabels', Date.now() - context.startTime);
  context.logger.info('Modified labels', {
    id: messageId,
    messageId,
    added: addLabelIds?.length ?? 0,
    removed: removeLabelIds?.length ?? 0,
  });

  return {
    id: messageId,
    messageId,
    labelIds,
    message: 'Labels modified successfully',
  };
}
