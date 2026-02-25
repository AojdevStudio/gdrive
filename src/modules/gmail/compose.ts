/**
 * Gmail compose operations - createDraft
 */

import type { GmailContext } from '../types.js';
import type {
  CreateDraftOptions,
  CreateDraftResult,
} from './types.js';
import { buildEmailMessage, encodeToBase64Url } from './utils.js';

/**
 * Create a draft email
 *
 * @param options Draft content and recipients
 * @param context Gmail API context
 * @returns Created draft info
 *
 * @example
 * ```typescript
 * const draft = await createDraft({
 *   to: ['recipient@example.com'],
 *   subject: 'Meeting tomorrow',
 *   body: 'Hi, let me know if 2pm works for you.',
 * }, context);
 *
 * console.log(`Draft created: ${draft.draftId}`);
 * ```
 */
export async function createDraft(
  options: CreateDraftOptions,
  context: GmailContext
): Promise<CreateDraftResult> {
  const emailMessage = buildEmailMessage(options);

  // Convert to base64url encoding (Gmail's format)
  const encodedMessage = encodeToBase64Url(emailMessage);

  const response = await context.gmail.users.drafts.create({
    userId: 'me',
    requestBody: {
      message: {
        raw: encodedMessage,
      },
    },
  });

  const draftId = response.data.id;
  const messageId = response.data.message?.id;
  const threadId = response.data.message?.threadId;

  if (!draftId || !messageId) {
    throw new Error('Failed to create draft - no draft ID returned');
  }

  // Invalidate any cached draft/message lists
  await context.cacheManager.invalidate('gmail:list');

  context.performanceMonitor.track('gmail:createDraft', Date.now() - context.startTime);
  context.logger.info('Created draft', { draftId, subject: options.subject });

  return {
    draftId,
    messageId,
    threadId: threadId || '',
    message: 'Draft created successfully',
  };
}
