import { SDK_SPEC, type OperationSpec } from '../../sdk/spec.js';

export const COMPOSIO_SERVICES = ['drive', 'sheets', 'forms', 'docs', 'gmail', 'calendar'] as const;
export type ComposioServiceName = (typeof COMPOSIO_SERVICES)[number];

export interface ComposioOperationDefinition {
  service: ComposioServiceName;
  operation: string;
  toolkit: string;
  toolSlug: string;
  spec: OperationSpec;
  argAliases?: Record<string, string>;
}

type OperationMap = Record<string, {
  toolkit: string;
  toolSlug: string;
  argAliases?: Record<string, string>;
}>;

const DRIVE: OperationMap = {
  search: {
    toolkit: 'googledrive',
    toolSlug: 'GOOGLEDRIVE_FIND_FILE',
    argAliases: { query: 'q', pageSize: 'pageSize' },
  },
  enhancedSearch: {
    toolkit: 'googledrive',
    toolSlug: 'GOOGLEDRIVE_FIND_FILE',
    argAliases: { query: 'q', pageSize: 'pageSize', pageToken: 'pageToken' },
  },
  read: {
    toolkit: 'googledrive',
    toolSlug: 'GOOGLEDRIVE_PARSE_FILE',
    argAliases: { fileId: 'file_id' },
  },
  createFile: {
    toolkit: 'googledrive',
    toolSlug: 'GOOGLEDRIVE_CREATE_FILE_FROM_TEXT',
    argAliases: { name: 'file_name', content: 'text_content', mimeType: 'mime_type', parentId: 'parent_id' },
  },
  createFolder: {
    toolkit: 'googledrive',
    toolSlug: 'GOOGLEDRIVE_CREATE_FOLDER',
    argAliases: { name: 'folder_name', parentId: 'parent_folder_id' },
  },
  updateFile: {
    toolkit: 'googledrive',
    toolSlug: 'GOOGLEDRIVE_EDIT_FILE',
    argAliases: { fileId: 'file_id', content: 'text_content' },
  },
  batchOperations: {
    toolkit: 'googledrive',
    toolSlug: 'COMPOSIO_MULTI_EXECUTE_TOOL',
  },
};

const SHEETS: OperationMap = {
  listSheets: { toolkit: 'googlesheets', toolSlug: 'GOOGLESHEETS_GET_SHEET_NAMES' },
  readSheet: {
    toolkit: 'googlesheets',
    toolSlug: 'GOOGLESHEETS_VALUES_GET',
    argAliases: { spreadsheetId: 'spreadsheet_id' },
  },
  createSheet: {
    toolkit: 'googlesheets',
    toolSlug: 'GOOGLESHEETS_ADD_SHEET',
    argAliases: { spreadsheetId: 'spreadsheet_id' },
  },
  renameSheet: {
    toolkit: 'googlesheets',
    toolSlug: 'GOOGLESHEETS_UPDATE_SHEET_PROPERTIES',
    argAliases: { spreadsheetId: 'spreadsheet_id', sheetId: 'sheet_id', newTitle: 'title' },
  },
  deleteSheet: {
    toolkit: 'googlesheets',
    toolSlug: 'GOOGLESHEETS_DELETE_SHEET',
    argAliases: { spreadsheetId: 'spreadsheet_id', sheetId: 'sheet_id' },
  },
  updateCells: {
    toolkit: 'googlesheets',
    toolSlug: 'GOOGLESHEETS_VALUES_UPDATE',
    argAliases: { spreadsheetId: 'spreadsheet_id' },
  },
  updateFormula: {
    toolkit: 'googlesheets',
    toolSlug: 'GOOGLESHEETS_VALUES_UPDATE',
    argAliases: { spreadsheetId: 'spreadsheet_id', formula: 'values' },
  },
  formatCells: {
    toolkit: 'googlesheets',
    toolSlug: 'GOOGLESHEETS_FORMAT_CELL',
    argAliases: { spreadsheetId: 'spreadsheet_id' },
  },
  addConditionalFormat: {
    toolkit: 'googlesheets',
    toolSlug: 'GOOGLESHEETS_MUTATE_CONDITIONAL_FORMAT_RULES',
    argAliases: { spreadsheetId: 'spreadsheet_id' },
  },
  freezeRowsColumns: {
    toolkit: 'googlesheets',
    toolSlug: 'GOOGLESHEETS_UPDATE_SHEET_PROPERTIES',
    argAliases: { spreadsheetId: 'spreadsheet_id', sheetId: 'sheet_id' },
  },
  setColumnWidth: {
    toolkit: 'googlesheets',
    toolSlug: 'GOOGLESHEETS_UPDATE_DIMENSION_PROPERTIES',
    argAliases: { spreadsheetId: 'spreadsheet_id', sheetId: 'sheet_id' },
  },
  appendRows: {
    toolkit: 'googlesheets',
    toolSlug: 'GOOGLESHEETS_SPREADSHEETS_VALUES_APPEND',
    argAliases: { spreadsheetId: 'spreadsheet_id' },
  },
  readAsRecords: {
    toolkit: 'googlesheets',
    toolSlug: 'GOOGLESHEETS_QUERY_TABLE',
    argAliases: { spreadsheetId: 'spreadsheet_id' },
  },
  updateRecords: {
    toolkit: 'googlesheets',
    toolSlug: 'GOOGLESHEETS_UPSERT_ROWS',
    argAliases: { spreadsheetId: 'spreadsheet_id' },
  },
};

