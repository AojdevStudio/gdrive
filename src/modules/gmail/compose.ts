/**
 * Gmail compose operations - createDraft, updateDraft
 */

import type { GmailContext } from '../types.js';
import type {
  CreateDraftOptions,
  CreateDraftResult,
  UpdateDraftOptions,
  UpdateDraftResult,
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

/**
 * Update an existing draft email
 *
 * This replaces the entire draft content. Any fields not provided will be
 * fetched from the existing draft to preserve them.
 *
 * @param options Draft ID and updated content
 * @param context Gmail API context
 * @returns Updated draft info
 *
 * @example
 * ```typescript
 * // Update just the subject
 * const draft = await updateDraft({
 *   draftId: 'r1234567890',
 *   subject: 'Updated: Meeting tomorrow',
 * }, context);
 *
 * // Replace entire draft content
 * const draft = await updateDraft({
 *   draftId: 'r1234567890',
 *   to: ['new-recipient@example.com'],
 *   subject: 'New subject',
 *   body: 'New body content',
 * }, context);
 * ```
 */
export async function updateDraft(
  options: UpdateDraftOptions,
  context: GmailContext
): Promise<UpdateDraftResult> {
  const { draftId } = options;

  // First, get the existing draft to preserve fields that aren't being updated
  const existingDraft = await context.gmail.users.drafts.get({
    userId: 'me',
    id: draftId,
    format: 'full',
  });

  if (!existingDraft.data.message) {
    throw new Error(`Draft ${draftId} not found or has no message content`);
  }

  // Parse existing headers
  const existingHeaders: Record<string, string> = {};
  const headers = existingDraft.data.message.payload?.headers || [];
  for (const header of headers) {
    if (header.name && header.value) {
      existingHeaders[header.name.toLowerCase()] = header.value;
    }
  }

  // Extract existing body (plain text preferred, fall back to html)
  let existingBody = '';
  const payload = existingDraft.data.message.payload;
  if (payload) {
    if (payload.body?.data) {
      existingBody = Buffer.from(payload.body.data, 'base64').toString('utf-8');
    } else if (payload.parts) {
      for (const part of payload.parts) {
        if (part.mimeType === 'text/plain' && part.body?.data) {
          existingBody = Buffer.from(part.body.data, 'base64').toString('utf-8');
          break;
        } else if (part.mimeType === 'text/html' && part.body?.data) {
          existingBody = Buffer.from(part.body.data, 'base64').toString('utf-8');
        }
      }
    }
  }

  // Helper to get existing emails as array or undefined
  const parseExistingEmails = (header: string | undefined): string[] | undefined => {
    if (!header) {
      return undefined;
    }
    const emails = header.split(',').map(s => s.trim()).filter(Boolean);
    return emails.length > 0 ? emails : undefined;
  };

  // Merge existing values with updates
  const mergedOptions: CreateDraftOptions = {
    to: options.to || parseExistingEmails(existingHeaders['to']) || [],
    subject: options.subject ?? existingHeaders['subject'] ?? '',
    body: options.body ?? existingBody,
  };

  // Only add optional fields if they have values
  const ccEmails = options.cc || parseExistingEmails(existingHeaders['cc']);
  if (ccEmails && ccEmails.length > 0) {
    mergedOptions.cc = ccEmails;
  }

  const bccEmails = options.bcc || parseExistingEmails(existingHeaders['bcc']);
  if (bccEmails && bccEmails.length > 0) {
    mergedOptions.bcc = bccEmails;
  }

  if (options.isHtml !== undefined) {
    mergedOptions.isHtml = options.isHtml;
  }

  const fromValue = options.from || existingHeaders['from'];
  if (fromValue) {
    mergedOptions.from = fromValue;
  }

  const inReplyToValue = options.inReplyTo || existingHeaders['in-reply-to'];
  if (inReplyToValue) {
    mergedOptions.inReplyTo = inReplyToValue;
  }

  const referencesValue = options.references || existingHeaders['references'];
  if (referencesValue) {
    mergedOptions.references = referencesValue;
  }

  // Build the new email message
  const emailMessage = buildEmailMessage(mergedOptions);

  // Convert to base64url encoding
  const encodedMessage = Buffer.from(emailMessage)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  // Update the draft
  const response = await context.gmail.users.drafts.update({
    userId: 'me',
    id: draftId,
    requestBody: {
      message: {
        raw: encodedMessage,
      },
    },
  });

  const updatedDraftId = response.data.id;
  const messageId = response.data.message?.id;
  const threadId = response.data.message?.threadId;

  if (!updatedDraftId || !messageId) {
    throw new Error('Failed to update draft - no draft ID returned');
  }

  // Invalidate any cached draft/message lists
  await context.cacheManager.invalidate('gmail:list');
  await context.cacheManager.invalidate(`gmail:draft:${draftId}`);

  context.performanceMonitor.track('gmail:updateDraft', Date.now() - context.startTime);
  context.logger.info('Updated draft', { draftId: updatedDraftId, subject: mergedOptions.subject });

  return {
    draftId: updatedDraftId,
    messageId,
    threadId: threadId || '',
    message: 'Draft updated successfully',
  };
}
