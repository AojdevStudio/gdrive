/**
 * Gmail compose operations - createDraft, dryRunMessage
 */

import type { GmailContext } from '../types.js';
import type {
  CreateDraftOptions,
  CreateDraftResult,
  DryRunOptions,
  DryRunResult,
} from './types.js';
import { buildEmailMessage, encodeToBase64Url, validateAndSanitizeRecipients } from './utils.js';
import { renderTemplate } from './templates.js';

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

/**
 * Preview a rendered templated email without sending.
 * Pure function — does not call any APIs.
 *
 * Renders {{variable}} placeholders in both subject and template body,
 * validates recipient addresses, and returns the fully rendered email
 * for review before sending.
 *
 * @param options Template, variables, and recipients
 * @returns Rendered email preview with wouldSend: false
 */
export function dryRunMessage(options: DryRunOptions): DryRunResult {
  const { to, subject, template, variables, isHtml = false } = options;

  // Validate recipients (throws on invalid addresses)
  const sanitizedTo = validateAndSanitizeRecipients(to, 'to');

  // Render subject (never HTML-escaped — subjects are plain text headers)
  const renderedSubject = renderTemplate(subject, variables, false);

  // Render body (HTML-escaped when isHtml is true)
  const renderedBody = renderTemplate(template, variables, isHtml);

  return {
    to: sanitizedTo,
    subject: renderedSubject,
    body: renderedBody,
    isHtml,
    wouldSend: false,
  };
}
