/**
 * Gmail draft management operations
 * listDrafts, getDraft, updateDraft, deleteDraft
 */

import type { gmail_v1 } from 'googleapis';
import type { GmailContext } from '../types.js';
import type {
  ListDraftsOptions,
  ListDraftsResult,
  GetDraftOptions,
  GetDraftResult,
  UpdateDraftOptions,
  UpdateDraftResult,
  DeleteDraftOptions,
  DeleteDraftResult,
} from './types.js';
import { buildEmailMessage, encodeToBase64Url } from './utils.js';

/**
 * List all drafts in the user's mailbox.
 *
 * Returns draft IDs, subjects, and snippets for quick inspection.
 * Use getDraft() to retrieve the full content of a specific draft.
 *
 * @param options Listing options (maxResults, pageToken)
 * @param context Gmail API context
 * @returns Paginated list of draft summaries
 *
 * @example
 * ```typescript
 * const result = await listDrafts({ maxResults: 10 }, context);
 * result.drafts.forEach(d => console.log(d.draftId, d.subject));
 * ```
 */
export async function listDrafts(
  options: ListDraftsOptions,
  context: GmailContext
): Promise<ListDraftsResult> {
  const { maxResults = 10, pageToken } = options;

  // Build params — exactOptionalPropertyTypes requires we omit undefined keys
  const listParams: gmail_v1.Params$Resource$Users$Drafts$List = {
    userId: 'me',
    maxResults: Math.min(maxResults, 500),
  };
  if (pageToken) {
    listParams.pageToken = pageToken;
  }

  const listResponse = await context.gmail.users.drafts.list(listParams);

  const drafts = listResponse.data.drafts || [];
  const nextPageToken = listResponse.data.nextPageToken ?? undefined;
  const resultSizeEstimate = listResponse.data.resultSizeEstimate ?? 0;

  // Fetch subject/snippet for each draft in parallel (using metadata format for efficiency)
  const draftSummaries = await Promise.all(
    drafts.map(async (draftRef: gmail_v1.Schema$Draft) => {
      if (!draftRef.id) {
        return null;
      }
      try {
        const draftResponse = await context.gmail.users.drafts.get({
          userId: 'me',
          id: draftRef.id,
          format: 'metadata',
        });

        const headers = draftResponse.data.message?.payload?.headers || [];
        const subject =
          headers.find((h) => h.name?.toLowerCase() === 'subject')?.value ?? '(no subject)';
        const to =
          headers.find((h) => h.name?.toLowerCase() === 'to')?.value ?? '';
        const snippet = draftResponse.data.message?.snippet ?? '';

        return {
          draftId: draftRef.id,
          messageId: draftResponse.data.message?.id ?? '',
          subject,
          to,
          snippet,
        };
      } catch {
        // If we cannot fetch the individual draft, return minimal info
        return {
          draftId: draftRef.id,
          messageId: '',
          subject: '(unavailable)',
          to: '',
          snippet: '',
        };
      }
    })
  );

  const filteredDrafts = draftSummaries.filter(Boolean) as ListDraftsResult['drafts'];

  context.performanceMonitor.track('gmail:listDrafts', Date.now() - context.startTime);
  context.logger.info('Listed drafts', { count: filteredDrafts.length });

  return {
    drafts: filteredDrafts,
    nextPageToken,
    resultSizeEstimate,
  };
}

/**
 * Get the full content of a specific draft by ID.
 *
 * Returns parsed headers and decoded body (to, cc, bcc, subject, body).
 *
 * @param options Draft ID to retrieve
 * @param context Gmail API context
 * @returns Full draft content
 *
 * @example
 * ```typescript
 * const draft = await getDraft({ draftId: 'r1234567890' }, context);
 * console.log(draft.subject, draft.body);
 * ```
 */
