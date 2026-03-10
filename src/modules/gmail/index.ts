/**
 * Gmail module - Email operations for the gdrive MCP server
 *
 * @module gmail
 * @version 3.3.0
 */

// Types
export type {
  // List types
  ListMessagesOptions,
  ListMessagesResult,
  MessageSummary,
  ListThreadsOptions,
  ListThreadsResult,
  ThreadSummary,
  // Read types
  GetMessageOptions,
  MessageResult,
  GetThreadOptions,
  ThreadResult,
  // Search types
  SearchMessagesOptions,
  SearchMessagesResult,
  // Compose types
  CreateDraftOptions,
  CreateDraftResult,
  // Send types
  SendMessageOptions,
  SendMessageResult,
  SendDraftOptions,
  SendDraftResult,
  // Label types
  ListLabelsOptions,
  ListLabelsResult,
  LabelInfo,
  ModifyLabelsOptions,
  ModifyLabelsResult,
  // Reply types
  ReplyToMessageOptions,
  ReplyToMessageResult,
  ReplyAllToMessageOptions,
  ReplyAllToMessageResult,
  // Forward types
  ForwardMessageOptions,
  ForwardMessageResult,
  // Attachment types
  AttachmentInfo,
  ListAttachmentsOptions,
  ListAttachmentsResult,
  DownloadAttachmentOptions,
  DownloadAttachmentResult,
  OutboundAttachment,
  SendWithAttachmentsOptions,
  SendWithAttachmentsResult,
  // Management types
  TrashMessageOptions,
  TrashMessageResult,
  UntrashMessageOptions,
  UntrashMessageResult,
  DeleteMessageOptions,
  DeleteMessageResult,
  MarkAsReadOptions,
  MarkAsReadResult,
  MarkAsUnreadOptions,
  MarkAsUnreadResult,
  ArchiveMessageOptions,
  ArchiveMessageResult,
  // Template & outreach types
  DryRunOptions,
  DryRunResult,
  SendFromTemplateOptions,
  SendFromTemplateResult,
  BatchRecipient,
  BatchSendOptions,
  BatchSendItemResult,
  BatchPreviewItem,
  BatchSendResult,
} from './types.js';

// List operations
export { listMessages, listThreads } from './list.js';

// Read operations
export { getMessage, getThread } from './read.js';

// Search operations
export { searchMessages } from './search.js';

// Compose operations
export { createDraft, dryRunMessage } from './compose.js';

// Send operations
export { sendMessage, sendDraft, sendFromTemplate, sendBatch } from './send.js';

// Label operations
export { listLabels, modifyLabels } from './labels.js';

// Reply operations
export { replyToMessage, replyAllToMessage } from './reply.js';

// Forward operations
export { forwardMessage } from './forward.js';

// Attachment operations
export { listAttachments, downloadAttachment, sendWithAttachments } from './attachments.js';

// Message management operations
export { trashMessage, untrashMessage, deleteMessage, markAsRead, markAsUnread, archiveMessage } from './manage.js';

// Template operations
export { renderTemplate } from './templates.js';
