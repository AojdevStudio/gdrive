/**
 * Gmail reply detection — find replies by thread IDs
 *
 * Composes existing getThread + getProfile to identify replies from
 * participants other than the authenticated user.
 */

import type { GmailContext } from '../types.js';

export interface DetectRepliesOptions {
  /** Array of Gmail thread IDs to check for replies */
  threadIds: string[];
}

interface ReplyInfo {
  messageId: string;
  from: string;
  date: string;
}

interface ThreadReplyResult {
  threadId: string;
  hasReply: boolean;
  replies: ReplyInfo[];
}

export interface DetectRepliesResult {
  threads: ThreadReplyResult[];
}

/**
 * Check threads for replies from external participants.
 * Filters out messages from the authenticated user (sender).
 *
 * @param options Thread IDs to check
 * @param context Gmail API context
 * @returns Per-thread reply data
 */
export async function detectReplies(
  options: DetectRepliesOptions,
  context: GmailContext
): Promise<DetectRepliesResult> {
  // Get authenticated user email
  const profile = await context.gmail.users.getProfile({ userId: 'me' });
  const myEmail = (profile.data.emailAddress || '').toLowerCase();

  const threads: ThreadReplyResult[] = [];

  for (const threadId of options.threadIds) {
    try {
      const threadData = await context.gmail.users.threads.get({
        userId: 'me',
        id: threadId,
        format: 'metadata',
        metadataHeaders: ['From'],
      });

      const messages = threadData.data.messages || [];
      const replies: ReplyInfo[] = [];

      for (const msg of messages) {
        const fromHeader = msg.payload?.headers?.find(
          (h) => h.name?.toLowerCase() === 'from'
        );
        const from = fromHeader?.value || '';
        const fromEmail = from.match(/<([^>]+)>/)?.[1] || from;

        if (fromEmail.toLowerCase() !== myEmail) {
          replies.push({
            messageId: msg.id || '',
            from,
            date: msg.internalDate
              ? new Date(Number(msg.internalDate)).toISOString()
              : '',
          });
        }
      }

      threads.push({ threadId, hasReply: replies.length > 0, replies });
    } catch (err) {
      context.logger.error('Failed to check thread for replies', { threadId, error: err });
      threads.push({ threadId, hasReply: false, replies: [] });
    }
  }

  context.performanceMonitor.track('gmail:detectReplies', Date.now() - context.startTime);
  return { threads };
}
