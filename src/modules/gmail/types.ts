/**
 * Gmail module types
 *
 * v3.3.0: Added attachment support
 */

// ============================================================================
// List Operations
// ============================================================================

/**
 * Options for listing messages
 */
export interface ListMessagesOptions {
  /** Maximum number of messages to return (default: 10, max: 500) */
  maxResults?: number;
  /** Page token for pagination */
  pageToken?: string;
  /** Only return messages with these label IDs */
  labelIds?: string[];
  /** Include messages from SPAM and TRASH (default: false) */
  includeSpamTrash?: boolean;
}

/**
 * Result of listing messages
 */
export interface ListMessagesResult {
  messages: MessageSummary[];
  nextPageToken?: string;
  resultSizeEstimate: number;
}

/**
 * Summary of a message (from list operations)
 */
export interface MessageSummary {
  id: string;
  threadId: string;
}

/**
 * Options for listing threads
 */
export interface ListThreadsOptions {
  /** Maximum number of threads to return (default: 10, max: 500) */
  maxResults?: number;
  /** Page token for pagination */
  pageToken?: string;
  /** Only return threads with these label IDs */
  labelIds?: string[];
  /** Include threads from SPAM and TRASH (default: false) */
  includeSpamTrash?: boolean;
}

/**
 * Result of listing threads
 */
export interface ListThreadsResult {
  threads: ThreadSummary[];
  nextPageToken?: string;
  resultSizeEstimate: number;
}

/**
 * Summary of a thread (from list operations)
 */
export interface ThreadSummary {
  id: string;
  snippet: string;
  historyId: string;
}

// ============================================================================
// Read Operations
// ============================================================================

/**
 * Options for getting a single message
 */
export interface GetMessageOptions {
  /** The message ID */
  id: string;
  /** Format of the message (default: 'full') */
  format?: 'minimal' | 'full' | 'raw' | 'metadata';
  /** Only return specific headers (requires format: 'metadata') */
  metadataHeaders?: string[];
}

/**
 * Full message result
 */
export interface MessageResult {
  id: string;
  threadId: string;
  labelIds: string[];
  snippet: string;
  historyId: string;
  internalDate: string;
  /** Parsed headers */
  headers: {
    from?: string;
    to?: string;
    cc?: string;
    bcc?: string;
    subject?: string;
    date?: string;
    messageId?: string;
    inReplyTo?: string;
    references?: string;
  };
  /** Message body */
  body?: {
    plain?: string;
    html?: string;
  };
  /** Size in bytes */
  sizeEstimate: number;
}

/**
 * Options for getting a thread
 */
export interface GetThreadOptions {
  /** The thread ID */
  id: string;
  /** Format of messages in the thread (default: 'full') */
  format?: 'minimal' | 'full' | 'metadata';
  /** Only return specific headers (requires format: 'metadata') */
  metadataHeaders?: string[];
}

/**
 * Thread result with all messages
 */
export interface ThreadResult {
  id: string;
  historyId: string;
  messages: MessageResult[];
}

// ============================================================================
// Search Operations
// ============================================================================

/**
 * Options for searching messages
 */
export interface SearchMessagesOptions {
  /** Gmail search query (e.g., "from:user@example.com is:unread") */
  query: string;
  /** Maximum number of results (default: 10, max: 500) */
  maxResults?: number;
  /** Page token for pagination */
  pageToken?: string;
  /** Include messages from SPAM and TRASH (default: false) */
  includeSpamTrash?: boolean;
}

/**
 * Search result (same as list result)
 */
export type SearchMessagesResult = ListMessagesResult;

// ============================================================================
// Compose Operations
// ============================================================================

/**
 * Options for creating a draft
 */
export interface CreateDraftOptions {
  /** Recipient email addresses */
  to: string[];
  /** CC recipients */
  cc?: string[];
  /** BCC recipients */
  bcc?: string[];
  /** Email subject */
  subject: string;
  /** Email body */
  body: string;
  /** Whether body is HTML (default: false) */
  isHtml?: boolean;
  /** Send from a different email address (send-as alias) */
  from?: string;
  /** Message ID to reply to (for threading) */
  inReplyTo?: string;
  /** Thread references (for threading) */
  references?: string;
}

/**
 * Result of creating a draft
 */
