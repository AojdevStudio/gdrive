/**
 * Gmail send operations - sendMessage, sendDraft, sendFromTemplate, sendBatch
 */

import type { gmail_v1 } from 'googleapis';
import type { GmailContext } from '../types.js';
import type {
  SendMessageOptions,
  SendMessageResult,
  SendDraftOptions,
  SendDraftResult,
  SendFromTemplateOptions,
  SendFromTemplateResult,
  BatchSendOptions,
  BatchSendResult,
  BatchSendItemResult,
  BatchPreviewItem,
} from './types.js';
import { buildEmailMessage, encodeToBase64Url } from './utils.js';
import { renderTemplate } from './templates.js';

/**
 * Send a new email message
 *
 * @param options Message content and recipients
 * @param context Gmail API context
 * @returns Sent message info
 *
 * @example
 * ```typescript
 * // Send a simple email
 * const result = await sendMessage({
 *   to: ['recipient@example.com'],
 *   subject: 'Hello',
 *   body: 'This is a test message.',
 * }, context);
 *
 * console.log(`Message sent: ${result.messageId}`);
 *
 * // Send from an alias (send-as)
 * const result2 = await sendMessage({
 *   to: ['recipient@example.com'],
 *   from: 'myalias@example.com',
 *   subject: 'From alias',
 *   body: 'Sent from my alias email.',
 * }, context);
 * ```
 */
export async function sendMessage(
  options: SendMessageOptions,
  context: GmailContext
): Promise<SendMessageResult> {
  const emailMessage = buildEmailMessage(options);

  // Convert to base64url encoding (Gmail's format)
  const encodedMessage = encodeToBase64Url(emailMessage);

  // Build params - only include threadId if provided
  const params: gmail_v1.Params$Resource$Users$Messages$Send = {
    userId: 'me',
    requestBody: {
      raw: encodedMessage,
    },
  };

  // If replying to a thread, include the threadId
  if (options.threadId) {
    params.requestBody!.threadId = options.threadId;
  }

  const response = await context.gmail.users.messages.send(params);

  const messageId = response.data.id;
  const threadId = response.data.threadId;
  const labelIds = response.data.labelIds || [];

  if (!messageId) {
    throw new Error('Failed to send message - no message ID returned');
  }

  // Invalidate cached message/thread lists
  await context.cacheManager.invalidate('gmail:list');
  await context.cacheManager.invalidate('gmail:search');

  context.performanceMonitor.track('gmail:sendMessage', Date.now() - context.startTime);
  context.logger.info('Sent message', {
    messageId,
    to: options.to,
    subject: options.subject,
  });

  return {
    messageId,
    threadId: threadId || '',
    labelIds,
    message: 'Message sent successfully',
  };
}

/**
 * Send an existing draft
 *
 * @param options Draft ID to send
 * @param context Gmail API context
 * @returns Sent message info
 *
 * @example
 * ```typescript
 * const result = await sendDraft({
 *   draftId: 'r1234567890'
 * }, context);
 *
 * console.log(`Draft sent as message: ${result.messageId}`);
 * ```
 */
export async function sendDraft(
  options: SendDraftOptions,
  context: GmailContext
): Promise<SendDraftResult> {
  const { draftId } = options;

  const response = await context.gmail.users.drafts.send({
    userId: 'me',
    requestBody: {
      id: draftId,
    },
  });

  const messageId = response.data.id;
  const threadId = response.data.threadId;
  const labelIds = response.data.labelIds || [];

  if (!messageId) {
    throw new Error('Failed to send draft - no message ID returned');
  }

  // Invalidate cached lists
  await context.cacheManager.invalidate('gmail:list');
  await context.cacheManager.invalidate('gmail:search');

  context.performanceMonitor.track('gmail:sendDraft', Date.now() - context.startTime);
  context.logger.info('Sent draft', { draftId, messageId });

  return {
    messageId,
    threadId: threadId || '',
    labelIds,
    message: 'Draft sent successfully',
  };
}