const FORMS: OperationMap = {
  createForm: { toolkit: 'googleforms', toolSlug: 'GOOGLEFORMS_CREATE_FORM' },
  readForm: { toolkit: 'googleforms', toolSlug: 'GOOGLEFORMS_GET_FORM', argAliases: { formId: 'form_id' } },
  addQuestion: {
    toolkit: 'googleforms',
    toolSlug: 'GOOGLEFORMS_BATCH_UPDATE_FORM',
    argAliases: { formId: 'form_id' },
  },
  listResponses: {
    toolkit: 'googleforms',
    toolSlug: 'GOOGLEFORMS_LIST_RESPONSES',
    argAliases: { formId: 'form_id' },
  },
};

const DOCS: OperationMap = {
  createDocument: { toolkit: 'googledocs', toolSlug: 'GOOGLEDOCS_CREATE_DOCUMENT' },
  insertText: {
    toolkit: 'googledocs',
    toolSlug: 'GOOGLEDOCS_INSERT_TEXT_ACTION',
    argAliases: { documentId: 'document_id', text: 'text_to_insert', index: 'insertion_index' },
  },
  replaceText: {
    toolkit: 'googledocs',
    toolSlug: 'GOOGLEDOCS_REPLACE_ALL_TEXT',
    argAliases: { documentId: 'document_id', searchText: 'replace_text', replaceText: 'new_text' },
  },
  applyTextStyle: {
    toolkit: 'googledocs',
    toolSlug: 'GOOGLEDOCS_UPDATE_DOCUMENT_STYLE',
    argAliases: { documentId: 'document_id' },
  },
  insertTable: {
    toolkit: 'googledocs',
    toolSlug: 'GOOGLEDOCS_INSERT_TABLE_ACTION',
    argAliases: { documentId: 'documentId' },
  },
};

const GMAIL: OperationMap = {
  listMessages: { toolkit: 'gmail', toolSlug: 'GMAIL_FETCH_EMAILS' },
  listThreads: { toolkit: 'gmail', toolSlug: 'GMAIL_LIST_THREADS' },
  getMessage: { toolkit: 'gmail', toolSlug: 'GMAIL_FETCH_MESSAGE_BY_MESSAGE_ID', argAliases: { messageId: 'message_id' } },
  getThread: { toolkit: 'gmail', toolSlug: 'GMAIL_FETCH_MESSAGE_BY_THREAD_ID', argAliases: { threadId: 'thread_id' } },
  searchMessages: { toolkit: 'gmail', toolSlug: 'GMAIL_FETCH_EMAILS', argAliases: { query: 'query' } },
  createDraft: { toolkit: 'gmail', toolSlug: 'GMAIL_CREATE_EMAIL_DRAFT' },
  sendMessage: { toolkit: 'gmail', toolSlug: 'GMAIL_SEND_EMAIL' },
  sendDraft: { toolkit: 'gmail', toolSlug: 'GMAIL_SEND_DRAFT', argAliases: { draftId: 'draft_id' } },
  listLabels: { toolkit: 'gmail', toolSlug: 'GMAIL_LIST_LABELS' },
  createLabel: { toolkit: 'gmail', toolSlug: 'GMAIL_CREATE_LABEL' },
  modifyLabels: { toolkit: 'gmail', toolSlug: 'GMAIL_ADD_LABEL_TO_EMAIL' },
  replyToMessage: { toolkit: 'gmail', toolSlug: 'GMAIL_REPLY_TO_THREAD' },
  replyAllToMessage: { toolkit: 'gmail', toolSlug: 'GMAIL_REPLY_TO_THREAD' },
  forwardMessage: { toolkit: 'gmail', toolSlug: 'GMAIL_FORWARD_MESSAGE' },
  listAttachments: { toolkit: 'gmail', toolSlug: 'GMAIL_FETCH_MESSAGE_BY_MESSAGE_ID', argAliases: { messageId: 'message_id' } },
  downloadAttachment: { toolkit: 'gmail', toolSlug: 'GMAIL_GET_ATTACHMENT', argAliases: { messageId: 'message_id', attachmentId: 'attachment_id' } },
  readAttachmentText: { toolkit: 'gmail', toolSlug: 'GMAIL_GET_ATTACHMENT', argAliases: { messageId: 'message_id', attachmentId: 'attachment_id' } },
  sendWithAttachments: { toolkit: 'gmail', toolSlug: 'GMAIL_SEND_EMAIL' },
  trashMessage: { toolkit: 'gmail', toolSlug: 'GMAIL_MOVE_TO_TRASH', argAliases: { messageId: 'message_id' } },
  untrashMessage: { toolkit: 'gmail', toolSlug: 'GMAIL_UNTRASH_MESSAGE', argAliases: { messageId: 'message_id' } },
  deleteMessage: { toolkit: 'gmail', toolSlug: 'GMAIL_DELETE_MESSAGE', argAliases: { messageId: 'message_id' } },
  markAsRead: { toolkit: 'gmail', toolSlug: 'GMAIL_BATCH_MODIFY_MESSAGES' },
  markAsUnread: { toolkit: 'gmail', toolSlug: 'GMAIL_BATCH_MODIFY_MESSAGES' },
  archiveMessage: { toolkit: 'gmail', toolSlug: 'GMAIL_BATCH_MODIFY_MESSAGES' },
  dryRun: { toolkit: 'gmail', toolSlug: 'GMAIL_SEND_EMAIL' },
  sendFromTemplate: { toolkit: 'gmail', toolSlug: 'GMAIL_SEND_EMAIL' },
  sendBatch: { toolkit: 'gmail', toolSlug: 'COMPOSIO_MULTI_EXECUTE_TOOL' },
  detectReplies: { toolkit: 'gmail', toolSlug: 'GMAIL_LIST_THREADS' },
  getTrackingData: { toolkit: 'gmail', toolSlug: 'GMAIL_FETCH_EMAILS' },
  listDrafts: { toolkit: 'gmail', toolSlug: 'GMAIL_LIST_DRAFTS' },
  getDraft: { toolkit: 'gmail', toolSlug: 'GMAIL_GET_DRAFT', argAliases: { draftId: 'draft_id' } },
  updateDraft: { toolkit: 'gmail', toolSlug: 'GMAIL_UPDATE_DRAFT', argAliases: { draftId: 'draft_id' } },
  deleteDraft: { toolkit: 'gmail', toolSlug: 'GMAIL_DELETE_DRAFT', argAliases: { draftId: 'draft_id' } },
};