export interface CreateDraftResult {
  draftId: string;
  messageId: string;
  threadId: string;
  message: string;
}

/**
 * Options for updating an existing draft
 */
export interface UpdateDraftOptions {
  /** The draft ID to update */
  draftId: string;
  /** Updated recipient email addresses */
  to?: string[];
  /** Updated CC recipients */
  cc?: string[];
  /** Updated BCC recipients */
  bcc?: string[];
  /** Updated email subject */
  subject?: string;
  /** Updated email body */
  body?: string;
  /** Whether body is HTML (default: false) */
  isHtml?: boolean;
  /** Send from a different email address (send-as alias) */
  from?: string;
  /** Message ID to reply to (for threading) */
  inReplyTo?: string;
  /** Thread references (for threading) */
  references?: string;
}

/**
 * Result of updating a draft
 */
export interface UpdateDraftResult {
  draftId: string;
  messageId: string;
  threadId: string;
  message: string;
}

// ============================================================================
// Send Operations
// ============================================================================

/**
 * Options for sending a message
 */
export interface SendMessageOptions {
  /** Recipient email addresses */
  to: string[];
  /** CC recipients */
  cc?: string[];
  /** BCC recipients */
  bcc?: string[];
  /** Email subject */
  subject: string;
  /** Email body */
  body: string;
  /** Whether body is HTML (default: false) */
  isHtml?: boolean;
  /** Send from a different email address (send-as alias) */
  from?: string;
  /** Message ID to reply to (for threading) */
  inReplyTo?: string;
  /** Thread references (for threading) */
  references?: string;
  /** Thread ID to add this message to */
  threadId?: string;
}

/**
 * Result of sending a message
 */
export interface SendMessageResult {
  messageId: string;
  threadId: string;
  labelIds: string[];
  message: string;
}

/**
 * Options for sending a draft
 */
export interface SendDraftOptions {
  /** The draft ID to send */
  draftId: string;
}

/**
 * Result of sending a draft
 */
export interface SendDraftResult {
  messageId: string;
  threadId: string;
  labelIds: string[];
  message: string;
}

// ============================================================================
// Label Operations
// ============================================================================

/**
 * Options for listing labels (empty for API consistency - Gmail doesn't paginate labels)
 */
export type ListLabelsOptions = Record<string, never>;

/**
 * A Gmail label
 */
export interface LabelInfo {
  id: string;
  name: string;
  type: 'system' | 'user';
  messageListVisibility?: 'show' | 'hide';
  labelListVisibility?: 'labelShow' | 'labelShowIfUnread' | 'labelHide';
  messagesTotal?: number;
  messagesUnread?: number;
  threadsTotal?: number;
  threadsUnread?: number;
  color?: {
    textColor?: string;
    backgroundColor?: string;
  };
}

/**
 * Result of listing labels
 */
export interface ListLabelsResult {
  labels: LabelInfo[];
}

/**
 * Options for modifying labels on a message
 */
export interface ModifyLabelsOptions {
  /** The message ID */
  messageId: string;
  /** Label IDs to add */
  addLabelIds?: string[];
  /** Label IDs to remove */
  removeLabelIds?: string[];
}

/**
 * Result of modifying labels
 */
export interface ModifyLabelsResult {
  messageId: string;
  labelIds: string[];
  message: string;
}

// ============================================================================
// Attachment Operations
// ============================================================================

/**
 * Options for getting an attachment
 */
export interface GetAttachmentOptions {
  /** The message ID containing the attachment */
  messageId: string;
  /** The attachment ID */
  attachmentId: string;
}

/**
 * Result of getting an attachment
 */
export interface GetAttachmentResult {
  /** Base64 encoded attachment data */
  data: string;
  /** Size in bytes */
  size: number;
}

/**
 * Attachment metadata from a message
 */
export interface AttachmentInfo {
  /** Attachment ID for fetching content */
  attachmentId: string;
  /** Original filename */
  filename: string;
  /** MIME type */
  mimeType: string;
  /** Size in bytes */
  size: number;
}

/**
 * Options for listing attachments in a message
 */
export interface ListAttachmentsOptions {
  /** The message ID to list attachments from */
  messageId: string;
}

/**
 * Result of listing attachments
 */
export interface ListAttachmentsResult {
  messageId: string;
  attachments: AttachmentInfo[];
}