/**
 * Simple delay helper — returns a promise that resolves after `ms` milliseconds.
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Render a template and send the resulting email.
 *
 * Renders {{variable}} placeholders in both the subject and template body,
 * then delegates to sendMessage() for the actual Gmail API call.
 *
 * @param options Template, variables, recipients
 * @param context Gmail API context
 * @returns Sent message info with `rendered: true`
 */
export async function sendFromTemplate(
  options: SendFromTemplateOptions,
  context: GmailContext
): Promise<SendFromTemplateResult> {
  const { to, subject, template, variables, isHtml = false } = options;

  // Render subject (never HTML-escaped — subjects are plain text headers)
  const renderedSubject = renderTemplate(subject, variables, false);

  // Render body (HTML-escaped when isHtml is true)
  const renderedBody = renderTemplate(template, variables, isHtml);

  // Build sendMessage options, only including optional fields when present
  const sendOpts: SendMessageOptions = {
    to,
    subject: renderedSubject,
    body: renderedBody,
    isHtml,
  };
  if (options.cc) sendOpts.cc = options.cc;
  if (options.bcc) sendOpts.bcc = options.bcc;
  if (options.from) sendOpts.from = options.from;

  const result = await sendMessage(sendOpts, context);

  return {
    messageId: result.messageId,
    threadId: result.threadId,
    rendered: true,
  };
}

/**
 * Send a templated email to multiple recipients with per-recipient variables.
 *
 * Iterates through recipients sequentially with an optional delay between sends
 * to respect Gmail API rate limits. Continues on individual send failure,
 * reporting per-recipient status in the results.
 *
 * When `dryRun: true`, returns rendered previews without sending any emails.
 *
 * @param options Template, recipients, throttle settings
 * @param context Gmail API context
 * @returns Batch result with sent/failed counts and per-recipient details
 */
export async function sendBatch(
  options: BatchSendOptions,
  context: GmailContext
): Promise<BatchSendResult> {
  const { subject, template, recipients, delayMs = 5000, isHtml = false, dryRun = false, from } = options;

  // Dry-run mode: render all previews without sending
  if (dryRun) {
    const previews: BatchPreviewItem[] = recipients.map(recipient => {
      const renderedSubject = renderTemplate(subject, recipient.variables, false);
      const renderedBody = renderTemplate(template, recipient.variables, isHtml);
      return {
        to: recipient.to,
        subject: renderedSubject,
        body: renderedBody,
        wouldSend: false as const,
      };
    });

    return {
      sent: 0,
      failed: 0,
      previews,
    };
  }

  // Live send mode: iterate recipients sequentially with throttling
  const results: BatchSendItemResult[] = [];
  let sent = 0;
  let failed = 0;

  for (let i = 0; i < recipients.length; i++) {
    const recipient = recipients[i]!;

    try {
      const renderedSubject = renderTemplate(subject, recipient.variables, false);
      const renderedBody = renderTemplate(template, recipient.variables, isHtml);

      const sendOpts: SendMessageOptions = {
        to: [recipient.to],
        subject: renderedSubject,
        body: renderedBody,
        isHtml,
      };
      if (from) sendOpts.from = from;

      const sendResult = await sendMessage(sendOpts, context);

      results.push({
        to: recipient.to,
        messageId: sendResult.messageId,
        threadId: sendResult.threadId,
        status: 'sent',
      });
      sent++;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      results.push({
        to: recipient.to,
        messageId: '',
        threadId: '',
        status: 'failed',
        error: errorMessage,
      });
      failed++;
      context.logger.error('Batch send failed for recipient', {
        to: recipient.to,
        error: errorMessage,
      });
    }

    // Delay between sends (skip after last recipient)
    if (delayMs > 0 && i < recipients.length - 1) {
      await delay(delayMs);
    }
  }

  return {
    sent,
    failed,
    results,
  };
}
