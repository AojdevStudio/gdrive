/**
 * Gmail module - Email operations for the gdrive MCP server
 *
 * @module gmail
 * @version 3.2.0
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
} from './types.js';

// List operations
export { listMessages, listThreads } from './list.js';

// Read operations
export { getMessage, getThread } from './read.js';

// Search operations
export { searchMessages } from './search.js';

// Compose operations
export { createDraft } from './compose.js';

// Send operations
export { sendMessage, sendDraft } from './send.js';

// Label operations
export { listLabels, modifyLabels } from './labels.js';
