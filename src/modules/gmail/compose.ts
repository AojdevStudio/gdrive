/**
 * Gmail compose operations - createDraft
 */

import type { GmailContext } from '../types.js';
import type {
  CreateDraftOptions,
  CreateDraftResult,
} from './types.js';

/**
 * Build an RFC 2822 formatted email message
 */
function buildEmailMessage(options: CreateDraftOptions): string {
  const { to, cc, bcc, subject, body, isHtml = false, from, inReplyTo, references } = options;

  const lines: string[] = [];

  // Add headers
  if (from) {
    lines.push(`From: ${from}`);
  }
  lines.push(`To: ${to.join(', ')}`);
  if (cc && cc.length > 0) {
    lines.push(`Cc: ${cc.join(', ')}`);
  }
  if (bcc && bcc.length > 0) {
    lines.push(`Bcc: ${bcc.join(', ')}`);
  }
  lines.push(`Subject: ${subject}`);
  if (inReplyTo) {
    lines.push(`In-Reply-To: ${inReplyTo}`);
  }
  if (references) {
    lines.push(`References: ${references}`);
  }
  lines.push('MIME-Version: 1.0');
  lines.push(`Content-Type: ${isHtml ? 'text/html' : 'text/plain'}; charset="UTF-8"`);
  lines.push(''); // Empty line between headers and body
  lines.push(body);

  return lines.join('\r\n');
}

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
  const encodedMessage = Buffer.from(emailMessage)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

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
