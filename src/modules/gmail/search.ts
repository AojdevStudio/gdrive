/**
 * Gmail search operations - searchMessages
 */

import type { gmail_v1 } from 'googleapis';
import type { GmailContext } from '../types.js';
import type {
  SearchMessagesOptions,
  SearchMessagesResult,
} from './types.js';

/**
 * Search messages using Gmail query syntax
 *
 * @param options Search options including query and pagination
 * @param context Gmail API context
 * @returns List of matching message summaries
 *
 * @example
 * ```typescript
 * // Search for unread emails from a specific sender
 * const result = await searchMessages({
 *   query: 'from:boss@company.com is:unread',
 *   maxResults: 20
 * }, context);
 *
 * console.log(`Found ${result.resultSizeEstimate} messages`);
 * ```
 *
 * @remarks
 * Gmail query syntax supports:
 * - `from:user@example.com` - Filter by sender
 * - `to:me` - Messages sent to you
 * - `subject:meeting` - Search subjects
 * - `has:attachment` - Messages with attachments
 * - `after:2025/01/01` - Date filtering
 * - `is:unread` - Unread messages
 * - `label:inbox` - Label filtering
 * - Combine with spaces for AND, OR for OR
 */
export async function searchMessages(
  options: SearchMessagesOptions,
  context: GmailContext
): Promise<SearchMessagesResult> {
  const {
    query,
    maxResults = 10,
    pageToken,
    includeSpamTrash = false,
  } = options;

  // Check cache first
  const cacheKey = `gmail:searchMessages:${JSON.stringify(options)}`;
  const cached = await context.cacheManager.get(cacheKey);
  if (cached) {
    context.performanceMonitor.track('gmail:searchMessages', Date.now() - context.startTime);
    return cached as SearchMessagesResult;
  }

  // Build params - only include properties with values
  const params: gmail_v1.Params$Resource$Users$Messages$List = {
    userId: 'me',
    q: query,
    maxResults: Math.min(maxResults, 500), // Gmail API limit
    includeSpamTrash,
  };

  if (pageToken) {
    params.pageToken = pageToken;
  }

  const response = await context.gmail.users.messages.list(params);

  const result: SearchMessagesResult = {
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
  context.performanceMonitor.track('gmail:searchMessages', Date.now() - context.startTime);
  context.logger.info('Searched messages', {
    query,
    count: result.messages.length,
    hasMore: !!result.nextPageToken,
  });

  return result;
}
