/**
 * Gmail list operations - listMessages and listThreads
 */

import type { gmail_v1 } from 'googleapis';
import type { GmailContext } from '../types.js';
import type {
  ListMessagesOptions,
  ListMessagesResult,
  ListThreadsOptions,
  ListThreadsResult,
} from './types.js';

/**
 * List messages in the user's mailbox
 *
 * @param options List options including filters and pagination
 * @param context Gmail API context
 * @returns List of message summaries with pagination info
 *
 * @example
 * ```typescript
 * // List recent inbox messages
 * const result = await listMessages({
 *   maxResults: 10,
 *   labelIds: ['INBOX']
 * }, context);
 *
 * console.log(`Found ${result.resultSizeEstimate} messages`);
 * ```
 */
export async function listMessages(
  options: ListMessagesOptions,
  context: GmailContext
): Promise<ListMessagesResult> {
  const {
    maxResults = 10,
    pageToken,
    labelIds,
    includeSpamTrash = false,
  } = options;

  // Check cache first
  const cacheKey = `gmail:listMessages:${JSON.stringify(options)}`;
  const cached = await context.cacheManager.get(cacheKey);
  if (cached) {
    context.performanceMonitor.track('gmail:listMessages', Date.now() - context.startTime);
    return cached as ListMessagesResult;
  }

  // Build params object - only include properties that have values
  // This is required because of exactOptionalPropertyTypes in tsconfig
  const params: gmail_v1.Params$Resource$Users$Messages$List = {
    userId: 'me',
    maxResults: Math.min(maxResults, 500), // Gmail API limit
    includeSpamTrash,
  };

  if (pageToken) {
    params.pageToken = pageToken;
  }

  if (labelIds && labelIds.length > 0) {
    params.labelIds = labelIds;
  }

  const response = await context.gmail.users.messages.list(params);

  const result: ListMessagesResult = {
    messages: (response.data.messages || []).map((msg: gmail_v1.Schema$Message) => ({
      id: msg.id!,
      threadId: msg.threadId!,
    })),
    resultSizeEstimate: response.data.resultSizeEstimate || 0,
  };

  // Only add nextPageToken if it exists (exactOptionalPropertyTypes compliance)
  if (response.data.nextPageToken) {
    result.nextPageToken = response.data.nextPageToken;
  }

  // Cache the result
  await context.cacheManager.set(cacheKey, result);
  context.performanceMonitor.track('gmail:listMessages', Date.now() - context.startTime);
  context.logger.info('Listed messages', {
    count: result.messages.length,
    hasMore: !!result.nextPageToken,
  });

  return result;
}

/**
 * List threads in the user's mailbox
 *
 * @param options List options including filters and pagination
 * @param context Gmail API context
 * @returns List of thread summaries with pagination info
 *
 * @example
 * ```typescript
 * // List recent inbox threads
 * const result = await listThreads({
 *   maxResults: 10,
 *   labelIds: ['INBOX']
 * }, context);
 *
 * console.log(`Found ${result.threads.length} threads`);
 * ```
 */
export async function listThreads(
  options: ListThreadsOptions,
  context: GmailContext
): Promise<ListThreadsResult> {
  const {
    maxResults = 10,
    pageToken,
    labelIds,
    includeSpamTrash = false,
  } = options;

  // Check cache first
  const cacheKey = `gmail:listThreads:${JSON.stringify(options)}`;
  const cached = await context.cacheManager.get(cacheKey);
  if (cached) {
    context.performanceMonitor.track('gmail:listThreads', Date.now() - context.startTime);
    return cached as ListThreadsResult;
  }

  // Build params object - only include properties that have values
  // This is required because of exactOptionalPropertyTypes in tsconfig
  const params: gmail_v1.Params$Resource$Users$Threads$List = {
    userId: 'me',
    maxResults: Math.min(maxResults, 500), // Gmail API limit
    includeSpamTrash,
  };

  if (pageToken) {
    params.pageToken = pageToken;
  }

  if (labelIds && labelIds.length > 0) {
    params.labelIds = labelIds;
  }

  const response = await context.gmail.users.threads.list(params);

  const result: ListThreadsResult = {
    threads: (response.data.threads || []).map((thread: gmail_v1.Schema$Thread) => ({
      id: thread.id!,
      snippet: thread.snippet || '',
      historyId: thread.historyId || '',
    })),
    resultSizeEstimate: response.data.resultSizeEstimate || 0,
  };

  // Only add nextPageToken if it exists (exactOptionalPropertyTypes compliance)
  if (response.data.nextPageToken) {
    result.nextPageToken = response.data.nextPageToken;
  }

  // Cache the result
  await context.cacheManager.set(cacheKey, result);
  context.performanceMonitor.track('gmail:listThreads', Date.now() - context.startTime);
  context.logger.info('Listed threads', {
    count: result.threads.length,
    hasMore: !!result.nextPageToken,
  });

  return result;
}