export async function getDraft(
  options: GetDraftOptions,
  context: GmailContext
): Promise<GetDraftResult> {
  const { draftId } = options;

  const response = await context.gmail.users.drafts.get({
    userId: 'me',
    id: draftId,
    format: 'full',
  });

  const data = response.data;
  const messageId = data.message?.id ?? '';
  const threadId = data.message?.threadId ?? '';
  const headers = data.message?.payload?.headers || [];

  const getHeader = (name: string): string =>
    headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? '';

  const subject = getHeader('Subject') || '(no subject)';
  const to = getHeader('To');
  const from = getHeader('From');
  const cc = getHeader('Cc');
  const bcc = getHeader('Bcc');
  const date = getHeader('Date');

  // Decode the message body
  let body = '';
  let isHtml = false;
  const payload = data.message?.payload;
  if (payload) {
    if (payload.mimeType === 'text/plain' && payload.body?.data) {
      body = Buffer.from(payload.body.data, 'base64').toString('utf-8');
    } else if (payload.mimeType === 'text/html' && payload.body?.data) {
      body = Buffer.from(payload.body.data, 'base64').toString('utf-8');
      isHtml = true;
    } else if (payload.parts) {
      // Prefer plain text, fall back to HTML
      const textPart = payload.parts.find((p) => p.mimeType === 'text/plain');
      const htmlPart = payload.parts.find((p) => p.mimeType === 'text/html');

      if (textPart?.body?.data) {
        body = Buffer.from(textPart.body.data, 'base64').toString('utf-8');
      } else if (htmlPart?.body?.data) {
        body = Buffer.from(htmlPart.body.data, 'base64').toString('utf-8');
        isHtml = true;
      }
    }
  }

  context.performanceMonitor.track('gmail:getDraft', Date.now() - context.startTime);
  context.logger.info('Retrieved draft', { draftId, subject });

  return {
    draftId,
    messageId,
    threadId,
    subject,
    from,
    to,
    cc,
    bcc,
    date,
    body,
    isHtml,
    snippet: data.message?.snippet ?? '',
  };
}

/**
 * Update an existing draft in place.
 *
 * Replaces the draft's content without creating a new draft.
 * The draft ID remains the same after the update.
 *
 * @param options Draft ID and new content
 * @param context Gmail API context
 * @returns Updated draft info
 *
 * @example
 * ```typescript
 * const result = await updateDraft({
 *   draftId: 'r1234567890',
 *   to: ['recipient@example.com'],
 *   subject: 'Updated subject',
 *   body: 'Updated body content.',
 * }, context);
 * console.log(result.message); // 'Draft updated successfully'
 * ```
 */
export async function updateDraft(
  options: UpdateDraftOptions,
  context: GmailContext
): Promise<UpdateDraftResult> {
  const { draftId, to, cc, bcc, subject, body, isHtml, from, inReplyTo, references } = options;

  // Build message options — exactOptionalPropertyTypes requires omitting undefined keys
  const msgOptions: Parameters<typeof buildEmailMessage>[0] = { to, subject, body };
  if (cc) { msgOptions.cc = cc; }
  if (bcc) { msgOptions.bcc = bcc; }
  if (isHtml !== undefined) { msgOptions.isHtml = isHtml; }
  if (from) { msgOptions.from = from; }
  if (inReplyTo) { msgOptions.inReplyTo = inReplyTo; }
  if (references) { msgOptions.references = references; }

  const emailMessage = buildEmailMessage(msgOptions);

  const encodedMessage = encodeToBase64Url(emailMessage);

  const response = await context.gmail.users.drafts.update({
    userId: 'me',
    id: draftId,
    requestBody: {
      message: {
        raw: encodedMessage,
      },
    },
  });

  const messageId = response.data.message?.id ?? '';
  const threadId = response.data.message?.threadId ?? '';

  // Invalidate cache for this draft
  await context.cacheManager.invalidate('gmail:list');

  context.performanceMonitor.track('gmail:updateDraft', Date.now() - context.startTime);
  context.logger.info('Updated draft', { draftId, subject });

  return {
    draftId,
    messageId,
    threadId,
    message: 'Draft updated successfully',
  };
}

/**
 * Permanently delete a draft by ID.
 *
 * This operation cannot be undone. The draft is removed from Gmail.
 *
 * @param options Draft ID to delete
 * @param context Gmail API context
 * @returns Deletion confirmation
 *
 * @example
 * ```typescript
 * const result = await deleteDraft({ draftId: 'r1234567890' }, context);
 * console.log(result.message); // 'Draft r1234567890 deleted'
 * ```
 */
export async function deleteDraft(
  options: DeleteDraftOptions,
  context: GmailContext
): Promise<DeleteDraftResult> {
  const { draftId } = options;

  await context.gmail.users.drafts.delete({
    userId: 'me',
    id: draftId,
  });

  // Invalidate cache
  await context.cacheManager.invalidate('gmail:list');

  context.performanceMonitor.track('gmail:deleteDraft', Date.now() - context.startTime);
  context.logger.info('Deleted draft', { draftId });

  return {
    draftId,
    message: `Draft ${draftId} deleted`,
  };
}
