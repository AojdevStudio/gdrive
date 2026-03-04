/**
 * Gmail module types
 *
 * Note: Attachments are deferred to v3.3.0
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
  id: string;
  /** Label IDs to add */
  addLabelIds?: string[];
  /** Label IDs to remove */
  removeLabelIds?: string[];
}

/**
 * Result of modifying labels
 */
export interface ModifyLabelsResult {
  id: string;
  labelIds: string[];
  message: string;
}

// ============================================================================
// Reply Operations
// ============================================================================

/**
 * Options for replying to a message
 */
export interface ReplyToMessageOptions {
  /** The Gmail message ID to reply to */
  messageId: string;
  /** Reply body text */
  body: string;
  /** Whether body is HTML (default: false) */
  isHtml?: boolean;
  /** CC recipients */
  cc?: string[];
  /** BCC recipients */
  bcc?: string[];
  /** Send from a different email address (send-as alias) */
  from?: string;
}

/**
 * Result of sending a reply
 */
export interface ReplyToMessageResult {
  messageId: string;
  threadId: string;
  labelIds: string[];
  message: string;
}

/**
 * Options for reply-all to a message
 */
export interface ReplyAllToMessageOptions {
  /** The Gmail message ID to reply-all to */
  messageId: string;
  /** Reply body text */
  body: string;
  /** Whether body is HTML (default: false) */
  isHtml?: boolean;
  /** BCC recipients (additional, beyond auto-detected) */
  bcc?: string[];
  /** Send from a different email address (send-as alias) */
  from?: string;
}

/**
 * Result of sending a reply-all
 */
export interface ReplyAllToMessageResult {
  messageId: string;
  threadId: string;
  labelIds: string[];
  message: string;
}

// ============================================================================
// Forward Operations
// ============================================================================

/**
 * Options for forwarding a message
 */
export interface ForwardMessageOptions {
  /** The Gmail message ID to forward */
  messageId: string;
  /** Recipients to forward to */
  to: string[];
  /** CC recipients */
  cc?: string[];
  /** BCC recipients */
  bcc?: string[];
  /** Optional custom message to prepend before the forwarded content */
  body?: string;
  /** Whether body is HTML (default: false) */
  isHtml?: boolean;
  /** Send from a different email address (send-as alias) */
  from?: string;
}

/**
 * Result of forwarding a message
 */
export interface ForwardMessageResult {
  messageId: string;
  threadId: string;
  labelIds: string[];
  message: string;
}

// ============================================================================
// Attachment Operations
// ============================================================================

/**
 * Metadata about a single attachment
 */
export interface AttachmentInfo {
  /** Gmail attachment ID (use with downloadAttachment) */
  attachmentId: string;
  /** Filename of the attachment */
  filename: string;
  /** MIME type of the attachment */
  mimeType: string;
  /** Size in bytes */
  size: number;
}

/**
 * Options for listing attachments on a message
 */
export interface ListAttachmentsOptions {
  /** The Gmail message ID */
  messageId: string;
}

/**
 * Result of listing attachments
 */
export interface ListAttachmentsResult {
  messageId: string;
  attachments: AttachmentInfo[];
}

/**
 * Options for downloading a specific attachment
 */
export interface DownloadAttachmentOptions {
  /** The Gmail message ID */
  messageId: string;
  /** The attachment ID from listAttachments */
  attachmentId: string;
}

/**
 * Result of downloading an attachment
 */
export interface DownloadAttachmentResult {
  messageId: string;
  attachmentId: string;
  filename: string;
  mimeType: string;
  size: number;
  /** Base64url-encoded attachment data */
  data: string;
}

/**
 * An attachment to include when sending a message
 */
export interface OutboundAttachment {
  /** Filename to use for the attachment */
  filename: string;
  /** MIME type of the attachment */
  mimeType: string;
  /** Base64-encoded file content */
  data: string;
}

/**
 * Options for sending a message with attachments
 */
export interface SendWithAttachmentsOptions {
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
  /** File attachments to include */
  attachments: OutboundAttachment[];
}

/**
 * Result of sending a message with attachments
 */
export interface SendWithAttachmentsResult {
  messageId: string;
  threadId: string;
  labelIds: string[];
  message: string;
}

// ============================================================================
// Message Management Operations
// ============================================================================

/**
 * Options for trashing a message
 */
export interface TrashMessageOptions {
  /** The message ID */
  id: string;
}

/**
 * Result of trashing a message
 */
export interface TrashMessageResult {
  id: string;
  labelIds: string[];
  message: string;
}

/**
 * Options for untrashing a message
 */
export interface UntrashMessageOptions {
  /** The message ID */
  id: string;
}

/**
 * Result of untrashing a message
 */
export interface UntrashMessageResult {
  id: string;
  labelIds: string[];
  message: string;
}

/**
 * Options for permanently deleting a message
 */
export interface DeleteMessageOptions {
  /** The message ID */
  id: string;
  /**
   * Must be true to confirm permanent deletion.
   * This operation cannot be undone — use trashMessage() for recoverable deletion.
   */
  safetyAcknowledged: boolean;
}

/**
 * Result of deleting a message
 */
export interface DeleteMessageResult {
  id: string;
  message: string;
}

/**
 * Options for marking a message as read
 */
export interface MarkAsReadOptions {
  /** The message ID */
  id: string;
}

/**
 * Result of marking as read
 */
export interface MarkAsReadResult {
  id: string;
  labelIds: string[];
  message: string;
}

/**
 * Options for marking a message as unread
 */
export interface MarkAsUnreadOptions {
  /** The message ID */
  id: string;
}

/**
 * Result of marking as unread
 */
export interface MarkAsUnreadResult {
  id: string;
  labelIds: string[];
  message: string;
}

/**
 * Options for archiving a message
 */
export interface ArchiveMessageOptions {
  /** The message ID */
  id: string;
}

/**
 * Result of archiving a message
 */
export interface ArchiveMessageResult {
  id: string;
  labelIds: string[];
  message: string;
}
