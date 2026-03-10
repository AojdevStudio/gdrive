/**
 * SDK Runtime factory.
 * Creates the full typed sdk object injected into execute() sandbox.
 * Each operation is wrapped with per-service rate limiting.
 *
 * Uses dynamic imports so individual module code is not bundled into worker.ts
 * unless the Worker runtime actually evaluates execute().
 */

import type { FullContext, SDKRuntime } from './types.js';
import { RateLimiter } from './rate-limiter.js';

export function createSDKRuntime(
  context: FullContext,
  limiter: RateLimiter = new RateLimiter()
): SDKRuntime {
  return {
    drive: {
      search: limiter.wrap('drive', async (opts: unknown) => {
        const { search } = await import('../modules/drive/index.js');
        return search(opts as Parameters<typeof search>[0], context);
      }),
      enhancedSearch: limiter.wrap('drive', async (opts: unknown) => {
        const { enhancedSearch } = await import('../modules/drive/index.js');
        return enhancedSearch(opts as Parameters<typeof enhancedSearch>[0], context);
      }),
      read: limiter.wrap('drive', async (opts: unknown) => {
        const { read } = await import('../modules/drive/index.js');
        return read(opts as Parameters<typeof read>[0], context);
      }),
      createFile: limiter.wrap('drive', async (opts: unknown) => {
        const { createFile } = await import('../modules/drive/index.js');
        return createFile(opts as Parameters<typeof createFile>[0], context);
      }),
      createFolder: limiter.wrap('drive', async (opts: unknown) => {
        const { createFolder } = await import('../modules/drive/index.js');
        return createFolder(opts as Parameters<typeof createFolder>[0], context);
      }),
      updateFile: limiter.wrap('drive', async (opts: unknown) => {
        const { updateFile } = await import('../modules/drive/index.js');
        return updateFile(opts as Parameters<typeof updateFile>[0], context);
      }),
      batchOperations: limiter.wrap('drive', async (opts: unknown) => {
        const { batchOperations } = await import('../modules/drive/index.js');
        return batchOperations(opts as Parameters<typeof batchOperations>[0], context);
      }),
    },

    sheets: {
      listSheets: limiter.wrap('sheets', async (opts: unknown) => {
        const { listSheets } = await import('../modules/sheets/index.js');
        return listSheets(opts as Parameters<typeof listSheets>[0], context);
      }),
      readSheet: limiter.wrap('sheets', async (opts: unknown) => {
        const { readSheet } = await import('../modules/sheets/index.js');
        return readSheet(opts as Parameters<typeof readSheet>[0], context);
      }),
      createSheet: limiter.wrap('sheets', async (opts: unknown) => {
        const { createSheet } = await import('../modules/sheets/index.js');
        return createSheet(opts as Parameters<typeof createSheet>[0], context);
      }),
      renameSheet: limiter.wrap('sheets', async (opts: unknown) => {
        const { renameSheet } = await import('../modules/sheets/index.js');
        return renameSheet(opts as Parameters<typeof renameSheet>[0], context);
      }),
      deleteSheet: limiter.wrap('sheets', async (opts: unknown) => {
        const { deleteSheet } = await import('../modules/sheets/index.js');
        return deleteSheet(opts as Parameters<typeof deleteSheet>[0], context);
      }),
      updateCells: limiter.wrap('sheets', async (opts: unknown) => {
        const { updateCells } = await import('../modules/sheets/index.js');
        return updateCells(opts as Parameters<typeof updateCells>[0], context);
      }),
      updateFormula: limiter.wrap('sheets', async (opts: unknown) => {
        const { updateFormula } = await import('../modules/sheets/index.js');
        return updateFormula(opts as Parameters<typeof updateFormula>[0], context);
      }),
      formatCells: limiter.wrap('sheets', async (opts: unknown) => {
        const { formatCells } = await import('../modules/sheets/index.js');
        return formatCells(opts as Parameters<typeof formatCells>[0], context);
      }),
      addConditionalFormat: limiter.wrap('sheets', async (opts: unknown) => {
        const { addConditionalFormat } = await import('../modules/sheets/index.js');
        return addConditionalFormat(opts as Parameters<typeof addConditionalFormat>[0], context);
      }),
      freezeRowsColumns: limiter.wrap('sheets', async (opts: unknown) => {
        const { freezeRowsColumns } = await import('../modules/sheets/index.js');
        return freezeRowsColumns(opts as Parameters<typeof freezeRowsColumns>[0], context);
      }),
      setColumnWidth: limiter.wrap('sheets', async (opts: unknown) => {
        const { setColumnWidth } = await import('../modules/sheets/index.js');
        return setColumnWidth(opts as Parameters<typeof setColumnWidth>[0], context);
      }),
      appendRows: limiter.wrap('sheets', async (opts: unknown) => {
        const { appendRows } = await import('../modules/sheets/index.js');
        return appendRows(opts as Parameters<typeof appendRows>[0], context);
      }),
      readAsRecords: limiter.wrap('sheets', async (opts: unknown) => {
        const { readAsRecords } = await import('../modules/sheets/index.js');
        return readAsRecords(opts as Parameters<typeof readAsRecords>[0], context);
      }),
      updateRecords: limiter.wrap('sheets', async (opts: unknown) => {
        const { updateRecords } = await import('../modules/sheets/index.js');
        return updateRecords(opts as Parameters<typeof updateRecords>[0], context);
      }),
    },

    forms: {
      createForm: limiter.wrap('forms', async (opts: unknown) => {
        const { createForm } = await import('../modules/forms/index.js');
        return createForm(opts as Parameters<typeof createForm>[0], context);
      }),
      readForm: limiter.wrap('forms', async (opts: unknown) => {
        const { readForm } = await import('../modules/forms/index.js');
        return readForm(opts as Parameters<typeof readForm>[0], context);
      }),
      addQuestion: limiter.wrap('forms', async (opts: unknown) => {
        const { addQuestion } = await import('../modules/forms/index.js');
        return addQuestion(opts as Parameters<typeof addQuestion>[0], context);
      }),
      listResponses: limiter.wrap('forms', async (opts: unknown) => {
        const { listResponses } = await import('../modules/forms/index.js');
        return listResponses(opts as Parameters<typeof listResponses>[0], context);
      }),
    },

    docs: {
      createDocument: limiter.wrap('docs', async (opts: unknown) => {
        const { createDocument } = await import('../modules/docs/index.js');
        return createDocument(opts as Parameters<typeof createDocument>[0], context);
      }),
      insertText: limiter.wrap('docs', async (opts: unknown) => {
        const { insertText } = await import('../modules/docs/index.js');
        return insertText(opts as Parameters<typeof insertText>[0], context);
      }),
      replaceText: limiter.wrap('docs', async (opts: unknown) => {
        const { replaceText } = await import('../modules/docs/index.js');
        return replaceText(opts as Parameters<typeof replaceText>[0], context);
      }),
      applyTextStyle: limiter.wrap('docs', async (opts: unknown) => {
        const { applyTextStyle } = await import('../modules/docs/index.js');
        return applyTextStyle(opts as Parameters<typeof applyTextStyle>[0], context);
      }),
      insertTable: limiter.wrap('docs', async (opts: unknown) => {
        const { insertTable } = await import('../modules/docs/index.js');
        return insertTable(opts as Parameters<typeof insertTable>[0], context);
      }),
    },

    gmail: {
      listMessages: limiter.wrap('gmail', async (opts: unknown) => {
        const { listMessages } = await import('../modules/gmail/index.js');
        return listMessages(opts as Parameters<typeof listMessages>[0], context);
      }),
      listThreads: limiter.wrap('gmail', async (opts: unknown) => {
        const { listThreads } = await import('../modules/gmail/index.js');
        return listThreads(opts as Parameters<typeof listThreads>[0], context);
      }),
      getMessage: limiter.wrap('gmail', async (opts: unknown) => {
        const { getMessage } = await import('../modules/gmail/index.js');
        return getMessage(opts as Parameters<typeof getMessage>[0], context);
      }),
      getThread: limiter.wrap('gmail', async (opts: unknown) => {
        const { getThread } = await import('../modules/gmail/index.js');
        return getThread(opts as Parameters<typeof getThread>[0], context);
      }),
      searchMessages: limiter.wrap('gmail', async (opts: unknown) => {
        const { searchMessages } = await import('../modules/gmail/index.js');
        return searchMessages(opts as Parameters<typeof searchMessages>[0], context);
      }),
      createDraft: limiter.wrap('gmail', async (opts: unknown) => {
        const { createDraft } = await import('../modules/gmail/index.js');
        return createDraft(opts as Parameters<typeof createDraft>[0], context);
      }),
      sendMessage: limiter.wrap('gmail', async (opts: unknown) => {
        const { sendMessage } = await import('../modules/gmail/index.js');
        return sendMessage(opts as Parameters<typeof sendMessage>[0], context);
      }),
      sendDraft: limiter.wrap('gmail', async (opts: unknown) => {
        const { sendDraft } = await import('../modules/gmail/index.js');
        return sendDraft(opts as Parameters<typeof sendDraft>[0], context);
      }),
      listLabels: limiter.wrap('gmail', async (opts: unknown) => {
        const { listLabels } = await import('../modules/gmail/index.js');
        return listLabels(opts as Parameters<typeof listLabels>[0], context);
      }),
      modifyLabels: limiter.wrap('gmail', async (opts: unknown) => {
        const { modifyLabels } = await import('../modules/gmail/index.js');
        return modifyLabels(opts as Parameters<typeof modifyLabels>[0], context);
      }),
      replyToMessage: limiter.wrap('gmail', async (opts: unknown) => {
        const { replyToMessage } = await import('../modules/gmail/index.js');
        return replyToMessage(opts as Parameters<typeof replyToMessage>[0], context);
      }),
      replyAllToMessage: limiter.wrap('gmail', async (opts: unknown) => {
        const { replyAllToMessage } = await import('../modules/gmail/index.js');
        return replyAllToMessage(opts as Parameters<typeof replyAllToMessage>[0], context);
      }),
      forwardMessage: limiter.wrap('gmail', async (opts: unknown) => {
        const { forwardMessage } = await import('../modules/gmail/index.js');
        return forwardMessage(opts as Parameters<typeof forwardMessage>[0], context);
      }),
      listAttachments: limiter.wrap('gmail', async (opts: unknown) => {
        const { listAttachments } = await import('../modules/gmail/index.js');
        return listAttachments(opts as Parameters<typeof listAttachments>[0], context);
      }),
      downloadAttachment: limiter.wrap('gmail', async (opts: unknown) => {
        const { downloadAttachment } = await import('../modules/gmail/index.js');
        return downloadAttachment(opts as Parameters<typeof downloadAttachment>[0], context);
      }),
      sendWithAttachments: limiter.wrap('gmail', async (opts: unknown) => {
        const { sendWithAttachments } = await import('../modules/gmail/index.js');
        return sendWithAttachments(opts as Parameters<typeof sendWithAttachments>[0], context);
      }),
      trashMessage: limiter.wrap('gmail', async (opts: unknown) => {
        const { trashMessage } = await import('../modules/gmail/index.js');
        return trashMessage(opts as Parameters<typeof trashMessage>[0], context);
      }),
      untrashMessage: limiter.wrap('gmail', async (opts: unknown) => {
        const { untrashMessage } = await import('../modules/gmail/index.js');
        return untrashMessage(opts as Parameters<typeof untrashMessage>[0], context);
      }),
      deleteMessage: limiter.wrap('gmail', async (opts: unknown) => {
        const { deleteMessage } = await import('../modules/gmail/index.js');
        return deleteMessage(opts as Parameters<typeof deleteMessage>[0], context);
      }),
      markAsRead: limiter.wrap('gmail', async (opts: unknown) => {
        const { markAsRead } = await import('../modules/gmail/index.js');
        return markAsRead(opts as Parameters<typeof markAsRead>[0], context);
      }),
      markAsUnread: limiter.wrap('gmail', async (opts: unknown) => {
        const { markAsUnread } = await import('../modules/gmail/index.js');
        return markAsUnread(opts as Parameters<typeof markAsUnread>[0], context);
      }),
      archiveMessage: limiter.wrap('gmail', async (opts: unknown) => {
        const { archiveMessage } = await import('../modules/gmail/index.js');
        return archiveMessage(opts as Parameters<typeof archiveMessage>[0], context);
      }),
      dryRun: async (opts: unknown) => {
        // No rate limiter — dryRunMessage is a pure function with zero API calls
        const { dryRunMessage } = await import('../modules/gmail/index.js');
        return dryRunMessage(opts as Parameters<typeof dryRunMessage>[0]);
      },
      sendFromTemplate: limiter.wrap('gmail', async (opts: unknown) => {
        const { sendFromTemplate } = await import('../modules/gmail/index.js');
        return sendFromTemplate(opts as Parameters<typeof sendFromTemplate>[0], context);
      }),
      sendBatch: limiter.wrap('gmail', async (opts: unknown) => {
        const { sendBatch } = await import('../modules/gmail/index.js');
        return sendBatch(opts as Parameters<typeof sendBatch>[0], context);
      }),
      detectReplies: limiter.wrap('gmail', async (opts: unknown) => {
        const { detectReplies } = await import('../modules/gmail/index.js');
        return detectReplies(opts as Parameters<typeof detectReplies>[0], context);
      }),
      getTrackingData: limiter.wrap('gmail', async (opts: unknown) => {
        if (!context.kv) {
          throw new Error(
            'getTrackingData is only available in the Cloudflare Workers runtime (requires KV namespace)'
          );
        }
        const { getTrackingData } = await import('../server/tracking.js');
        return getTrackingData(opts as { campaignId: string }, context.kv);
      }),
    },

    calendar: {
      listCalendars: limiter.wrap('calendar', async (opts: unknown) => {
        const { listCalendars } = await import('../modules/calendar/index.js');
        return listCalendars(opts as Parameters<typeof listCalendars>[0], context);
      }),
      getCalendar: limiter.wrap('calendar', async (opts: unknown) => {
        const { getCalendar } = await import('../modules/calendar/index.js');
        return getCalendar(opts as Parameters<typeof getCalendar>[0], context);
      }),
      listEvents: limiter.wrap('calendar', async (opts: unknown) => {
        const { listEvents } = await import('../modules/calendar/index.js');
        return listEvents(opts as Parameters<typeof listEvents>[0], context);
      }),
      getEvent: limiter.wrap('calendar', async (opts: unknown) => {
        const { getEvent } = await import('../modules/calendar/index.js');
        return getEvent(opts as Parameters<typeof getEvent>[0], context);
      }),
      createEvent: limiter.wrap('calendar', async (opts: unknown) => {
        const { createEvent } = await import('../modules/calendar/index.js');
        return createEvent(opts as Parameters<typeof createEvent>[0], context);
      }),
      updateEvent: limiter.wrap('calendar', async (opts: unknown) => {
        const { updateEvent } = await import('../modules/calendar/index.js');
        return updateEvent(opts as Parameters<typeof updateEvent>[0], context);
      }),
      deleteEvent: limiter.wrap('calendar', async (opts: unknown) => {
        const { deleteEvent } = await import('../modules/calendar/index.js');
        return deleteEvent(opts as Parameters<typeof deleteEvent>[0], context);
      }),
      quickAdd: limiter.wrap('calendar', async (opts: unknown) => {
        const { quickAdd } = await import('../modules/calendar/index.js');
        return quickAdd(opts as Parameters<typeof quickAdd>[0], context);
      }),
      checkFreeBusy: limiter.wrap('calendar', async (opts: unknown) => {
        const { checkFreeBusy } = await import('../modules/calendar/index.js');
        return checkFreeBusy(opts as Parameters<typeof checkFreeBusy>[0], context);
      }),
    },
  };
}