const CALENDAR: OperationMap = {
  listCalendars: { toolkit: 'googlecalendar', toolSlug: 'GOOGLECALENDAR_LIST_CALENDARS' },
  getCalendar: { toolkit: 'googlecalendar', toolSlug: 'GOOGLECALENDAR_GET_CALENDAR', argAliases: { calendarId: 'calendar_id' } },
  listEvents: { toolkit: 'googlecalendar', toolSlug: 'GOOGLECALENDAR_EVENTS_LIST', argAliases: { calendarId: 'calendar_id' } },
  getEvent: {
    toolkit: 'googlecalendar',
    toolSlug: 'GOOGLECALENDAR_EVENTS_GET',
    argAliases: { calendarId: 'calendar_id', eventId: 'event_id' },
  },
  createEvent: { toolkit: 'googlecalendar', toolSlug: 'GOOGLECALENDAR_CREATE_EVENT', argAliases: { calendarId: 'calendar_id' } },
  updateEvent: {
    toolkit: 'googlecalendar',
    toolSlug: 'GOOGLECALENDAR_UPDATE_EVENT',
    argAliases: { calendarId: 'calendar_id', eventId: 'event_id' },
  },
  deleteEvent: {
    toolkit: 'googlecalendar',
    toolSlug: 'GOOGLECALENDAR_DELETE_EVENT',
    argAliases: { calendarId: 'calendar_id', eventId: 'event_id' },
  },
  quickAdd: { toolkit: 'googlecalendar', toolSlug: 'GOOGLECALENDAR_QUICK_ADD', argAliases: { calendarId: 'calendar_id' } },
  checkFreeBusy: { toolkit: 'googlecalendar', toolSlug: 'GOOGLECALENDAR_FIND_FREE_SLOTS' },
};

const OPERATION_MAPS: Record<ComposioServiceName, OperationMap> = {
  drive: DRIVE,
  sheets: SHEETS,
  forms: FORMS,
  docs: DOCS,
  gmail: GMAIL,
  calendar: CALENDAR,
};

export function getComposioOperation(
  service: string,
  operation: string
): ComposioOperationDefinition | undefined {
  if (!COMPOSIO_SERVICES.includes(service as ComposioServiceName)) {
    return undefined;
  }
  const serviceName = service as ComposioServiceName;
  const mapping = OPERATION_MAPS[serviceName][operation];
  const spec = SDK_SPEC[serviceName][operation];
  if (!mapping || !spec) {
    return undefined;
  }
  return {
    service: serviceName,
    operation,
    spec,
    ...mapping,
  };
}

export function listComposioOperations(service?: string): ComposioOperationDefinition[] {
  const services = service ? [service] : COMPOSIO_SERVICES;
  return services.flatMap((svc) => {
    if (!COMPOSIO_SERVICES.includes(svc as ComposioServiceName)) {
      return [];
    }
    return Object.keys(OPERATION_MAPS[svc as ComposioServiceName])
      .map((operation) => getComposioOperation(svc, operation))
      .filter((op): op is ComposioOperationDefinition => Boolean(op));
  });
}

export function listEnabledComposioToolkits(): string[] {
  return [...new Set(listComposioOperations().map((operation) => operation.toolkit))];
}

